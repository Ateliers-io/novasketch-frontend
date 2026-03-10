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
 * Return all connection anchor points for a shape.
 *
 * For circles and ellipses, anchors lie on the perimeter (not bounding box corners).
 * For triangles, anchors are placed at vertices, edge midpoints, and centroid.
 * For other shapes, the bounding box corners/midpoints are used.
 *
 * Lines and arrows cannot be connection targets, so they return an empty array.
 */
export function getAnchorPoints(shape: Shape): AnchorPoint[] {
    if (shape.type === ShapeType.LINE || shape.type === ShapeType.ARROW) {
        return [];
    }

    if (shape.type === ShapeType.CIRCLE) {
        const cx = shape.position.x;
        const cy = shape.position.y;
        const r = shape.radius * Math.max(Math.abs(shape.transform.scaleX), Math.abs(shape.transform.scaleY));
        const D = Math.SQRT1_2; // cos(45°) ≈ 0.7071
        return [
            { type: 'top-left',     position: { x: cx - r * D, y: cy - r * D } },
            { type: 'top',          position: { x: cx, y: cy - r } },
            { type: 'top-right',    position: { x: cx + r * D, y: cy - r * D } },
            { type: 'left',         position: { x: cx - r, y: cy } },
            { type: 'center',       position: { x: cx, y: cy } },
            { type: 'right',        position: { x: cx + r, y: cy } },
            { type: 'bottom-left',  position: { x: cx - r * D, y: cy + r * D } },
            { type: 'bottom',       position: { x: cx, y: cy + r } },
            { type: 'bottom-right', position: { x: cx + r * D, y: cy + r * D } },
        ];
    }

    if (shape.type === ShapeType.ELLIPSE) {
        const cx = shape.position.x;
        const cy = shape.position.y;
        const rx = shape.radiusX * Math.abs(shape.transform.scaleX);
        const ry = shape.radiusY * Math.abs(shape.transform.scaleY);
        const rot = (shape.transform.rotation || 0) * Math.PI / 180;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        // 8 points on the ellipse perimeter at 45° increments, plus center
        const angles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4];
        const types: AnchorType[] = ['right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left', 'top', 'top-right'];
        const anchors: AnchorPoint[] = types.map((type, i) => {
            const lx = rx * Math.cos(angles[i]);
            const ly = ry * Math.sin(angles[i]);
            return { type, position: { x: cx + lx * cosR - ly * sinR, y: cy + lx * sinR + ly * cosR } };
        });
        anchors.push({ type: 'center', position: { x: cx, y: cy } });
        return anchors;
    }

    if (shape.type === ShapeType.TRIANGLE) {
        const [p0, p1, p2] = shape.points;
        const cx = (p0.x + p1.x + p2.x) / 3;
        const cy = (p0.y + p1.y + p2.y) / 3;
        return [
            { type: 'top',          position: p0 },
            { type: 'bottom-left',  position: p1 },
            { type: 'bottom-right', position: p2 },
            { type: 'left',         position: { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 } },
            { type: 'bottom',       position: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } },
            { type: 'right',        position: { x: (p2.x + p0.x) / 2, y: (p2.y + p0.y) / 2 } },
            { type: 'center',       position: { x: cx, y: cy } },
        ];
    }

    const { minX, minY, maxX, maxY } = getShapeBoundingBox(shape);
    return anchorPointsFromBox(minX, minY, maxX, maxY);
}

/**
 * Compute the canvas position of a single named anchor on a shape.
 *
 * Uses getAnchorPoints for shape-specific positioning (circles, ellipses,
 * triangles on perimeter; rectangles/frames on bounding box).
 * Returns `null` when called on line/arrow shapes.
 */
export function computeAnchorPosition(shape: Shape, anchorType: AnchorType): Position | null {
    if (shape.type === ShapeType.LINE || shape.type === ShapeType.ARROW) {
        return null;
    }

    const anchors = getAnchorPoints(shape);
    const match = anchors.find(a => a.type === anchorType);
    if (match) return match.position;

    // Fallback: center
    const center = anchors.find(a => a.type === 'center');
    return center ? center.position : null;
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
