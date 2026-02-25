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

// strokeWidth/2 padding from DEFAULT_SHAPE_STYLE (strokeWidth = 2)
const SW_PAD = 1;

// Helper to create a mock line shape
function createMockLine(startX: number, startY: number, endX: number, endY: number): LineShape {
    return {
        id: 'test-line',
        type: ShapeType.LINE,
        position: { x: startX, y: startY },
        startPoint: { x: startX, y: startY },
        endPoint: { x: endX, y: endY },
        style: { fill: '', hasFill: false, stroke: '#000', strokeWidth: 2 },
        transform: { rotation: 0, scaleX: 1, scaleY: 1 },
        zIndex: 0,
        opacity: 1,
        visible: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

// Helper to create a mock arrow shape
function createMockArrow(startX: number, startY: number, endX: number, endY: number): ArrowShape {
    return {
        id: 'test-arrow',
        type: ShapeType.ARROW,
        position: { x: startX, y: startY },
        startPoint: { x: startX, y: startY },
        endPoint: { x: endX, y: endY },
        arrowAtStart: false,
        arrowAtEnd: true,
        arrowSize: 10,
        style: { fill: '', hasFill: false, stroke: '#000', strokeWidth: 2 },
        transform: { rotation: 0, scaleX: 1, scaleY: 1 },
        zIndex: 0,
        opacity: 1,
        visible: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

// Helper to create a mock triangle shape
function createMockTriangle(p1: Position, p2: Position, p3: Position): TriangleShape {
    return {
        id: 'test-triangle',
        type: ShapeType.TRIANGLE,
        position: { x: p1.x, y: p1.y },
        points: [p1, p2, p3],
        style: { fill: '#000', hasFill: true, stroke: '#000', strokeWidth: 2 },
        transform: { rotation: 0, scaleX: 1, scaleY: 1 },
        zIndex: 0,
        opacity: 1,
        visible: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

describe('getShapeBoundingBox', () => {
    describe('Rectangle', () => {
        it('should calculate correct bounding box for rectangle at origin', () => {
            const rect = createRectangle(0, 0, 100, 50);
            const bbox = getShapeBoundingBox(rect);

            // strokeWidth/2 = 1 padding on each side
            expect(bbox.minX).toBe(0 - SW_PAD);
            expect(bbox.minY).toBe(0 - SW_PAD);
            expect(bbox.maxX).toBe(100 + SW_PAD);
            expect(bbox.maxY).toBe(50 + SW_PAD);
            expect(bbox.width).toBe(100 + 2 * SW_PAD);
            expect(bbox.height).toBe(50 + 2 * SW_PAD);
        });

        it('should calculate correct bounding box for rectangle at offset position', () => {
            const rect = createRectangle(50, 100, 200, 150);
            const bbox = getShapeBoundingBox(rect);

            expect(bbox.minX).toBe(50 - SW_PAD);
            expect(bbox.minY).toBe(100 - SW_PAD);
            expect(bbox.maxX).toBe(250 + SW_PAD); // 50 + 200 + pad
            expect(bbox.maxY).toBe(250 + SW_PAD); // 100 + 150 + pad
            expect(bbox.width).toBe(200 + 2 * SW_PAD);
            expect(bbox.height).toBe(150 + 2 * SW_PAD);
        });

        it('should calculate correct center coordinates', () => {
            const rect = createRectangle(0, 0, 100, 100);
            const bbox = getShapeBoundingBox(rect);

            // Center with padding: (-1 + 101) / 2 = 50
            expect(bbox.centerX).toBe(50);
            expect(bbox.centerY).toBe(50);
        });
    });

    describe('Circle', () => {
        it('should calculate correct bounding box for circle', () => {
            // Circle position is the center
            const circle = createCircle(50, 50, 25);
            const bbox = getShapeBoundingBox(circle);

            expect(bbox.minX).toBe(25 - SW_PAD);  // center - radius - pad
            expect(bbox.minY).toBe(25 - SW_PAD);
            expect(bbox.maxX).toBe(75 + SW_PAD);  // center + radius + pad
            expect(bbox.maxY).toBe(75 + SW_PAD);
            expect(bbox.width).toBe(50 + 2 * SW_PAD); // diameter + 2*pad
            expect(bbox.height).toBe(50 + 2 * SW_PAD);
        });

        it('should calculate correct center for circle', () => {
            const circle = createCircle(100, 200, 30);
            const bbox = getShapeBoundingBox(circle);

            expect(bbox.centerX).toBe(100);
            expect(bbox.centerY).toBe(200);
        });
    });

    describe('Ellipse', () => {
        it('should calculate correct bounding box for ellipse', () => {
            const ellipse = createEllipse(100, 100, 50, 30);
            const bbox = getShapeBoundingBox(ellipse);

            expect(bbox.minX).toBe(50 - SW_PAD);   // center - radiusX - pad
            expect(bbox.minY).toBe(70 - SW_PAD);   // center - radiusY - pad
            expect(bbox.maxX).toBe(150 + SW_PAD);  // center + radiusX + pad
            expect(bbox.maxY).toBe(130 + SW_PAD);  // center + radiusY + pad
            expect(bbox.width).toBe(100 + 2 * SW_PAD); // 2 * radiusX + 2*pad
            expect(bbox.height).toBe(60 + 2 * SW_PAD); // 2 * radiusY + 2*pad
        });
    });

    describe('Line', () => {
        it('should calculate correct bounding box for horizontal line', () => {
            const line = createMockLine(10, 50, 200, 50);
            const bbox = getShapeBoundingBox(line);

            expect(bbox.minX).toBe(10 - SW_PAD);
            expect(bbox.maxX).toBe(200 + SW_PAD);
            expect(bbox.minY).toBe(50 - SW_PAD);
            expect(bbox.maxY).toBe(50 + SW_PAD);
        });

        it('should calculate correct bounding box for diagonal line', () => {
            const line = createMockLine(100, 50, 200, 150);
            const bbox = getShapeBoundingBox(line);

            expect(bbox.minX).toBe(100 - SW_PAD);
            expect(bbox.maxX).toBe(200 + SW_PAD);
            expect(bbox.minY).toBe(50 - SW_PAD);
            expect(bbox.maxY).toBe(150 + SW_PAD);
        });

        it('should handle lines with reversed direction', () => {
            const line = createMockLine(200, 150, 100, 50);
            const bbox = getShapeBoundingBox(line);

            // Should still get the same bounding box
            expect(bbox.minX).toBe(100 - SW_PAD);
            expect(bbox.maxX).toBe(200 + SW_PAD);
            expect(bbox.minY).toBe(50 - SW_PAD);
            expect(bbox.maxY).toBe(150 + SW_PAD);
        });
    });

    describe('Arrow', () => {
        it('should include arrow padding in bounding box', () => {
            const arrow = createMockArrow(100, 100, 200, 200);
            const bbox = getShapeBoundingBox(arrow);

            // Arrow padding = arrowSize (10) + strokeWidth/2 (1) = 11
            const arrowPad = 10 + SW_PAD;
            expect(bbox.minX).toBe(100 - arrowPad);
            expect(bbox.minY).toBe(100 - arrowPad);
            expect(bbox.maxX).toBe(200 + arrowPad);
            expect(bbox.maxY).toBe(200 + arrowPad);
        });
    });

    describe('Triangle', () => {
        it('should calculate bounding box from triangle vertices', () => {
            const triangle = createMockTriangle(
                { x: 50, y: 100 },   // Top vertex
                { x: 0, y: 200 },    // Bottom-left
                { x: 100, y: 200 }   // Bottom-right
            );
            const bbox = getShapeBoundingBox(triangle);

            expect(bbox.minX).toBe(0 - SW_PAD);
            expect(bbox.maxX).toBe(100 + SW_PAD);
            expect(bbox.minY).toBe(100 - SW_PAD);
            expect(bbox.maxY).toBe(200 + SW_PAD);
        });
    });
});

describe('getCombinedBoundingBox', () => {
    it('should return null for empty array', () => {
        const bbox = getCombinedBoundingBox([]);
        expect(bbox).toBeNull();
    });

    it('should return single shape bounding box for one shape', () => {
        const rect = createRectangle(10, 10, 50, 50);
        const bbox = getCombinedBoundingBox([rect]);

        expect(bbox).not.toBeNull();
        expect(bbox!.minX).toBe(10 - SW_PAD);
        expect(bbox!.maxX).toBe(60 + SW_PAD);
    });

    it('should combine multiple shapes into one bounding box', () => {
        const rect1 = createRectangle(0, 0, 50, 50);
        const rect2 = createRectangle(100, 100, 50, 50);

        const bbox = getCombinedBoundingBox([rect1, rect2]);

        expect(bbox).not.toBeNull();
        expect(bbox!.minX).toBe(0 - SW_PAD);    // From rect1
        expect(bbox!.minY).toBe(0 - SW_PAD);    // From rect1
        expect(bbox!.maxX).toBe(150 + SW_PAD);  // From rect2 (100 + 50 + pad)
        expect(bbox!.maxY).toBe(150 + SW_PAD);  // From rect2 (100 + 50 + pad)
    });

    it('should combine different shape types', () => {
        const rect = createRectangle(0, 0, 50, 50);
        const circle = createCircle(200, 200, 25); // center at 200, bounds from 175-225

        const bbox = getCombinedBoundingBox([rect, circle]);

        expect(bbox).not.toBeNull();
        expect(bbox!.minX).toBe(0 - SW_PAD);    // From rect
        expect(bbox!.minY).toBe(0 - SW_PAD);    // From rect
        expect(bbox!.maxX).toBe(225 + SW_PAD);  // From circle (200 + 25 + pad)
        expect(bbox!.maxY).toBe(225 + SW_PAD);  // From circle (200 + 25 + pad)
    });
});

describe('isPointInBoundingBox', () => {
    const testBox: BoundingBox = {
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        minX: 10,
        minY: 10,
        maxX: 110,
        maxY: 110,
        centerX: 60,
        centerY: 60,
    };

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
    const box1: BoundingBox = {
        x: 0, y: 0, width: 100, height: 100,
        minX: 0, minY: 0, maxX: 100, maxY: 100,
        centerX: 50, centerY: 50,
    };

    it('should detect overlapping boxes', () => {
        const overlapping: BoundingBox = {
            x: 50, y: 50, width: 100, height: 100,
            minX: 50, minY: 50, maxX: 150, maxY: 150,
            centerX: 100, centerY: 100,
        };
        expect(doBoundingBoxesIntersect(box1, overlapping)).toBe(true);
    });

    it('should detect non-overlapping boxes', () => {
        const separate: BoundingBox = {
            x: 200, y: 200, width: 50, height: 50,
            minX: 200, minY: 200, maxX: 250, maxY: 250,
            centerX: 225, centerY: 225,
        };
        expect(doBoundingBoxesIntersect(box1, separate)).toBe(false);
    });

    it('should detect touching boxes as intersecting', () => {
        const touching: BoundingBox = {
            x: 100, y: 0, width: 50, height: 50,
            minX: 100, minY: 0, maxX: 150, maxY: 50,
            centerX: 125, centerY: 25,
        };
        expect(doBoundingBoxesIntersect(box1, touching)).toBe(true);
    });

    it('should detect one box inside another', () => {
        const inner: BoundingBox = {
            x: 25, y: 25, width: 50, height: 50,
            minX: 25, minY: 25, maxX: 75, maxY: 75,
            centerX: 50, centerY: 50,
        };
        expect(doBoundingBoxesIntersect(box1, inner)).toBe(true);
    });
});

describe('expandBoundingBox', () => {
    it('should expand bounding box by given padding', () => {
        const original: BoundingBox = {
            x: 50, y: 50, width: 100, height: 100,
            minX: 50, minY: 50, maxX: 150, maxY: 150,
            centerX: 100, centerY: 100,
        };

        const expanded = expandBoundingBox(original, 10);

        expect(expanded.minX).toBe(40);
        expect(expanded.minY).toBe(40);
        expect(expanded.maxX).toBe(160);
        expect(expanded.maxY).toBe(160);
        expect(expanded.width).toBe(120);
        expect(expanded.height).toBe(120);
    });

    it('should handle negative padding (shrinking)', () => {
        const original: BoundingBox = {
            x: 0, y: 0, width: 100, height: 100,
            minX: 0, minY: 0, maxX: 100, maxY: 100,
            centerX: 50, centerY: 50,
        };

        const shrunk = expandBoundingBox(original, -10);

        expect(shrunk.minX).toBe(10);
        expect(shrunk.maxX).toBe(90);
        expect(shrunk.width).toBe(80);
    });
});

describe('getBoundingBoxHandles', () => {
    const testBox: BoundingBox = {
        x: 0, y: 0, width: 100, height: 100,
        minX: 0, minY: 0, maxX: 100, maxY: 100,
        centerX: 50, centerY: 50,
    };

    it('should return 8 handle positions', () => {
        const handles = getBoundingBoxHandles(testBox);
        expect(handles).toHaveLength(8);
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
