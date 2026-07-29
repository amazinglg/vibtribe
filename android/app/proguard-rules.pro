##############################################################################
# VibTribe — R8 keep rules (safe optimization pass)
#
# Scope: obfuscate/optimize app + library code, while preserving every entry
# point reached via reflection, JSON, the Capacitor bridge, FCM, the manifest
# and WebView JavaScript interfaces. No resource shrinking in this phase.
##############################################################################

# Readable crash reports without leaking original file names.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Attributes required by reflection / annotation processors / generics.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod,
                RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations,
                AnnotationDefault, Exceptions

##############################################################################
# Android components declared in AndroidManifest.xml
# (Activities/Services are instantiated by name — never rename them.)
##############################################################################
-keep public class app.vibtribe.app.MainActivity { *; }
-keep public class app.vibtribe.app.IncomingCallActivity { *; }
-keep public class app.vibtribe.app.OngoingCallService { *; }
-keep public class app.vibtribe.app.VibTribeMessagingService { *; }

# Anything else registered in the manifest / resolved by intent filters.
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider
-keep public class * extends android.app.Application
-keep public class * extends androidx.core.content.FileProvider

# Layout-inflated custom views + onClick handlers.
-keepclassmembers class * extends android.view.View {
    void set*(***);
    *** get*();
}
-keepclassmembers class * extends android.app.Activity {
    public void *(android.view.View);
}
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

##############################################################################
# Capacitor bridge — plugins, @PluginMethod and JS interfaces are all
# resolved reflectively by name from JavaScript.
##############################################################################
-keep public class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public <methods>;
}
# VibTribe's own native plugins (VtMedia, VtTrustLock).
-keep class app.vibtribe.app.VtMediaPlugin { *; }
-keep class app.vibtribe.app.VtTrustLockPlugin { *; }

# Cordova plugins bridged through capacitor-cordova-android-plugins.
-keep class org.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin { *; }

# WebView @JavascriptInterface members.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

##############################################################################
# Firebase Cloud Messaging (push notifications / incoming-call ringer)
##############################################################################
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
-keep class * extends com.google.firebase.messaging.FirebaseMessagingService { *; }

##############################################################################
# AndroidX / Kotlin
##############################################################################
-dontwarn androidx.**
-keep class androidx.core.app.CoreComponentFactory { *; }
-keepclassmembers class ** {
    @androidx.annotation.Keep *;
}
-keep @androidx.annotation.Keep class * { *; }

-dontwarn kotlin.**
-dontwarn kotlinx.**
-keepclassmembers class **$WhenMappings { <fields>; }
-keep class kotlin.Metadata { *; }

##############################################################################
# JSON / reflection safety
# Capacitor uses org.json + reflective JSObject mapping for plugin payloads.
##############################################################################
-keep class org.json.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-dontwarn com.google.gson.**

##############################################################################
# Misc — suppress warnings for optional/edge deps pulled transitively.
##############################################################################
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.animal_sniffer.**

##############################################################################
# Intentionally NOT enabled in this phase (postponed until after launch):
#   shrinkResources, aggressive -optimizationpasses tuning, ABI splits,
#   dynamic feature modules, baseline profiles, dependency upgrades.
##############################################################################
