/**
 * strokeSmoother Tests
 *
 * Tests for the perfect-freehand based stroke smoothing utilities.
 * Covers both getSmoothedStroke (outline generation) and getSvgPathFromStroke (SVG path conversion).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSmoothedStroke, getSvgPathFromStroke } from './strokeSmoother';
import { getStroke } from 'perfect-freehand';

// Mock perfect-freehand to isolate our logic from the library
vi.mock('perfect-freehand', () => ({
    getStroke: vi.fn(() => [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
    ]),
}));

const mockedGetStroke = vi.mocked(getStroke);

describe('strokeSmoother', () => {
    describe('getSmoothedStroke', () => {
        beforeEach(() => {
            mockedGetStroke.mockClear();
        });

        it('should return stroke outline points from raw input', () => {
            const rawPoints = [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
                { x: 10, y: 10 },
            ];

            const result = getSmoothedStroke(rawPoints);

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });

        it('should handle single point input', () => {
            const rawPoints = [{ x: 5, y: 5 }];

            const result = getSmoothedStroke(rawPoints);

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle empty input', () => {
            const result = getSmoothedStroke([]);

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('should use default pressure of 0.5 when not provided', () => {
            const rawPoints = [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ];

            getSmoothedStroke(rawPoints);

            expect(mockedGetStroke).toHaveBeenCalledWith(
                [[0, 0, 0.5], [10, 10, 0.5]],
                expect.objectContaining({
                    size: 8,
                    thinning: 0.5,
                    smoothing: 0.5,
                    streamline: 0.5,
                }),
            );
        });

        it('should pass through pressure values when provided', () => {
            const rawPoints = [
                { x: 0, y: 0, pressure: 0.8 },
                { x: 10, y: 10, pressure: 0.3 },
            ];

            getSmoothedStroke(rawPoints);

            expect(mockedGetStroke).toHaveBeenCalledWith(
                [[0, 0, 0.8], [10, 10, 0.3]],
                expect.any(Object),
            );
        });

        it('should pass correct options to getStroke', () => {
            getSmoothedStroke([{ x: 0, y: 0 }]);

            expect(mockedGetStroke).toHaveBeenCalledWith(
                expect.any(Array),
                {
                    size: 8,
                    thinning: 0.5,
                    smoothing: 0.5,
                    streamline: 0.5,
                },
            );
        });
    });

    describe('getSvgPathFromStroke', () => {
        it('should return empty string for empty input', () => {
            const result = getSvgPathFromStroke([]);
            expect(result).toBe('');
        });

        it('should generate a valid SVG path from stroke points', () => {
            const strokePoints = [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
            ];

            const result = getSvgPathFromStroke(strokePoints);

            // Should start with M (moveTo) and end with Z (closePath)
            expect(result).toMatch(/^M/);
            expect(result).toMatch(/Z$/);
            // Should contain Q (quadratic bezier) commands
            expect(result).toContain('Q');
        });

        it('should handle a single point', () => {
            const strokePoints = [[5, 5]];

            const result = getSvgPathFromStroke(strokePoints);

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(result).toMatch(/^M/);
            expect(result).toMatch(/Z$/);
        });

        it('should handle two points', () => {
            const strokePoints = [
                [0, 0],
                [10, 10],
            ];

            const result = getSvgPathFromStroke(strokePoints);

            expect(result).toBeDefined();
            expect(result).toMatch(/^M/);
            expect(result).toContain('Q');
            expect(result).toMatch(/Z$/);
        });

        it('should produce a path that contains midpoint calculations', () => {
            const strokePoints = [
                [0, 0],
                [20, 0],
                [20, 20],
            ];

            const result = getSvgPathFromStroke(strokePoints);

            // Midpoint between (0,0) and (20,0) is (10,0)
            expect(result).toContain('10');
        });

        it('should wrap around for the last point (modulo)', () => {
            const strokePoints = [
                [0, 0],
                [10, 0],
                [10, 10],
            ];

            const result = getSvgPathFromStroke(strokePoints);

            // The last point wraps around to connect with the first point
            // Midpoint between [10,10] and [0,0] is [5, 5]
            expect(result).toContain('5');
        });
    });

    describe('integration: getSmoothedStroke → getSvgPathFromStroke', () => {
        it('should produce a valid SVG path from raw input points', () => {
            const rawPoints = [
                { x: 0, y: 0 },
                { x: 10, y: 5 },
                { x: 20, y: 0 },
            ];

            const outline = getSmoothedStroke(rawPoints);
            const pathData = getSvgPathFromStroke(outline);

            expect(pathData).toBeDefined();
            expect(pathData.length).toBeGreaterThan(0);
            expect(pathData).toMatch(/^M.*Q.*Z$/);
        });
    });
});
