/**
 * Unit Tests for Bounding Box Calculations (Task 4.1.1)
 * 
 * These tests verify the bounding box calculation functions
 * for individual shapes and combined selections.
 * 
 * Note: All shapes created with create* helpers use DEFAULT_SHAPE_STYLE
 * which has strokeWidth: 2. The bounding box calculations add
 * strokeWidth/2 = 1px padding on each side.
 */

import { describe, it, expect } from 'vitest';
import {
    getShapeBoundingBox,
    getCombinedBoundingBox,
    isPointInBoundingBox,
    doBoundingBoxesIntersect,
    expandBoundingBox,
    getBoundingBoxHandles,
    BoundingBox,
} from './boundingBox';
import {
    createRectangle,
    createCircle,
    createEllipse,
    ShapeType,
    LineShape,
    ArrowShape,
    TriangleShape,
    Position,
} from '../types/shapes';

// ─── Shared constants & helpers ───

// strokeWidth/2 padding from DEFAULT_SHAPE_STYLE (strokeWidth = 2)
const SW_PAD = 1;

// Shared base properties for all mock shapes
const MOCK_BASE = {
    style: { fill: '', hasFill: false, stroke: '#000', strokeWidth: 2 },
    transform: { rotation: 0, scaleX: 1, scaleY: 1 },
    zIndex: 0,
    opacity: 1,
    visible: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
} as const;

function createMockLine(startX: number, startY: number, endX: number, endY: number): LineShape {
    return {
        ...MOCK_BASE,
        id: 'test-line',
        type: ShapeType.LINE,
        position: { x: startX, y: startY },
        startPoint: { x: startX, y: startY },
        endPoint: { x: endX, y: endY },
    };
}

function createMockArrow(startX: number, startY: number, endX: number, endY: number): ArrowShape {
    return {
        ...MOCK_BASE,
        id: 'test-arrow',
        type: ShapeType.ARROW,
        position: { x: startX, y: startY },
        startPoint: { x: startX, y: startY },
        endPoint: { x: endX, y: endY },
        arrowAtStart: false,
        arrowAtEnd: true,
        arrowSize: 10,
    };
}

function createMockTriangle(p1: Position, p2: Position, p3: Position): TriangleShape {
    return {
        ...MOCK_BASE,
        id: 'test-triangle',
        type: ShapeType.TRIANGLE,
        position: { x: p1.x, y: p1.y },
        points: [p1, p2, p3],
        style: { fill: '#000', hasFill: true, stroke: '#000', strokeWidth: 2 },
    };
}

/** Creates a BoundingBox from min/max coordinates */
function bbox(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        minX, minY, maxX, maxY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
    };
}

// ─── Tests ───

