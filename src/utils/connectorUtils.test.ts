/**
 * Unit Tests for Smart Connector Geometry Utilities
 */

import { describe, it, expect } from 'vitest';
import {
    getAnchorPoints,
    computeAnchorPosition,
    findNearestAnchorPoint,
    AnchorPoint,
    AnchorType,
} from './connectorUtils';
import {
    ShapeType,
    RectangleShape,
    CircleShape,
    EllipseShape,
    TriangleShape,
    LineShape,
    ArrowShape,
    Position,
} from '../types/shapes';

// --- Shared helpers ---

const BASE = {
    id: 'test-shape',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    zIndex: 0,
    opacity: 1,
    visible: true,
    // strokeWidth=0 keeps anchor positions clean (no padding offsets in tests)
    style: { fill: '', hasFill: false, stroke: '#000', strokeWidth: 0 },
    transform: { rotation: 0, scaleX: 1, scaleY: 1 },
};

function mockRect(
    x: number,
    y: number,
    width: number,
    height: number,
    id = 'rect-1',
): RectangleShape {
    return {
        ...BASE,
        id,
        type: ShapeType.RECTANGLE,
        position: { x, y },
        width,
        height,
    };
}

function mockCircle(cx: number, cy: number, radius: number, id = 'circle-1'): CircleShape {
    return {
        ...BASE,
        id,
        type: ShapeType.CIRCLE,
        position: { x: cx, y: cy },
        radius,
    };
}

function mockEllipse(
    cx: number,
    cy: number,
    radiusX: number,
    radiusY: number,
    id = 'ellipse-1',
): EllipseShape {
    return {
        ...BASE,
        id,
        type: ShapeType.ELLIPSE,
        position: { x: cx, y: cy },
        radiusX,
        radiusY,
    };
}

function mockTriangle(
    p1: Position,
    p2: Position,
    p3: Position,
    id = 'tri-1',
): TriangleShape {
    return {
        ...BASE,
        id,
        type: ShapeType.TRIANGLE,
        position: p1,
        points: [p1, p2, p3],
    };
}

function mockLine(
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    id = 'line-1',
): LineShape {
    return {
        ...BASE,
        id,
        type: ShapeType.LINE,
        position: { x: sx, y: sy },
        startPoint: { x: sx, y: sy },
        endPoint: { x: ex, y: ey },
    };
}

function mockArrow(
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    id = 'arrow-1',
): ArrowShape {
    return {
        ...BASE,
        id,
        type: ShapeType.ARROW,
        position: { x: sx, y: sy },
        startPoint: { x: sx, y: sy },
        endPoint: { x: ex, y: ey },
        arrowAtStart: false,
        arrowAtEnd: true,
        arrowSize: 10,
    };
}

// Find anchor by type in an anchor array
function findAnchor(anchors: AnchorPoint[], type: AnchorType): AnchorPoint | undefined {
    return anchors.find(a => a.type === type);
}

// --- getAnchorPoints ---

