/**
 * Unit Tests for Frame Rendering, Rotation, Resize, and Hit-Testing Fixes
 *
 * Covers:
 *  1. isPointInShape – rotation-aware hit-testing for rectangles, frames, circles, ellipses
 *  2. Bounding box calculations with scale factors (frames, rectangles, circles, ellipses)
 *  3. Frame creation factory (createFrame)
 *  4. Shape type guards (isFrame)
 *  5. getTransformedBoundingBox with rotation
 *  6. getShapeGeometryBoundingBox with scale
 */

import { describe, it, expect } from 'vitest';
import { isPointInShape } from './eraserUtils';
import {
    getShapeBoundingBox,
    getShapeGeometryBoundingBox,
    getTransformedBoundingBox,
    isPointInBoundingBox,
    getCombinedBoundingBox,
} from '../../../utils/boundingBox';
import {
    ShapeType,
    RectangleShape,
    CircleShape,
    EllipseShape,
    FrameShape,
    createFrame,
    createRectangle,
    createCircle,
    createEllipse,
    isFrame,
    isRectangle,
    isCircle,
    isEllipse,
} from '../../../types/shapes';

// ─── Shared mock helpers ───────────────────────────────────────────

const BASE = {
    style: { fill: 'none', hasFill: false, stroke: '#3B82F6', strokeWidth: 2 },
    zIndex: 0,
    opacity: 1,
    visible: true,
    createdAt: '',
    updatedAt: '',
} as const;

function makeRect(x: number, y: number, w: number, h: number, opts: Partial<RectangleShape> = {}): RectangleShape {
    return {
        ...BASE,
        id: `rect-${x}-${y}`,
        type: ShapeType.RECTANGLE,
        position: { x, y },
        width: w,
        height: h,
        cornerRadius: 0,
        transform: { rotation: 0, scaleX: 1, scaleY: 1 },
        ...opts,
    };
}

function makeCircle(cx: number, cy: number, r: number, opts: Partial<CircleShape> = {}): CircleShape {
    return {
        ...BASE,
        id: `circle-${cx}-${cy}`,
        type: ShapeType.CIRCLE,
        position: { x: cx, y: cy },
        radius: r,
        transform: { rotation: 0, scaleX: 1, scaleY: 1 },
        ...opts,
    };
}

function makeEllipse(cx: number, cy: number, rx: number, ry: number, opts: Partial<EllipseShape> = {}): EllipseShape {
    return {
        ...BASE,
        id: `ellipse-${cx}-${cy}`,
        type: ShapeType.ELLIPSE,
        position: { x: cx, y: cy },
        radiusX: rx,
        radiusY: ry,
        transform: { rotation: 0, scaleX: 1, scaleY: 1 },
        ...opts,
    };
}

function makeFrame(x: number, y: number, w: number, h: number, opts: Partial<FrameShape> = {}): FrameShape {
    return {
        ...BASE,
        id: `frame-${x}-${y}`,
        type: ShapeType.FRAME,
        position: { x, y },
        width: w,
        height: h,
        childrenIds: [],
        backgroundVisible: true,
        padding: 20,
        ownerId: 'owner-1',
        assignedUserIds: [],
        name: 'Test Frame',
        transform: { rotation: 0, scaleX: 1, scaleY: 1 },
        ...opts,
    };
}

// ─── 1. isPointInShape — rotation-aware hit-testing ────────────────