describe('getShapeBoundingBox', () => {
    describe('Rectangle', () => {
        it('should calculate correct bounding box for rectangle at origin', () => {
            const bb = getShapeBoundingBox(createRectangle(0, 0, 100, 50));

            // strokeWidth/2 = 1 padding on each side
            expect(bb.minX).toBe(0 - SW_PAD);
            expect(bb.minY).toBe(0 - SW_PAD);
            expect(bb.maxX).toBe(100 + SW_PAD);
            expect(bb.maxY).toBe(50 + SW_PAD);
            expect(bb.width).toBe(100 + 2 * SW_PAD);
            expect(bb.height).toBe(50 + 2 * SW_PAD);
        });

        it('should calculate correct bounding box for rectangle at offset position', () => {
            const bb = getShapeBoundingBox(createRectangle(50, 100, 200, 150));

            expect(bb.minX).toBe(50 - SW_PAD);
            expect(bb.minY).toBe(100 - SW_PAD);
            expect(bb.maxX).toBe(250 + SW_PAD); // 50 + 200 + pad
            expect(bb.maxY).toBe(250 + SW_PAD); // 100 + 150 + pad
            expect(bb.width).toBe(200 + 2 * SW_PAD);
            expect(bb.height).toBe(150 + 2 * SW_PAD);
        });

        it('should calculate correct center coordinates', () => {
            const bb = getShapeBoundingBox(createRectangle(0, 0, 100, 100));

            // Center with padding: (-1 + 101) / 2 = 50
            expect(bb.centerX).toBe(50);
            expect(bb.centerY).toBe(50);
        });
    });

    describe('Circle', () => {
        it('should calculate correct bounding box for circle', () => {
            // Circle position is the center
            const bb = getShapeBoundingBox(createCircle(50, 50, 25));

            expect(bb.minX).toBe(25 - SW_PAD);  // center - radius - pad
            expect(bb.minY).toBe(25 - SW_PAD);
            expect(bb.maxX).toBe(75 + SW_PAD);  // center + radius + pad
            expect(bb.maxY).toBe(75 + SW_PAD);
            expect(bb.width).toBe(50 + 2 * SW_PAD); // diameter + 2*pad
            expect(bb.height).toBe(50 + 2 * SW_PAD);
        });

        it('should calculate correct center for circle', () => {
            const bb = getShapeBoundingBox(createCircle(100, 200, 30));

            expect(bb.centerX).toBe(100);
            expect(bb.centerY).toBe(200);
        });
    });

    describe('Ellipse', () => {
        it('should calculate correct bounding box for ellipse', () => {
            const bb = getShapeBoundingBox(createEllipse(100, 100, 50, 30));

            expect(bb.minX).toBe(50 - SW_PAD);   // center - radiusX - pad
            expect(bb.minY).toBe(70 - SW_PAD);   // center - radiusY - pad
            expect(bb.maxX).toBe(150 + SW_PAD);  // center + radiusX + pad
            expect(bb.maxY).toBe(130 + SW_PAD);  // center + radiusY + pad
            expect(bb.width).toBe(100 + 2 * SW_PAD); // 2 * radiusX + 2*pad
            expect(bb.height).toBe(60 + 2 * SW_PAD); // 2 * radiusY + 2*pad
        });
    });

    describe('Line', () => {
        it('should calculate correct bounding box for horizontal line', () => {
            const bb = getShapeBoundingBox(createMockLine(10, 50, 200, 50));

            expect(bb.minX).toBe(10 - SW_PAD);
            expect(bb.maxX).toBe(200 + SW_PAD);
            expect(bb.minY).toBe(50 - SW_PAD);
            expect(bb.maxY).toBe(50 + SW_PAD);
        });

        it('should calculate correct bounding box for diagonal line', () => {
            const bb = getShapeBoundingBox(createMockLine(100, 50, 200, 150));

            expect(bb.minX).toBe(100 - SW_PAD);
            expect(bb.maxX).toBe(200 + SW_PAD);
            expect(bb.minY).toBe(50 - SW_PAD);
            expect(bb.maxY).toBe(150 + SW_PAD);
        });

        it('should handle lines with reversed direction', () => {
            const bb = getShapeBoundingBox(createMockLine(200, 150, 100, 50));

            // Should still get the same bounding box
            expect(bb.minX).toBe(100 - SW_PAD);
            expect(bb.maxX).toBe(200 + SW_PAD);
            expect(bb.minY).toBe(50 - SW_PAD);
            expect(bb.maxY).toBe(150 + SW_PAD);
        });
    });

    describe('Arrow', () => {
        it('should include arrow padding in bounding box', () => {
            const bb = getShapeBoundingBox(createMockArrow(100, 100, 200, 200));

            // Arrow padding = arrowSize (10) + strokeWidth/2 (1) = 11
            const arrowPad = 10 + SW_PAD;
            expect(bb.minX).toBe(100 - arrowPad);
            expect(bb.minY).toBe(100 - arrowPad);
            expect(bb.maxX).toBe(200 + arrowPad);
            expect(bb.maxY).toBe(200 + arrowPad);
        });
    });

    describe('Triangle', () => {
        it('should calculate bounding box from triangle vertices', () => {
            const triangle = createMockTriangle(
                { x: 50, y: 100 },   // Top vertex
                { x: 0, y: 200 },    // Bottom-left
                { x: 100, y: 200 }   // Bottom-right
            );
            const bb = getShapeBoundingBox(triangle);

            expect(bb.minX).toBe(0 - SW_PAD);
            expect(bb.maxX).toBe(100 + SW_PAD);
            expect(bb.minY).toBe(100 - SW_PAD);
            expect(bb.maxY).toBe(200 + SW_PAD);
        });
    });
});

describe('getCombinedBoundingBox', () => {
    it('should return null for empty array', () => {
        expect(getCombinedBoundingBox([])).toBeNull();
    });

    it('should return single shape bounding box for one shape', () => {
        const bb = getCombinedBoundingBox([createRectangle(10, 10, 50, 50)]);

        expect(bb).not.toBeNull();
        expect(bb!.minX).toBe(10 - SW_PAD);
        expect(bb!.maxX).toBe(60 + SW_PAD);
    });

    it('should combine multiple shapes into one bounding box', () => {
        const bb = getCombinedBoundingBox([
            createRectangle(0, 0, 50, 50),
            createRectangle(100, 100, 50, 50),
        ]);

        expect(bb).not.toBeNull();
        expect(bb!.minX).toBe(0 - SW_PAD);    // From rect1
        expect(bb!.minY).toBe(0 - SW_PAD);    // From rect1
        expect(bb!.maxX).toBe(150 + SW_PAD);  // From rect2 (100 + 50 + pad)
        expect(bb!.maxY).toBe(150 + SW_PAD);  // From rect2 (100 + 50 + pad)
    });

    it('should combine different shape types', () => {
        const bb = getCombinedBoundingBox([
            createRectangle(0, 0, 50, 50),
            createCircle(200, 200, 25), // center at 200, bounds from 175-225
        ]);

        expect(bb).not.toBeNull();
        expect(bb!.minX).toBe(0 - SW_PAD);    // From rect
        expect(bb!.minY).toBe(0 - SW_PAD);    // From rect
        expect(bb!.maxX).toBe(225 + SW_PAD);  // From circle (200 + 25 + pad)
        expect(bb!.maxY).toBe(225 + SW_PAD);  // From circle (200 + 25 + pad)
    });
});