describe('getAnchorPoints', () => {
    describe('rectangle', () => {
        /**
         * Rectangle at (100, 200) with width=100, height=60, no stroke padding.
         * Expected bounding box: minX=100, minY=200, maxX=200, maxY=260.
         */
        const rect = mockRect(100, 200, 100, 60);
        let anchors: AnchorPoint[];

        it('returns exactly 9 anchor points', () => {
            anchors = getAnchorPoints(rect);
            expect(anchors).toHaveLength(9);
        });

        it('has top-left at shape corner', () => {
            const anchors = getAnchorPoints(rect);
            expect(findAnchor(anchors, 'top-left')?.position).toEqual({ x: 100, y: 200 });
        });

        it('has top midpoint at correct x', () => {
            const anchors = getAnchorPoints(rect);
            expect(findAnchor(anchors, 'top')?.position).toEqual({ x: 150, y: 200 });
        });

        it('has top-right at shape corner', () => {
            const anchors = getAnchorPoints(rect);
            expect(findAnchor(anchors, 'top-right')?.position).toEqual({ x: 200, y: 200 });
        });

        it('has left midpoint at correct y', () => {
            const anchors = getAnchorPoints(rect);
            expect(findAnchor(anchors, 'left')?.position).toEqual({ x: 100, y: 230 });
        });

        it('has center at bounding box center', () => {
            const anchors = getAnchorPoints(rect);
            expect(findAnchor(anchors, 'center')?.position).toEqual({ x: 150, y: 230 });
        });

        it('has right midpoint at correct y', () => {
            const anchors = getAnchorPoints(rect);
            expect(findAnchor(anchors, 'right')?.position).toEqual({ x: 200, y: 230 });
        });

        it('has bottom-left at shape corner', () => {
            const anchors = getAnchorPoints(rect);
            expect(findAnchor(anchors, 'bottom-left')?.position).toEqual({ x: 100, y: 260 });
        });

        it('has bottom midpoint at correct x', () => {
            const anchors = getAnchorPoints(rect);
            expect(findAnchor(anchors, 'bottom')?.position).toEqual({ x: 150, y: 260 });
        });

        it('has bottom-right at shape corner', () => {
            const anchors = getAnchorPoints(rect);
            expect(findAnchor(anchors, 'bottom-right')?.position).toEqual({ x: 200, y: 260 });
        });
    });

    describe('circle', () => {
        /**
         * Circle centered at (50, 50) with radius=30, no stroke padding.
         * Bounding box: minX=20, minY=20, maxX=80, maxY=80.
         */
        const circ = mockCircle(50, 50, 30);

        it('returns 9 anchor points', () => {
            expect(getAnchorPoints(circ)).toHaveLength(9);
        });

        it('has center at circle position', () => {
            const anchors = getAnchorPoints(circ);
            expect(findAnchor(anchors, 'center')?.position).toEqual({ x: 50, y: 50 });
        });

        it('has top at top of bounding box', () => {
            const anchors = getAnchorPoints(circ);
            expect(findAnchor(anchors, 'top')?.position).toEqual({ x: 50, y: 20 });
        });

        it('has left at leftmost edge', () => {
            const anchors = getAnchorPoints(circ);
            expect(findAnchor(anchors, 'left')?.position).toEqual({ x: 20, y: 50 });
        });
    });

    describe('ellipse', () => {
        /**
         * Ellipse centered at (0, 0) with radiusX=40, radiusY=20, no stroke padding.
         * Bounding box: minX=-40, minY=-20, maxX=40, maxY=20.
         */
        const ell = mockEllipse(0, 0, 40, 20);

        it('returns 9 anchor points', () => {
            expect(getAnchorPoints(ell)).toHaveLength(9);
        });

        it('has center at origin', () => {
            const anchors = getAnchorPoints(ell);
            expect(findAnchor(anchors, 'center')?.position).toEqual({ x: 0, y: 0 });
        });

        it('has right at radiusX boundary', () => {
            const anchors = getAnchorPoints(ell);
            expect(findAnchor(anchors, 'right')?.position).toEqual({ x: 40, y: 0 });
        });

        it('has bottom at radiusY boundary', () => {
            const anchors = getAnchorPoints(ell);
            expect(findAnchor(anchors, 'bottom')?.position).toEqual({ x: 0, y: 20 });
        });
    });

    describe('triangle', () => {
        /**
         * Triangle with points (0,0), (100,0), (50,80).
         * Bounding box: minX=0, minY=0, maxX=100, maxY=80.
         */
        const tri = mockTriangle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 });

        it('returns 9 anchor points', () => {
            expect(getAnchorPoints(tri)).toHaveLength(9);
        });

        it('has top-left at bounding box corner', () => {
            const anchors = getAnchorPoints(tri);
            expect(findAnchor(anchors, 'top-left')?.position).toEqual({ x: 0, y: 0 });
        });

        it('has bottom-right at bounding box corner', () => {
            const anchors = getAnchorPoints(tri);
            expect(findAnchor(anchors, 'bottom-right')?.position).toEqual({ x: 100, y: 80 });
        });

        it('has center at bounding box centroid', () => {
            const anchors = getAnchorPoints(tri);
            expect(findAnchor(anchors, 'center')?.position).toEqual({ x: 50, y: 40 });
        });
    });

    describe('line and arrow shapes', () => {
        it('returns empty array for line', () => {
            const line = mockLine(0, 0, 100, 100);
            expect(getAnchorPoints(line)).toHaveLength(0);
        });

        it('returns empty array for arrow', () => {
            const arrow = mockArrow(0, 0, 100, 100);
            expect(getAnchorPoints(arrow)).toHaveLength(0);
        });
    });

    describe('all 9 anchor types are present for rectangle', () => {
        const expectedTypes: AnchorType[] = [
            'top-left', 'top', 'top-right',
            'left', 'center', 'right',
            'bottom-left', 'bottom', 'bottom-right',
        ];

        it('contains every required anchor type', () => {
            const rect = mockRect(0, 0, 200, 100);
            const anchors = getAnchorPoints(rect);
            const types = anchors.map(a => a.type);
            for (const expected of expectedTypes) {
                expect(types).toContain(expected);
            }
        });
    });
});

