## Diagnostic-first plan (no padding changes)

### What I already found by reading the code

**1. Where `--safe-top` is defined**
`src/styles.css` lines 162–167:
```css
:root {
  --safe-top:    max(env(safe-area-inset-top,    0px), 0px);
  --safe-bottom: max(env(safe-area-inset-bottom, 0px), 0px);
  --safe-left:   env(safe-area-inset-left,   0px);
  --safe-right:  env(safe-area-inset-right,  0px);
}
```
The `max(..., 0px)` is a no-op — the value is whatever `env(safe-area-inset-top)` resolves to, or `0px` if it's not defined. There is **no JS that ever writes `--safe-top`**; it is purely CSS, driven entirely by the WebView's `env()` resolution.

**2. What initializes it**
Nothing on the JS side. The only inputs are:
- `<meta name="viewport" content="… viewport-fit=cover">` in `src/routes/__root.tsx:81` — present ✅
- Capacitor `StatusBar.setOverlaysWebView({ overlay: true })` in `src/lib/native-bridge.ts:46`, called from a `useEffect` in `RootComponent` via a **dynamic `import('@capacitor/status-bar')`** — async, runs after first paint.
- `capacitor.config.ts` sets `StatusBar.overlaysWebView: true` at plugin-config level.
- `MainActivity.java` deliberately does **not** pad the root view (comment says CSS handles it).

**3. Why ChatList "works" but auth pages don't (the real root cause)**
ChatList renders inside `AppLayout`, which has a sticky header at `src/components/AppLayout.tsx:330–335`:
```jsx
<header style={{
  paddingTop: 'var(--safe-top)',
  height: 'calc(64px + var(--safe-top))',
}}>
```
The header is **64 px tall plus `--safe-top`**. Even when `--safe-top` resolves to `0px`, the 64 px header alone pushes all page content well below the camera cutout. ChatList isn't respecting the safe area — it's being saved by an unrelated 64 px header.

Auth pages (`SignInPage`, `SignUpPage`, `ForgotPasswordPage`) render **without `AppLayout`**, so they have no header buffer. They rely entirely on `var(--safe-top)`. If `env(safe-area-inset-top)` is `0px` in the Android WebView, their padding collapses to `1rem` and the logo slides under the camera — exactly the reported symptom.

**4. Suspected root cause (to be confirmed by logging)**
On Android, `env(safe-area-inset-top)` returns `0px` even when the Capacitor StatusBar plugin sets `overlaysWebView=true`. The plugin's "overlay" flag asks Android to draw under the status bar, but it does **not** publish the WindowInsets values into the WebView's CSS env. Reliable Android safe-area requires either:
- `@capacitor-community/safe-area` (which natively reads WindowInsets and injects `--safe-area-inset-*` CSS vars), or
- Custom native code that reads `WindowInsetsCompat` in `MainActivity` and pushes the top inset into a CSS variable via `bridge.eval(...)`.

ChatList has been masking this the whole time.

### Diagnostic steps to confirm before any fix

Add temporary logging in three places, capture the values from a fresh Android build, then remove the logging.

1. **`src/routes/__root.tsx` – `RootComponent` `useEffect`**: after `initNativeBridge()`, on a 250 ms `setTimeout` (to let the async StatusBar plugin settle), log:
   ```ts
   const cs = getComputedStyle(document.documentElement);
   console.log('[safe-area:root]', {
     native: document.documentElement.dataset.native,
     ua: navigator.userAgent,
     safeTop: cs.getPropertyValue('--safe-top').trim(),
     safeBottom: cs.getPropertyValue('--safe-bottom').trim(),
     envTopProbe: getComputedStyle(document.body).paddingLeft, // body has env(left)
     innerHeight: window.innerHeight,
     visualViewportHeight: window.visualViewport?.height,
   });
   ```

2. **`src/pages/SignInPage.tsx`, `SignUpPage.tsx`, `ForgotPasswordPage.tsx`**: in a `useEffect`, log the same `--safe-top` / `--safe-bottom` plus the bounding rect of the outer wrapper and of the logo, so we see whether the wrapper *received* padding but the logo still overlaps, vs. wrapper padding being 0.

3. **`src/components/AppLayout.tsx`**: in a `useEffect`, log `--safe-top` plus the computed `paddingTop` of the `<header>`. This lets us compare the same variable on ChatList vs auth pages — if both report `0px`, that proves AppLayout is being saved by the 64 px header, not by a working safe-area.

4. **Async-timing check**: add a second log inside the StatusBar dynamic-import `.then(...)` in `native-bridge.ts:46` right after `setOverlaysWebView`, re-reading `--safe-top`. If the value changes between the early log and this one, the auth page is mounting before the StatusBar overlay takes effect and we need to set overlay earlier (native side) instead of patching CSS.

### Deliverable

After running a debug APK and capturing the logs, the report will state, with values:
- the literal `--safe-top` value on `/sign-in`, `/sign-up`, `/forgot-password`, and `/` (ChatList);
- whether `env(safe-area-inset-top)` ever becomes non-zero in this WebView;
- whether timing (auth page mounting before StatusBar overlay) is contributing.

Only then will a real fix be proposed — most likely one of: install `@capacitor-community/safe-area`, or push `WindowInsetsCompat.getInsets(systemBars()).top` from `MainActivity` into `--safe-top` via `bridge.eval`. No additional CSS padding will be added in this pass.

### Files touched (diagnostic only, all reverted after the report)

- `src/routes/__root.tsx`
- `src/pages/SignInPage.tsx`
- `src/pages/SignUpPage.tsx`
- `src/pages/ForgotPasswordPage.tsx`
- `src/components/AppLayout.tsx`
- `src/lib/native-bridge.ts`