describe('isPointInBoundingBox', () => {
    const testBox = bbox(10, 10, 110, 110);

    it('should detect point inside bounding box', () => {
        expect(isPointInBoundingBox({ x: 50, y: 50 }, testBox)).toBe(true);
        expect(isPointInBoundingBox({ x: 60, y: 60 }, testBox)).toBe(true);
    });

    it('should detect point outside bounding box', () => {
        expect(isPointInBoundingBox({ x: 0, y: 0 }, testBox)).toBe(false);
        expect(isPointInBoundingBox({ x: 200, y: 200 }, testBox)).toBe(false);
        expect(isPointInBoundingBox({ x: 50, y: 200 }, testBox)).toBe(false);
    });

    it('should detect points on the edge as inside', () => {
        expect(isPointInBoundingBox({ x: 10, y: 10 }, testBox)).toBe(true);  // Top-left corner
        expect(isPointInBoundingBox({ x: 110, y: 110 }, testBox)).toBe(true); // Bottom-right corner
        expect(isPointInBoundingBox({ x: 50, y: 10 }, testBox)).toBe(true);  // Top edge
    });

    it('should respect padding parameter', () => {
        // Point slightly outside should be inside with padding
        expect(isPointInBoundingBox({ x: 5, y: 50 }, testBox)).toBe(false);
        expect(isPointInBoundingBox({ x: 5, y: 50 }, testBox, 10)).toBe(true);
    });
});

describe('doBoundingBoxesIntersect', () => {
    const box1 = bbox(0, 0, 100, 100);

    it('should detect overlapping boxes', () => {
        expect(doBoundingBoxesIntersect(box1, bbox(50, 50, 150, 150))).toBe(true);
    });

    it('should detect non-overlapping boxes', () => {
        expect(doBoundingBoxesIntersect(box1, bbox(200, 200, 250, 250))).toBe(false);
    });

    it('should detect touching boxes as intersecting', () => {
        expect(doBoundingBoxesIntersect(box1, bbox(100, 0, 150, 50))).toBe(true);
    });

    it('should detect one box inside another', () => {
        expect(doBoundingBoxesIntersect(box1, bbox(25, 25, 75, 75))).toBe(true);
    });
});

describe('expandBoundingBox', () => {
    it('should expand bounding box by given padding', () => {
        const expanded = expandBoundingBox(bbox(50, 50, 150, 150), 10);

        expect(expanded.minX).toBe(40);
        expect(expanded.minY).toBe(40);
        expect(expanded.maxX).toBe(160);
        expect(expanded.maxY).toBe(160);
        expect(expanded.width).toBe(120);
        expect(expanded.height).toBe(120);
    });

    it('should handle negative padding (shrinking)', () => {
        const shrunk = expandBoundingBox(bbox(0, 0, 100, 100), -10);

        expect(shrunk.minX).toBe(10);
        expect(shrunk.maxX).toBe(90);
        expect(shrunk.width).toBe(80);
    });
});

describe('getBoundingBoxHandles', () => {
    const testBox = bbox(0, 0, 100, 100);

    it('should return 8 handle positions', () => {
        expect(getBoundingBoxHandles(testBox)).toHaveLength(8);
    });

    it('should return correct corner positions', () => {
        const handles = getBoundingBoxHandles(testBox);

        // Corners are first 4 handles
        expect(handles[0]).toEqual({ x: 0, y: 0 });     // Top-left
        expect(handles[1]).toEqual({ x: 100, y: 0 });   // Top-right
        expect(handles[2]).toEqual({ x: 100, y: 100 }); // Bottom-right
        expect(handles[3]).toEqual({ x: 0, y: 100 });   // Bottom-left
    });

    it('should return correct midpoint positions', () => {
        const handles = getBoundingBoxHandles(testBox);

        // Midpoints are handles 4-7
        expect(handles[4]).toEqual({ x: 50, y: 0 });   // Top-center
        expect(handles[5]).toEqual({ x: 100, y: 50 }); // Right-center
        expect(handles[6]).toEqual({ x: 50, y: 100 }); // Bottom-center
        expect(handles[7]).toEqual({ x: 0, y: 50 });   // Left-center
    });
});
