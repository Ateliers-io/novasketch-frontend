/**
 * Smart Connector Geometry Utilities
 *
 * Provides anchor point computation and nearest-anchor lookup for
 * the Smart Connectors feature.  Lines / arrows can snap their
 * endpoints to these anchors, and the endpoints can be automatically
 * updated when the attached shape moves.
 */

import { Shape, ShapeType, Position } from '../types/shapes';
import { getShapeBoundingBox } from './boundingBox';

// --- Types -----

/**
 * The 9 named attachment points on a shape's bounding box.
 */
export type AnchorType =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right';

/**
 * An anchor point resolved to canvas coordinates.
 */
export interface AnchorPoint {
    type: AnchorType;
    position: Position;
}

// --- Helpers ----

/**
 * Derive the 9 anchor positions from the four corners of a bounding box.
 */
function anchorPointsFromBox(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
): AnchorPoint[] {
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    return [
        { type: 'top-left',     position: { x: minX, y: minY } },
        { type: 'top',          position: { x: midX, y: minY } },
        { type: 'top-right',    position: { x: maxX, y: minY } },
        { type: 'left',         position: { x: minX, y: midY } },
        { type: 'center',       position: { x: midX, y: midY } },
        { type: 'right',        position: { x: maxX, y: midY } },
        { type: 'bottom-left',  position: { x: minX, y: maxY } },
        { type: 'bottom',       position: { x: midX, y: maxY } },
        { type: 'bottom-right', position: { x: maxX, y: maxY } },
    ];
}

// --- Public API ---

/**
 * Return all 9 connection anchor points for a shape.
 *
 * Lines and arrows cannot be connection targets (to prevent circular
 * attachment), so they return an empty array.
 */
export function getAnchorPoints(shape: Shape): AnchorPoint[] {
    if (shape.type === ShapeType.LINE || shape.type === ShapeType.ARROW) {
        return [];
    }

    const { minX, minY, maxX, maxY } = getShapeBoundingBox(shape);
    return anchorPointsFromBox(minX, minY, maxX, maxY);
}

/**
 * Compute the canvas position of a single named anchor on a shape.
 *
 * Useful for updating a line endpoint after the attached shape moves.
 * Returns `null` when called on line/arrow shapes.
 */
export function computeAnchorPosition(shape: Shape, anchorType: AnchorType): Position | null {
    if (shape.type === ShapeType.LINE || shape.type === ShapeType.ARROW) {
        return null;
    }

    const { minX, minY, maxX, maxY } = getShapeBoundingBox(shape);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    switch (anchorType) {
        case 'top-left':     return { x: minX, y: minY };
        case 'top':          return { x: midX, y: minY };
        case 'top-right':    return { x: maxX, y: minY };
        case 'left':         return { x: minX, y: midY };
        case 'center':       return { x: midX, y: midY };
        case 'right':        return { x: maxX, y: midY };
        case 'bottom-left':  return { x: minX, y: maxY };
        case 'bottom':       return { x: midX, y: maxY };
        case 'bottom-right': return { x: maxX, y: maxY };
        default:             return { x: midX, y: midY };
    }
}

/**
 * Find the nearest anchor on any connectable shape within `threshold` pixels.
 *
 * @param pos       - Canvas position of the cursor / endpoint being tested.
 * @param shapes    - All shapes on the canvas.
 * @param threshold - Maximum distance in canvas-pixels to consider.
 * @param excludeId - Optional shape ID to skip (e.g. the line being drawn).
 * @returns The closest match, or `null` if nothing is within threshold.
 */
export function findNearestAnchorPoint(
    pos: Position,
    shapes: Shape[],
    threshold: number,
    excludeId?: string,
): { shape: Shape; anchor: AnchorPoint } | null {
    let bestDistSq = threshold * threshold;
    let best: { shape: Shape; anchor: AnchorPoint } | null = null;

    for (const shape of shapes) {
        if (shape.id === excludeId) continue;

        const anchors = getAnchorPoints(shape);
        for (const anchor of anchors) {
            const dx = anchor.position.x - pos.x;
            const dy = anchor.position.y - pos.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                best = { shape, anchor };
            }
        }
    }

    return best;
}
