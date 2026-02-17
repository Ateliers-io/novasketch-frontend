import { Position } from '../../../types/shapes';

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Converts a screen position (e.g. from mouse event) to virtual canvas coordinates.
 * @param screenPos - The {x, y} position on the screen/client
 * @param transform - The current viewport transform {x, y, scale}
 * @returns The {x, y} position in the virtual canvas space
 */
export const toVirtual = (screenPos: Position, transform: ViewportTransform): Position => {
  return {
    x: (screenPos.x - transform.x) / transform.scale,
    y: (screenPos.y - transform.y) / transform.scale,
  };
};

/**
 * Converts a virtual canvas position to screen coordinates.
 * @param virtualPos - The {x, y} position in the virtual canvas space
 * @param transform - The current viewport transform {x, y, scale}
 * @returns The {x, y} position on the screen
 */
export const toScreen = (virtualPos: Position, transform: ViewportTransform): Position => {
  return {
    x: virtualPos.x * transform.scale + transform.x,
    y: virtualPos.y * transform.scale + transform.y,
  };
};
