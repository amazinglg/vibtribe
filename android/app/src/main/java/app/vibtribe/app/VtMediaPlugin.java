package app.vibtribe.app;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * VibTribe native media bridge.
 *
 * Handles the three things the WebView cannot do on modern Android:
 *   1. save()      — write decrypted media into the shared MediaStore so it
 *                    shows up in the phone's Gallery / Downloads.
 *   2. share()     — hand a real content:// URI to the OS share sheet.
 *   3. copyImage() — put the actual image (not its URL) on the clipboard.
 *
 * Every method is hard-blocked while Trust Lock is active.
 */
@CapacitorPlugin(name = "VtMedia")
public class VtMediaPlugin extends Plugin {
    private static final String TAG = "VibTribeMedia";
    private static final String FOLDER = "VibTribe";

    private boolean blockedByTrustLock(PluginCall call) {
        if (VtTrustLockPlugin.isSecureActive()) {
            call.reject("TRUST_LOCK");
            return true;
        }
        return false;
    }

    private static byte[] decode(String data) {
        String payload = data;
        int comma = payload.indexOf(',');
        if (payload.startsWith("data:") && comma >= 0) payload = payload.substring(comma + 1);
        return Base64.decode(payload, Base64.DEFAULT);
    }

    private static String sanitize(String name, String mime) {
        String safe = (name == null || name.trim().isEmpty()) ? "vibtribe-media" : name.trim();
        safe = safe.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (!safe.matches(".*\\.[A-Za-z0-9]{2,5}$")) {
            String ext = android.webkit.MimeTypeMap.getSingleton()
                    .getExtensionFromMimeType(mime == null ? "" : mime);
            if (ext != null && !ext.isEmpty()) safe = safe + "." + ext;
        }
        return safe;
    }

    // ---------------------------------------------------------------- save

    @PluginMethod
    public void save(PluginCall call) {
        if (blockedByTrustLock(call)) return;
        String data = call.getString("data");
        if (data == null) { call.reject("Missing data"); return; }
        String mime = call.getString("mime", "application/octet-stream");
        String name = sanitize(call.getString("name"), mime);

        try {
            byte[] bytes = decode(data);
            boolean isImage = mime != null && mime.startsWith("image/");
            boolean isVideo = mime != null && mime.startsWith("video/");
            boolean isAudio = mime != null && mime.startsWith("audio/");
            String location = (isImage || isVideo || isAudio) ? "gallery" : "downloads";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                Uri collection;
                String relative;
                if (isImage) {
                    collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    relative = Environment.DIRECTORY_PICTURES + "/" + FOLDER;
                } else if (isVideo) {
                    collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    relative = Environment.DIRECTORY_MOVIES + "/" + FOLDER;
                } else if (isAudio) {
                    collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    relative = Environment.DIRECTORY_MUSIC + "/" + FOLDER;
                } else {
                    collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    relative = Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER;
                }

                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, relative);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                ContentResolver resolver = getContext().getContentResolver();
                Uri item = resolver.insert(collection, values);
                if (item == null) { call.reject("Could not create gallery entry"); return; }
                try (OutputStream out = resolver.openOutputStream(item)) {
                    if (out == null) throw new IllegalStateException("no output stream");
                    out.write(bytes);
                    out.flush();
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(item, done, null, null);
            } else {
                File dir = new File(
                        Environment.getExternalStoragePublicDirectory(
                                isVideo ? Environment.DIRECTORY_MOVIES
                                        : isAudio ? Environment.DIRECTORY_MUSIC
                                        : isImage ? Environment.DIRECTORY_PICTURES
                                        : Environment.DIRECTORY_DOWNLOADS),
                        FOLDER);
                if (!dir.exists() && !dir.mkdirs()) { call.reject("Could not create folder"); return; }
                File out = new File(dir, name);
                try (FileOutputStream fos = new FileOutputStream(out)) {
                    fos.write(bytes);
                    fos.flush();
                }
                MediaScannerConnection.scanFile(getContext(), new String[]{ out.getAbsolutePath() },
                        new String[]{ mime }, null);
            }

            JSObject ret = new JSObject();
            ret.put("location", location);
            call.resolve(ret);
        } catch (Exception e) {
            Log.w(TAG, "save() failed", e);
            call.reject("Could not save media");
        }
    }

    // --------------------------------------------------------------- share

    @PluginMethod
    public void share(PluginCall call) {
        if (blockedByTrustLock(call)) return;
        String data = call.getString("data");
        if (data == null) { call.reject("Missing data"); return; }
        String mime = call.getString("mime", "application/octet-stream");
        String name = sanitize(call.getString("name"), mime);
        String text = call.getString("text");

        try {
            Uri uri = cacheUri(decode(data), name);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Share via");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "share() failed", e);
            call.reject("Could not share media");
        }
    }

    // ----------------------------------------------------------- copyImage

    @PluginMethod
    public void copyImage(PluginCall call) {
        if (blockedByTrustLock(call)) return;
        String data = call.getString("data");
        if (data == null) { call.reject("Missing data"); return; }
        String mime = call.getString("mime", "image/png");
        String name = sanitize(call.getString("name"), mime);

        try {
            Uri uri = cacheUri(decode(data), name);
            ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm == null) { call.reject("Clipboard unavailable"); return; }
            ClipData clip = ClipData.newUri(getContext().getContentResolver(), "VibTribe image", uri);
            cm.setPrimaryClip(clip);
            // Grant read access broadly enough for the pasting app to resolve it.
            getContext().grantUriPermission("android", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "copyImage() failed", e);
            call.reject("Could not copy image");
        }
    }

    private Uri cacheUri(byte[] bytes, String name) throws Exception {
        File dir = new File(getContext().getCacheDir(), "shared");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("cache dir");
        File file = new File(dir, name);
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(bytes);
            fos.flush();
        }
        return FileProvider.getUriForFile(getContext(),
                getContext().getPackageName() + ".fileprovider", file);
    }
}