/**
 * Tactile feedback — a tiny, safe wrapper over the Vibration API.
 *
 * Progressive enhancement only: silently no-ops where unsupported (desktop,
 * iOS Safari, or when the browser rejects the call). Never throws.
 */
export function haptic(pattern: number | number[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return false;
  }
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