describe('isPointInShape — rotation-aware hit-testing', () => {
    describe('Rectangle (no rotation)', () => {
        const rect = makeRect(100, 100, 200, 100);

        it('should detect point inside rectangle', () => {
            expect(isPointInShape(rect, 200, 150, 0)).toBe(true);
        });

        it('should detect point outside rectangle', () => {
            expect(isPointInShape(rect, 50, 50, 0)).toBe(false);
        });

        it('should detect point near edge with radius', () => {
            expect(isPointInShape(rect, 95, 150, 10)).toBe(true);
        });
    });

    describe('Rectangle (90° rotation)', () => {
        // 200×100 rect at (100,100), rotated 90°
        // Center is at (200, 150)
        const rect = makeRect(100, 100, 200, 100, {
            transform: { rotation: 90, scaleX: 1, scaleY: 1 },
        });

        it('should detect point inside the rotated bounds', () => {
            // The center of the rect is at (200, 150)
            expect(isPointInShape(rect, 200, 150, 0)).toBe(true);
        });

        it('should detect point outside original bounds but inside rotated bounds', () => {
            // After 90° rotation, a point above center should now be "inside"
            // This point is inside the un-rotated local rectangle when inverse-rotated
            expect(isPointInShape(rect, 200, 80, 30)).toBe(true);
        });
    });

    describe('Frame (no rotation, with scale)', () => {
        const frame = makeFrame(50, 50, 200, 100, {
            transform: { rotation: 0, scaleX: 2, scaleY: 2 },
        });

        it('should detect point inside the scaled frame', () => {
            // Scaled size = 400 × 200, so frame extends from (50,50) to (450,250)
            expect(isPointInShape(frame, 300, 200, 0)).toBe(true);
        });

        it('should detect point outside the scaled frame', () => {
            expect(isPointInShape(frame, 500, 300, 0)).toBe(false);
        });
    });

    describe('Frame (with rotation)', () => {
        const frame = makeFrame(100, 100, 200, 100, {
            transform: { rotation: 45, scaleX: 1, scaleY: 1 },
        });

        it('should detect point at center as inside', () => {
            // Center is at (200, 150)
            expect(isPointInShape(frame, 200, 150, 0)).toBe(true);
        });
    });

    describe('Circle (with scale)', () => {
        const circle = makeCircle(100, 100, 50, {
            transform: { rotation: 0, scaleX: 2, scaleY: 2 },
        });

        it('should detect point inside the scaled circle', () => {
            // Scaled radius = 100, so from (0,0) to (200,200)
            expect(isPointInShape(circle, 100, 5, 0)).toBe(true);
        });

        it('should detect point outside the scaled circle', () => {
            expect(isPointInShape(circle, 100, 210, 0)).toBe(false);
        });
    });

    describe('Ellipse (with scale)', () => {
        const ellipse = makeEllipse(100, 100, 50, 30, {
            transform: { rotation: 0, scaleX: 2, scaleY: 1 },
        });

        it('should detect point inside the scaled ellipse', () => {
            // Scaled rx = 100, ry = 30
            expect(isPointInShape(ellipse, 190, 100, 0)).toBe(true);
        });

        it('should detect point outside the scaled ellipse', () => {
            expect(isPointInShape(ellipse, 100, 140, 0)).toBe(false);
        });
    });
});

// ─── 2. Bounding box calculations with scale ──────────────────────

