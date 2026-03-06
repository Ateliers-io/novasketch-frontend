import { describe, it, expect } from 'vitest';

/**
 * Coordinate transformation logic for Frames (Epic 7.5.2)
 */

interface Point {
    x: number;
    y: number;
}

function toRelative(globalPoint: Point, framePoint: Point): Point {
    return {
        x: globalPoint.x - framePoint.x,
        y: globalPoint.y - framePoint.y
    };
}

function toGlobal(relativePoint: Point, framePoint: Point): Point {
    return {
        x: relativePoint.x + framePoint.x,
        y: relativePoint.y + framePoint.y
    };
}

describe('Frame Coordinate Transformations', () => {
    it('should convert global coordinates to relative', () => {
        const framePos = { x: 100, y: 100 };
        const globalPos = { x: 150, y: 150 };
        const relative = toRelative(globalPos, framePos);
        expect(relative).toEqual({ x: 50, y: 50 });
    });

    it('should convert relative coordinates to global', () => {
        const framePos = { x: 100, y: 100 };
        const relativePos = { x: 50, y: 50 };
        const global = toGlobal(relativePos, framePos);
        expect(global).toEqual({ x: 150, y: 150 });
    });

    it('should handle negative offsets', () => {
        const framePos = { x: 100, y: 100 };
        const globalPos = { x: 50, y: 50 };
        const relative = toRelative(globalPos, framePos);
        expect(relative).toEqual({ x: -50, y: -50 });
    });
});
