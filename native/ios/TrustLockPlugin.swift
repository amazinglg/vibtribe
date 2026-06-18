import Foundation
import Capacitor
import UIKit

/**
 * VtTrustLockPlugin — iOS native side of VibTribe's Trust Lock.
 *
 * Apple's sandbox does NOT permit blocking screenshots or screen recording
 * from a third-party app. This plugin implements the strongest protections
 * that iOS DOES allow:
 *
 *   • Detect screenshots         (UIApplication.userDidTakeScreenshotNotification)
 *     → emits `screenshotTaken` event so the JS layer can post a
 *       "🛡️ Screenshot detected on this device" system message into the chat.
 *
 *   • Detect screen recording    (UIScreen.capturedDidChangeNotification)
 *     → emits `screenRecordingChanged` with { active: Bool }
 *     → while active, paints a full-window UIBlurEffect overlay so the
 *       recording only captures the blur, not the protected content.
 *
 *   • Obscure app-switcher snapshot (willResignActive / didBecomeActive)
 *     → paints the same blur overlay before iOS captures the snapshot used
 *       in the multitasking switcher, and removes it when the app returns
 *       to the foreground (unless screen recording is still active).
 *
 * Registered with Capacitor via TrustLockPlugin.m as plugin name
 * "VtTrustLock". The Web layer (src/lib/trust-lock-service.ts) calls
 * `Capacitor.Plugins.VtTrustLock.enable()` / `.disable()` when the user
 * toggles Trust Lock on a chat.
 */
@objc(VtTrustLockPlugin)
public class VtTrustLockPlugin: CAPPlugin {
    private var blurView: UIVisualEffectView?
    private var observersRegistered = false
    private static let blurTag = 988_877_001

    @objc func enable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.registerObservers()
            // Reflect current recording state immediately.
            self.handleCaptureStateChange()
            call.resolve(["enabled": true])
        }
    }

    @objc func disable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.unregisterObservers()
            self.removeBlur()
            call.resolve(["enabled": false])
        }
    }

    @objc func isActive(_ call: CAPPluginCall) {
        call.resolve(["active": observersRegistered])
    }

    // MARK: - Observers

    private func registerObservers() {
        guard !observersRegistered else { return }
        observersRegistered = true
        let nc = NotificationCenter.default
        nc.addObserver(self,
                       selector: #selector(onScreenshot),
                       name: UIApplication.userDidTakeScreenshotNotification,
                       object: nil)
        nc.addObserver(self,
                       selector: #selector(onCapturedChange),
                       name: UIScreen.capturedDidChangeNotification,
                       object: nil)
        nc.addObserver(self,
                       selector: #selector(onWillResignActive),
                       name: UIApplication.willResignActiveNotification,
                       object: nil)
        nc.addObserver(self,
                       selector: #selector(onDidBecomeActive),
                       name: UIApplication.didBecomeActiveNotification,
                       object: nil)
    }

    private func unregisterObservers() {
        guard observersRegistered else { return }
        observersRegistered = false
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Notification handlers

    @objc private func onScreenshot() {
        let ts = Date().timeIntervalSince1970 * 1000.0
        notifyListeners("screenshotTaken", data: ["timestamp": ts])
    }

    @objc private func onCapturedChange() {
        handleCaptureStateChange()
    }

    private func handleCaptureStateChange() {
        let active = UIScreen.main.isCaptured
        if active { addBlur() } else { removeBlur() }
        notifyListeners("screenRecordingChanged", data: ["active": active])
    }

    @objc private func onWillResignActive() {
        // Always blur before iOS takes the multitasking snapshot.
        addBlur()
    }

    @objc private func onDidBecomeActive() {
        // Keep blur if a screen recording is still in progress.
        if !UIScreen.main.isCaptured {
            removeBlur()
        }
    }

    // MARK: - Blur overlay

    private func keyWindow() -> UIWindow? {
        return UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.windows.first(where: { $0.isKeyWindow }) ?? ($0 as? UIWindowScene)?.windows.first }
            .first
    }

    private func addBlur() {
        DispatchQueue.main.async {
            guard self.blurView == nil, let window = self.keyWindow() else { return }
            let style: UIBlurEffect.Style
            if #available(iOS 13.0, *) { style = .systemMaterialDark } else { style = .dark }
            let bv = UIVisualEffectView(effect: UIBlurEffect(style: style))
            bv.frame = window.bounds
            bv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            bv.tag = VtTrustLockPlugin.blurTag
            bv.isUserInteractionEnabled = false
            window.addSubview(bv)
            window.bringSubviewToFront(bv)
            self.blurView = bv
        }
    }

    private func removeBlur() {
        DispatchQueue.main.async {
            if let v = self.blurView {
                v.removeFromSuperview()
                self.blurView = nil
            }
            // Defensive: also strip any stale overlay matching our tag.
            if let window = self.keyWindow() {
                for sub in window.subviews where sub.tag == VtTrustLockPlugin.blurTag {
                    sub.removeFromSuperview()
                }
            }
        }
    }
}