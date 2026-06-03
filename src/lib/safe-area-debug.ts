import { useEffect } from 'react';

/**
 * TEMPORARY DIAGNOSTIC — logs the computed values of the safe-area CSS
 * variables on every relevant screen so we can determine whether
 * `env(safe-area-inset-*)` is actually being resolved by the Android
 * Capacitor WebView. Remove once the safe-area root cause is fixed.
 */
export function logSafeArea(tag: string, extra?: () => Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try {
    const cs = getComputedStyle(document.documentElement);
    const bodyCs = getComputedStyle(document.body);
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);pointer-events:none;';
    document.body.appendChild(probe);
    const probeHeight = probe.getBoundingClientRect().height;
    document.body.removeChild(probe);

    // eslint-disable-next-line no-console
    console.log(`[safe-area:${tag}]`, {
      native: document.documentElement.dataset.native,
      ua: navigator.userAgent,
      safeTopVar: cs.getPropertyValue('--safe-top').trim(),
      safeBottomVar: cs.getPropertyValue('--safe-bottom').trim(),
      safeLeftVar: cs.getPropertyValue('--safe-left').trim(),
      safeRightVar: cs.getPropertyValue('--safe-right').trim(),
      bodyPaddingLeft: bodyCs.paddingLeft,
      bodyPaddingRight: bodyCs.paddingRight,
      envTopProbePx: probeHeight,
      innerHeight: window.innerHeight,
      visualViewportHeight: window.visualViewport?.height,
      devicePixelRatio: window.devicePixelRatio,
      ts: Date.now(),
      ...(extra ? extra() : {}),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[safe-area:${tag}] log failed`, err);
  }
}

/**
 * Logs safe-area values immediately on mount, again after 250 ms (lets the
 * async Capacitor StatusBar plugin settle), and once more after 1 s.
 */
export function useSafeAreaDebug(tag: string, getExtra?: () => Record<string, unknown>) {
  useEffect(() => {
    logSafeArea(`${tag}:mount`, getExtra);
    const t1 = window.setTimeout(() => logSafeArea(`${tag}:250ms`, getExtra), 250);
    const t2 = window.setTimeout(() => logSafeArea(`${tag}:1000ms`, getExtra), 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}