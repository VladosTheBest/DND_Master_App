import { useLayoutEffect, useRef, type RefObject } from "react";
import { playWorkspaceMotion, workspaceEase } from "./workspace-motion";

/** Fade the committed workspace, without replacing its DOM or moving the camera. */
export function PageTransition({
  identity,
  target,
}: {
  identity: string;
  target: RefObject<HTMLElement | null>;
}) {
  const previous = useRef(identity);
  useLayoutEffect(() => {
    if (previous.current === identity) return;
    previous.current = identity;
    const element = target.current;
    if (!element) return;
    const animation = playWorkspaceMotion(
      element,
      [{ opacity: 0.55 }, { opacity: 1 }],
      {
        duration: 200,
        easing: workspaceEase,
      },
    );
    return () => animation?.cancel();
  }, [identity, target]);
  return null;
}
