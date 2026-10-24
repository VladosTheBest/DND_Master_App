/** Short, interruptible effects. Native layout and focus remain authoritative. */
export function playWorkspaceMotion(
  element: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation | null {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (preference.matches || typeof element.animate !== "function") return null;
  const animation = element.animate(keyframes, options);
  const preferenceChanged = () => {
    if (preference.matches) animation.cancel();
  };
  preference.addEventListener("change", preferenceChanged);
  const cleanup = () =>
    preference.removeEventListener("change", preferenceChanged);
  void animation.finished.then(cleanup, cleanup);
  return animation;
}

export const workspaceEase = "cubic-bezier(.22, 1, .36, 1)";
