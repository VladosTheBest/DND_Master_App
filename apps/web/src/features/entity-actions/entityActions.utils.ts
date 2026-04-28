import { clamp } from "../../app-shared";
import type { EntityActionMenuState } from "./entityActions.types";

export const createEntityActionMenuState = (
  entityId: string,
  clientX: number,
  clientY: number
): EntityActionMenuState => ({
  entityId,
  x: clamp(clientX, 12, window.innerWidth - 260),
  y: clamp(clientY, 12, window.innerHeight - 120)
});
