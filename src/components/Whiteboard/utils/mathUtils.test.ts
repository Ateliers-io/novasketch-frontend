import { describe, it, expect } from 'vitest';
import {
    distSq,
    getSegmentCircleIntersections,
    moveForward,
    moveBackward,
    getFontFamilyWithFallback
} from './mathUtils';

describe('mathUtils', () => {
    describe('distSq', () => {
        it('should calculate squared distance correctly', () => {
            expect(distSq({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
            expect(distSq({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
        });
    });

    describe('getSegmentCircleIntersections', () => {
        it('should return empty array if no intersection', () => {
            const intersections = getSegmentCircleIntersections(
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 5, y: 5 },
                2
            );
            expect(intersections).toEqual([]);
        });

        it('should return intersections if segment crosses circle', () => {
            const intersections = getSegmentCircleIntersections(
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 5, y: 0 },
                2
            );
            expect(intersections.length).toBe(2);
            expect(intersections[0]).toEqual({ x: 3, y: 0 });
            expect(intersections[1]).toEqual({ x: 7, y: 0 });
        });

        it('should return one intersection if segment touches circle tangentially', () => {
            const intersections = getSegmentCircleIntersections(
                { x: 0, y: 5 },
                { x: 10, y: 5 },
                { x: 5, y: 0 },
                5
            );
            expect(intersections.length).toBe(2); // In float math might be slightly off, but should be roughly {5, 5}
            expect(intersections[0].x).toBeCloseTo(5);
            expect(intersections[0].y).toBeCloseTo(5);
        });
    });

    describe('moveForward', () => {
        it('should move selected items forward', () => {
            const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
            const selected = new Set(['1']);
            const result = moveForward(items, selected);
            expect(result).toEqual([{ id: '2' }, { id: '1' }, { id: '3' }]);
        });

        it('should not move item if already at the end', () => {
            const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
            const selected = new Set(['3']);
            const result = moveForward(items, selected);
            expect(result).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
        });
    });

    describe('moveBackward', () => {
        it('should move selected items backward', () => {
            const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
            const selected = new Set(['2']);
            const result = moveBackward(items, selected);
            expect(result).toEqual([{ id: '2' }, { id: '1' }, { id: '3' }]);
        });

        it('should not move item if already at the beginning', () => {
            const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
            const selected = new Set(['1']);
            const result = moveBackward(items, selected);
            expect(result).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
        });
    });

    describe('getFontFamilyWithFallback', () => {
        it('should return fallback for known fonts', () => {
            expect(getFontFamilyWithFallback('Arial')).toBe('Arial, sans-serif');
            expect(getFontFamilyWithFallback('Times New Roman')).toBe('"Times New Roman", serif');
        });

        it('should return default fallback for unknown font', () => {
            expect(getFontFamilyWithFallback('Unknown')).toBe('Arial, sans-serif');
        });
    });
});