describe('getShapeBoundingBox — scale-aware', () => {
    const SW_PAD = 1; // strokeWidth = 2 → padding = 1

    describe('Rectangle with scaleX=2, scaleY=3', () => {
        const rect = makeRect(10, 10, 100, 50, {
            transform: { rotation: 0, scaleX: 2, scaleY: 3 },
        });

        it('should scale width and height in bounding box', () => {
            const bb = getShapeBoundingBox(rect);
            expect(bb.minX).toBe(10 - SW_PAD);
            expect(bb.minY).toBe(10 - SW_PAD);
            expect(bb.maxX).toBe(10 + 100 * 2 + SW_PAD); // 10 + 200 + 1 = 211
            expect(bb.maxY).toBe(10 + 50 * 3 + SW_PAD);  // 10 + 150 + 1 = 161
        });
    });

    describe('Circle with scaleX=2, scaleY=2', () => {
        const circle = makeCircle(100, 100, 50, {
            transform: { rotation: 0, scaleX: 2, scaleY: 2 },
        });

        it('should scale radius in bounding box', () => {
            const bb = getShapeBoundingBox(circle);
            // Scaled radius = 100
            expect(bb.minX).toBe(100 - 100 - SW_PAD); // -1
            expect(bb.minY).toBe(100 - 100 - SW_PAD); // -1
            expect(bb.maxX).toBe(100 + 100 + SW_PAD);  // 201
            expect(bb.maxY).toBe(100 + 100 + SW_PAD);  // 201
        });
    });

    describe('Ellipse with scaleX=2, scaleY=0.5', () => {
        const ellipse = makeEllipse(100, 100, 50, 30, {
            transform: { rotation: 0, scaleX: 2, scaleY: 0.5 },
        });

        it('should scale each axis independently', () => {
            const bb = getShapeBoundingBox(ellipse);
            // Scaled rx=100, ry=15
            expect(bb.minX).toBe(100 - 100 - SW_PAD); // -1
            expect(bb.minY).toBe(100 - 15 - SW_PAD);  // 84
            expect(bb.maxX).toBe(100 + 100 + SW_PAD);  // 201
            expect(bb.maxY).toBe(100 + 15 + SW_PAD);   // 116
        });
    });

    describe('Frame with scaleX=1.5, scaleY=2', () => {
        const frame = makeFrame(10, 10, 200, 100, {
            transform: { rotation: 0, scaleX: 1.5, scaleY: 2 },
        });

        it('should scale frame dimensions in bounding box', () => {
            const bb = getShapeBoundingBox(frame);
            // Scaled width = 300, height = 200
            expect(bb.minX).toBe(10 - SW_PAD);
            expect(bb.minY).toBe(10 - SW_PAD);
            expect(bb.maxX).toBe(10 + 300 + SW_PAD); // 311
            expect(bb.maxY).toBe(10 + 200 + SW_PAD);  // 211
        });
    });
});

// ─── 3. getShapeGeometryBoundingBox — scale-aware (no stroke padding) ──

describe('getShapeGeometryBoundingBox — scale-aware', () => {
    describe('Frame with scale', () => {
        const frame = makeFrame(50, 50, 200, 100, {
            transform: { rotation: 0, scaleX: 2, scaleY: 3 },
        });

        it('should return scaled geometry bounds', () => {
            const bb = getShapeGeometryBoundingBox(frame);
            expect(bb.minX).toBe(50);
            expect(bb.minY).toBe(50);
            expect(bb.maxX).toBe(50 + 200 * 2); // 450
            expect(bb.maxY).toBe(50 + 100 * 3); // 350
        });
    });

    describe('Rectangle with scale (geometry only)', () => {
        it('should return unpadded scaled bounds for geometry bounding box', () => {
            // getShapeGeometryBoundingBox does not add stroke padding
            const rect = makeRect(0, 0, 100, 50, {
                transform: { rotation: 0, scaleX: 1, scaleY: 1 },
            });
            const bb = getShapeGeometryBoundingBox(rect);
            expect(bb.minX).toBe(0);
            expect(bb.maxX).toBe(100);
            expect(bb.minY).toBe(0);
            expect(bb.maxY).toBe(50);
        });
    });
});

// ─── 4. getTransformedBoundingBox (rotation AABB) ──────────────────

