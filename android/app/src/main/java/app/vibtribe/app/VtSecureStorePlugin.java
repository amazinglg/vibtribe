package app.vibtribe.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Hardware-backed secure storage for the VibTribe offline cache master key.
 *
 * The value handed in from JS is wrapped with an AES/GCM key that lives inside
 * the Android Keystore (StrongBox when the device supports it) and never
 * leaves it. Only the wrapped ciphertext is written to SharedPreferences, so
 * copying the app's data directory yields nothing usable.
 *
 * The backing SharedPreferences file is excluded from Google Drive backups via
 * android:fullBackupContent / dataExtractionRules.
 */
@CapacitorPlugin(name = "VtSecureStore")
public class VtSecureStorePlugin extends Plugin {
    private static final String TAG = "VibTribeSecureStore";
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "vibtribe_cache_cmk_wrapper";
    private static final String PREFS = "vt_secure_store";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_LEN = 12;

    private SharedPreferences prefs() {
        Context ctx = getContext();
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey wrapperKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE);
        ks.load(null);
        KeyStore.Entry entry = ks.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }
        KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                builder.setIsStrongBoxBacked(true);
                gen.init(builder.build());
                return gen.generateKey();
            } catch (Exception strongBoxUnavailable) {
                Log.i(TAG, "StrongBox unavailable, falling back to TEE-backed Keystore");
                builder.setIsStrongBoxBacked(false);
            }
        }
        gen.init(builder.build());
        return gen.generateKey();
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key");
        JSObject ret = new JSObject();
        if (key == null) { call.reject("key is required"); return; }
        try {
            String stored = prefs().getString(key, null);
            if (stored == null) {
                ret.put("value", (String) null);
                call.resolve(ret);
                return;
            }
            byte[] blob = Base64.decode(stored, Base64.NO_WRAP);
            byte[] iv = new byte[IV_LEN];
            System.arraycopy(blob, 0, iv, 0, IV_LEN);
            byte[] ct = new byte[blob.length - IV_LEN];
            System.arraycopy(blob, IV_LEN, ct, 0, ct.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, wrapperKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] plain = cipher.doFinal(ct);
            ret.put("value", new String(plain, "UTF-8"));
            call.resolve(ret);
        } catch (Exception e) {
            Log.w(TAG, "get() failed", e);
            ret.put("value", (String) null);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || value == null) { call.reject("key and value are required"); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, wrapperKey());
            byte[] iv = cipher.getIV();
            byte[] ct = cipher.doFinal(value.getBytes("UTF-8"));
            byte[] blob = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, blob, 0, iv.length);
            System.arraycopy(ct, 0, blob, iv.length, ct.length);
            prefs().edit().putString(key, Base64.encodeToString(blob, Base64.NO_WRAP)).apply();
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "set() failed", e);
            call.reject("Could not store secure value");
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key");
        if (key == null) { call.reject("key is required"); return; }
        prefs().edit().remove(key).apply();
        call.resolve();
    }
}