// --- computeAnchorPosition ---

describe('computeAnchorPosition', () => {
    /**
     * Rectangle at (0, 0) with width=200, height=100.
     * Bounding box: minX=0, minY=0, maxX=200, maxY=100.
     */
    const rect = mockRect(0, 0, 200, 100);

    const cases: [AnchorType, Position][] = [
        ['top-left',     { x: 0,   y: 0   }],
        ['top',          { x: 100, y: 0   }],
        ['top-right',    { x: 200, y: 0   }],
        ['left',         { x: 0,   y: 50  }],
        ['center',       { x: 100, y: 50  }],
        ['right',        { x: 200, y: 50  }],
        ['bottom-left',  { x: 0,   y: 100 }],
        ['bottom',       { x: 100, y: 100 }],
        ['bottom-right', { x: 200, y: 100 }],
    ];

    it.each(cases)('anchor "%s" resolves to correct position', (anchorType, expected) => {
        const pos = computeAnchorPosition(rect, anchorType);
        expect(pos).toEqual(expected);
    });

    it('returns null for a line shape', () => {
        const line = mockLine(0, 0, 100, 100);
        expect(computeAnchorPosition(line, 'center')).toBeNull();
    });

    it('returns null for an arrow shape', () => {
        const arrow = mockArrow(0, 0, 100, 100);
        expect(computeAnchorPosition(arrow, 'center')).toBeNull();
    });
});

// --- findNearestAnchorPoint ---

describe('findNearestAnchorPoint', () => {
    /**
     * Rectangle at (100, 100), width=100, height=60.
     * Bounding box: minX=100, minY=100, maxX=200, maxY=160.
     * 'top' anchor: (150, 100)   'center': (150, 130)
     */
    const rect = mockRect(100, 100, 100, 60);
    const shapes = [rect];
    const THRESHOLD = 40;

    it('finds the nearest anchor within threshold', () => {
        // 5px away from 'top' anchor (150, 100)
        const result = findNearestAnchorPoint({ x: 153, y: 104 }, shapes, THRESHOLD);
        expect(result).not.toBeNull();
        expect(result?.shape.id).toBe('rect-1');
        expect(result?.anchor.type).toBe('top');
    });

    it('returns null when cursor is outside threshold', () => {
        // More than 40px from every anchor
        const result = findNearestAnchorPoint({ x: 400, y: 400 }, shapes, THRESHOLD);
        expect(result).toBeNull();
    });

    it('returns null when shapes array is empty', () => {
        const result = findNearestAnchorPoint({ x: 150, y: 100 }, [], THRESHOLD);
        expect(result).toBeNull();
    });

    it('picks the closest anchor when multiple are within threshold', () => {
        // Exactly at 'top' anchor (150, 100) - 'top' should win over 'top-left' (100, 100) 50px away
        const result = findNearestAnchorPoint({ x: 150, y: 100 }, shapes, THRESHOLD);
        expect(result?.anchor.type).toBe('top');
    });

    it('skips the shape with excludeId', () => {
        // Right on top of the rect's anchor, but the rect is excluded
        const result = findNearestAnchorPoint({ x: 150, y: 100 }, shapes, THRESHOLD, 'rect-1');
        expect(result).toBeNull();
    });

    it('searches across multiple shapes and returns the nearest', () => {
        const rectA = mockRect(0, 0, 100, 100, 'rect-a');   // 'right' anchor at (100, 50)
        const rectB = mockRect(200, 0, 100, 100, 'rect-b'); // 'left' anchor at (200, 50)
        const cursor: Position = { x: 105, y: 50 }; // 5px from rectA 'right', 95px from rectB 'left'
        const result = findNearestAnchorPoint(cursor, [rectA, rectB], THRESHOLD);
        expect(result?.shape.id).toBe('rect-a');
        expect(result?.anchor.type).toBe('right');
    });

    it('line shapes in the shapes array are skipped', () => {
        const line = mockLine(150, 100, 250, 200, 'line-1');
        const result = findNearestAnchorPoint({ x: 150, y: 100 }, [line], THRESHOLD);
        // Lines return no anchors, so result must be null
        expect(result).toBeNull();
    });
});