describe('getTransformedBoundingBox — rotated AABB', () => {
    it('should return identity for 0° rotation', () => {
        const rect = makeRect(0, 0, 100, 50);
        const bb = getTransformedBoundingBox(rect);
        const bbN = getShapeBoundingBox(rect);
        expect(bb.minX).toBe(bbN.minX);
        expect(bb.maxX).toBe(bbN.maxX);
    });

    it('should expand AABB for 45° rotation', () => {
        const rect = makeRect(0, 0, 100, 100, {
            transform: { rotation: 45, scaleX: 1, scaleY: 1 },
        });
        const bb = getTransformedBoundingBox(rect);
        const bbN = getShapeBoundingBox(rect);
        // Rotated 45° square should have a wider AABB
        expect(bb.width).toBeGreaterThan(bbN.width);
    });

    it('should have the same center after rotation', () => {
        const rect = makeRect(50, 50, 200, 100, {
            transform: { rotation: 30, scaleX: 1, scaleY: 1 },
        });
        const bbNormal = getShapeBoundingBox(rect);
        const bbRotated = getTransformedBoundingBox(rect);
        // Center should be approximately the same
        expect(bbRotated.centerX).toBeCloseTo(bbNormal.centerX, 1);
        expect(bbRotated.centerY).toBeCloseTo(bbNormal.centerY, 1);
    });

    it('should handle frame rotation', () => {
        const frame = makeFrame(100, 100, 200, 100, {
            transform: { rotation: 90, scaleX: 1, scaleY: 1 },
        });
        const bb = getTransformedBoundingBox(frame);
        const bbN = getShapeBoundingBox(frame);
        // 90° rotation of 200×100 → effectively 100×200 AABB
        // Width and height should swap (approximately)
        expect(Math.abs(bb.width - bbN.height)).toBeLessThan(3);
        expect(Math.abs(bb.height - bbN.width)).toBeLessThan(3);
    });
});

// ─── 5. createFrame factory function ───────────────────────────────

describe('createFrame', () => {
    it('should create a frame with correct type', () => {
        const frame = createFrame(0, 0, 200, 100);
        expect(frame.type).toBe(ShapeType.FRAME);
    });

    it('should create frame with correct position and dimensions', () => {
        const frame = createFrame(50, 100, 300, 200);
        expect(frame.position.x).toBe(50);
        expect(frame.position.y).toBe(100);
        expect(frame.width).toBe(300);
        expect(frame.height).toBe(200);
    });

    it('should have default frame properties', () => {
        const frame = createFrame(0, 0, 100, 100);
        expect(frame.childrenIds).toEqual([]);
        expect(frame.backgroundVisible).toBe(true);
        expect(frame.padding).toBe(10);
        expect(frame.name).toBe('Frame');
        expect(frame.ownerId).toBe('unknown');
        expect(frame.assignedUserIds).toEqual([]);
    });

    it('should have default transform', () => {
        const frame = createFrame(0, 0, 100, 100);
        expect(frame.transform.rotation).toBe(0);
        expect(frame.transform.scaleX).toBe(1);
        expect(frame.transform.scaleY).toBe(1);
    });

    it('should allow overriding properties', () => {
        const frame = createFrame(0, 0, 100, 100, {
            name: 'My Frame',
            ownerId: 'user-123',
            opacity: 0.8,
            padding: 30,
        });
        expect(frame.name).toBe('My Frame');
        expect(frame.ownerId).toBe('user-123');
        expect(frame.opacity).toBe(0.8);
        expect(frame.padding).toBe(30);
    });

    it('should generate a unique ID', () => {
        const f1 = createFrame(0, 0, 100, 100);
        const f2 = createFrame(0, 0, 100, 100);
        expect(f1.id).not.toBe(f2.id);
    });

    it('should have timestamps', () => {
        const frame = createFrame(0, 0, 100, 100);
        expect(frame.createdAt).toBeDefined();
        expect(frame.updatedAt).toBeDefined();
        expect(frame.createdAt).toBe(frame.updatedAt);
    });
});

// ─── 6. isFrame type guard ─────────────────────────────────────────

describe('isFrame type guard', () => {
    it('should return true for frame shapes', () => {
        const frame = createFrame(0, 0, 100, 100);
        expect(isFrame(frame)).toBe(true);
    });

    it('should return false for rectangles', () => {
        const rect = createRectangle(0, 0, 100, 100);
        expect(isFrame(rect)).toBe(false);
    });

    it('should return false for circles', () => {
        const circle = createCircle(0, 0, 50);
        expect(isFrame(circle)).toBe(false);
    });

    it('should return false for ellipses', () => {
        const ellipse = createEllipse(0, 0, 50, 30);
        expect(isFrame(ellipse)).toBe(false);
    });
});

// ─── 7. Combined bounding box with frames ─────────────────────────

