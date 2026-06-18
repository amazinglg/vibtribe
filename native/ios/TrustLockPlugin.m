#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Register VtTrustLockPlugin (Swift) with Capacitor under the JS name
// "VtTrustLock". The Web layer reaches it via Capacitor.Plugins.VtTrustLock.
CAP_PLUGIN(VtTrustLockPlugin, "VtTrustLock",
    CAP_PLUGIN_METHOD(enable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(disable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(isActive, CAPPluginReturnPromise);
)