describe('getCombinedBoundingBox — with frames', () => {
    it('should combine frame and rectangle bounding boxes', () => {
        const frame = makeFrame(0, 0, 100, 100);
        const rect = makeRect(200, 200, 50, 50);

        const bb = getCombinedBoundingBox([frame, rect]);
        expect(bb).not.toBeNull();
        expect(bb!.minX).toBeLessThanOrEqual(0);
        expect(bb!.maxX).toBeGreaterThanOrEqual(250);
    });

    it('should include scaled frame dimensions', () => {
        const frame = makeFrame(0, 0, 100, 100, {
            transform: { rotation: 0, scaleX: 3, scaleY: 3 },
        });

        const bb = getCombinedBoundingBox([frame]);
        expect(bb).not.toBeNull();
        // Scaled: 100*3 = 300
        expect(bb!.maxX).toBeGreaterThanOrEqual(300);
        expect(bb!.maxY).toBeGreaterThanOrEqual(300);
    });
});

// ─── 8. isPointInBoundingBox with frames ───────────────────────────

describe('isPointInBoundingBox — frame scenarios', () => {
    it('should detect point inside frame bounding box', () => {
        const frame = makeFrame(50, 50, 200, 100);
        const bb = getShapeBoundingBox(frame);
        expect(isPointInBoundingBox({ x: 150, y: 100 }, bb)).toBe(true);
    });

    it('should detect point outside frame bounding box', () => {
        const frame = makeFrame(50, 50, 200, 100);
        const bb = getShapeBoundingBox(frame);
        expect(isPointInBoundingBox({ x: 500, y: 500 }, bb)).toBe(false);
    });

    it('should detect point inside scaled frame bounding box', () => {
        const frame = makeFrame(0, 0, 100, 100, {
            transform: { rotation: 0, scaleX: 2, scaleY: 2 },
        });
        const bb = getShapeBoundingBox(frame);
        // Scaled to 200×200
        expect(isPointInBoundingBox({ x: 150, y: 150 }, bb)).toBe(true);
    });
});

// ─── 9. Edge cases ─────────────────────────────────────────────────

describe('Edge cases', () => {
    it('should handle zero-size frame', () => {
        const frame = makeFrame(100, 100, 0, 0);
        const bb = getShapeBoundingBox(frame);
        expect(bb.width).toBeLessThanOrEqual(2); // only stroke padding
    });

    it('should handle frame at negative coordinates', () => {
        const frame = makeFrame(-100, -200, 50, 50);
        const bb = getShapeBoundingBox(frame);
        expect(bb.minX).toBeLessThan(0);
        expect(bb.minY).toBeLessThan(0);
    });

    it('should handle very large scale factors', () => {
        const frame = makeFrame(0, 0, 10, 10, {
            transform: { rotation: 0, scaleX: 100, scaleY: 100 },
        });
        const bb = getShapeBoundingBox(frame);
        expect(bb.maxX).toBeGreaterThan(900); // 10 * 100
    });

    it('should handle negative scale (mirrored frame)', () => {
        const rect = makeRect(0, 0, 100, 50, {
            transform: { rotation: 0, scaleX: -1, scaleY: -1 },
        });
        // Negative scale: bounding box calc uses Math.abs for circle/ellipse
        // For rectangles, negative scale produces negative width, but BB should still be valid
        const bb = getShapeBoundingBox(rect);
        expect(bb.width).toBeDefined();
        expect(bb.height).toBeDefined();
    });

    it('should handle 180° rotation (identical to no rotation for symmetric shapes)', () => {
        const rect = makeRect(0, 0, 100, 100, {
            transform: { rotation: 180, scaleX: 1, scaleY: 1 },
        });
        expect(isPointInShape(rect, 50, 50, 0)).toBe(true);
    });

    it('should handle 360° rotation (identical to no rotation)', () => {
        const frame = makeFrame(100, 100, 200, 100, {
            transform: { rotation: 360, scaleX: 1, scaleY: 1 },
        });
        expect(isPointInShape(frame, 200, 150, 0)).toBe(true);
    });
});
