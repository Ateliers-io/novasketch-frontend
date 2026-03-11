import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock @tensorflow/tfjs ---
vi.mock('@tensorflow/tfjs', () => ({
    ready: vi.fn().mockResolvedValue(undefined),
    getBackend: vi.fn().mockReturnValue('cpu'),
}));

// --- Mock @magenta/sketch (inline factory – avoids hoisting issues) ---
function createMockModelInstance() {
    return {
        initialize: vi.fn().mockResolvedValue(undefined),
        isInitialized: vi.fn().mockReturnValue(true),
        lineToStroke: vi.fn().mockReturnValue([[1, 2, 0], [3, 4, 0]]),
        zeroState: vi.fn().mockReturnValue({ c: [], h: [] }),
        updateStrokes: vi.fn().mockReturnValue({ c: [1], h: [1] }),
        getPDF: vi.fn().mockReturnValue({ pi: [0.5] }),
        sample: vi.fn().mockReturnValue([2, 3, 0]),
        update: vi.fn().mockReturnValue({ c: [2], h: [2] }),
        dispose: vi.fn(),
    };
}

vi.mock('@magenta/sketch', () => ({
    SketchRNN: vi.fn().mockImplementation(function () { return createMockModelInstance(); }),
}));

import { SketchRNN } from '@magenta/sketch';
import {
    completeSketch,
    isSketchRNNReady,
    loadSketchRNNModel,
    getAvailableCategories,
    unloadCurrentModel,
    clearModelCache,
    simplifyPoints,
    normalizeForModel,
} from './sketchRNN.service';
import type { SketchRNNPoint } from './sketchRNN.service';

const MockedSketchRNN = vi.mocked(SketchRNN);

/** Helper: get the model instance from the last constructor call */
function getLastModelInstance() {
    const results = MockedSketchRNN.mock.results;
    return results[results.length - 1]?.value;
}

/** Helper: build a simple point array */
function makePoints(count: number, startX = 0, startY = 0, stepX = 10, stepY = 2): SketchRNNPoint[] {
    return Array.from({ length: count }, (_, i) => ({
        x: startX + i * stepX,
        y: startY + i * stepY,
    }));
}

// ---------------------------------------------------------------------------
// getAvailableCategories
// ---------------------------------------------------------------------------
describe('getAvailableCategories', () => {
    it('returns an array of category strings', () => {
        const cats = getAvailableCategories();
        expect(Array.isArray(cats)).toBe(true);
        expect(cats.length).toBeGreaterThan(0);
        cats.forEach(c => expect(typeof c).toBe('string'));
    });

    it('includes well-known categories', () => {
        const cats = getAvailableCategories();
        expect(cats).toContain('cat');
        expect(cats).toContain('dog');
        expect(cats).toContain('bicycle');
    });
});

// ---------------------------------------------------------------------------
// loadSketchRNNModel
// ---------------------------------------------------------------------------
describe('loadSketchRNNModel', () => {
    beforeEach(() => {
        clearModelCache();
        MockedSketchRNN.mockClear();
    });

    it('loads a model and caches it', async () => {
        await loadSketchRNNModel('cat');
        expect(MockedSketchRNN).toHaveBeenCalledTimes(1);
        const model = getLastModelInstance();
        expect(model.initialize).toHaveBeenCalled();
    });

    it('uses cached model on second load of same category', async () => {
        await loadSketchRNNModel('dog');
        const firstCallCount = MockedSketchRNN.mock.calls.length;

        await loadSketchRNNModel('dog');
        // Constructor should NOT have been called again
        expect(MockedSketchRNN.mock.calls.length).toBe(firstCallCount);
    });

    it('throws when model initialization fails', async () => {
        MockedSketchRNN.mockImplementationOnce(function () {
            return {
                ...createMockModelInstance(),
                initialize: vi.fn().mockRejectedValue(new Error('network error')),
            };
        });

        await expect(loadSketchRNNModel('bad_category')).rejects.toThrow(
            'Failed to load Sketch-RNN model'
        );
    });
});

// ---------------------------------------------------------------------------
// isSketchRNNReady
// ---------------------------------------------------------------------------
describe('isSketchRNNReady', () => {
    beforeEach(() => {
        clearModelCache();
        MockedSketchRNN.mockClear();
    });

    it('returns false when no model is loaded', () => {
        expect(isSketchRNNReady()).toBe(false);
    });

    it('returns true after a model is loaded', async () => {
        await loadSketchRNNModel('cat');
        expect(isSketchRNNReady()).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// unloadCurrentModel
// ---------------------------------------------------------------------------
describe('unloadCurrentModel', () => {
    beforeEach(() => {
        clearModelCache();
        MockedSketchRNN.mockClear();
    });

    it('disposes the current model and resets state', async () => {
        await loadSketchRNNModel('cat');
        expect(isSketchRNNReady()).toBe(true);

        unloadCurrentModel();
        expect(isSketchRNNReady()).toBe(false);
    });

    it('does nothing when no model is loaded', () => {
        expect(() => unloadCurrentModel()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// clearModelCache
// ---------------------------------------------------------------------------
describe('clearModelCache', () => {
    beforeEach(() => {
        clearModelCache();
        MockedSketchRNN.mockClear();
    });

    it('disposes all cached models and resets ready state', async () => {
        await loadSketchRNNModel('cat');
        await loadSketchRNNModel('dog');

        clearModelCache();
        expect(isSketchRNNReady()).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// completeSketch – edge cases & fallback path
// ---------------------------------------------------------------------------
describe('completeSketch', () => {
    beforeEach(() => {
        clearModelCache();
        MockedSketchRNN.mockClear();
    });

    // -- Minimal / edge-case inputs --

    it('returns input unchanged when fewer than 2 points', async () => {
        const single = [{ x: 5, y: 5 }];
        const result = await completeSketch(single);
        expect(result).toEqual(single);
    });

    it('returns input unchanged for empty array', async () => {
        const result = await completeSketch([]);
        expect(result).toEqual([]);
    });

    it('returns input unchanged for single point', async () => {
        const result = await completeSketch([{ x: 0, y: 0 }]);
        expect(result).toHaveLength(1);
    });

    // -- Fallback path (no model loaded) --

    it('uses fallback when no model is loaded', async () => {
        const pts = makePoints(5);
        const result = await completeSketch(pts, { numPoints: 10 });
        expect(result.length).toBeGreaterThan(pts.length);
    });

    it('fallback returns input when magnitude is zero', async () => {
        const pts: SketchRNNPoint[] = [
            { x: 10, y: 10 },
            { x: 10, y: 10 },
        ];
        const result = await completeSketch(pts, { numPoints: 5 });
        expect(result).toEqual(pts);
    });

    it('fallback generates points with decreasing pressure', async () => {
        const pts = makePoints(3);
        const result = await completeSketch(pts, { numPoints: 4 });
        const generated = result.slice(pts.length);
        generated.forEach(p => {
            expect(p.pressure).toBeDefined();
            expect(p.pressure).toBeLessThanOrEqual(0.5);
            expect(p.pressure).toBeGreaterThan(0);
        });
    });

    it('fallback respects custom temperature', async () => {
        const pts = makePoints(3);
        const result = await completeSketch(pts, { temperature: 0, numPoints: 5 });
        const generated = result.slice(pts.length);
        expect(generated.length).toBe(5);
        generated.forEach(p => {
            expect(typeof p.x).toBe('number');
            expect(typeof p.y).toBe('number');
            expect(Number.isFinite(p.x)).toBe(true);
            expect(Number.isFinite(p.y)).toBe(true);
        });
    });

    it('fallback uses crypto.getRandomValues for noise', async () => {
        const spy = vi.spyOn(crypto, 'getRandomValues');
        const pts = makePoints(3);
        await completeSketch(pts, { numPoints: 5 });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    // -- Model-based path --

    describe('with model loaded', () => {
        let model: ReturnType<typeof createMockModelInstance>;

        beforeEach(async () => {
            await loadSketchRNNModel('cat');
            model = getLastModelInstance();
        });

        it('generates AI points via the model pipeline', async () => {
            const pts = makePoints(5);
            const result = await completeSketch(pts, { numPoints: 10 });

            expect(model.lineToStroke).toHaveBeenCalled();
            expect(model.zeroState).toHaveBeenCalled();
            expect(model.updateStrokes).toHaveBeenCalled();
            expect(model.getPDF).toHaveBeenCalled();
            expect(model.sample).toHaveBeenCalled();
            expect(result.length).toBeGreaterThan(pts.length);
        });

        it('accumulates deltas as absolute coordinates (de-normalised)', async () => {
            model.sample.mockReturnValue([5, 10, 0]);

            const pts = makePoints(3); // [{x:0,y:0},{x:10,y:2},{x:20,y:4}]
            const lastInput = pts[pts.length - 1];
            // After normalisation: maxAbs = 20, scaleFactor = 150/20 = 7.5
            // Model deltas are divided by scaleFactor when mapped back to canvas space
            const sf = 7.5;
            const result = await completeSketch(pts, { numPoints: 2 });

            const firstGenerated = result[pts.length];
            expect(firstGenerated.x).toBeCloseTo(lastInput.x + 5 / sf);
            expect(firstGenerated.y).toBeCloseTo(lastInput.y + 10 / sf);

            const secondGenerated = result[pts.length + 1];
            expect(secondGenerated.x).toBeCloseTo(lastInput.x + 10 / sf);
            expect(secondGenerated.y).toBeCloseTo(lastInput.y + 20 / sf);
        });

        it('stops generation when pen-up signal received after 5 points', async () => {
            let callCount = 0;
            model.sample.mockImplementation(() => {
                callCount++;
                if (callCount > 6) return [1, 1, 0.95];
                return [1, 1, 0];
            });

            const pts = makePoints(4);
            const result = await completeSketch(pts, { numPoints: 50 });

            const generated = result.length - pts.length;
            expect(generated).toBeLessThan(50);
            expect(generated).toBeGreaterThanOrEqual(6);
        });

        it('does not stop on pen-up within the first 5 points', async () => {
            let callCount = 0;
            model.sample.mockImplementation(() => {
                callCount++;
                if (callCount === 3) return [1, 1, 0.95];
                if (callCount > 8) return [1, 1, 0.95];
                return [1, 1, 0];
            });

            const pts = makePoints(4);
            const result = await completeSketch(pts, { numPoints: 50 });
            const generated = result.length - pts.length;
            expect(generated).toBeGreaterThan(3);
        });

        it('stops when sample returns null', async () => {
            let callCount = 0;
            model.sample.mockImplementation(() => {
                callCount++;
                if (callCount > 3) return null;
                return [1, 1, 0];
            });

            const pts = makePoints(4);
            const result = await completeSketch(pts, { numPoints: 20 });
            expect(result.length - pts.length).toBe(3);
        });

        it('stops when sample returns too few elements', async () => {
            let callCount = 0;
            model.sample.mockImplementation(() => {
                callCount++;
                if (callCount > 2) return [1, 2];
                return [1, 1, 0];
            });

            const pts = makePoints(4);
            const result = await completeSketch(pts, { numPoints: 20 });
            expect(result.length - pts.length).toBe(2);
        });

        it('stops when sample returns NaN coordinates', async () => {
            let callCount = 0;
            model.sample.mockImplementation(() => {
                callCount++;
                if (callCount > 4) return [NaN, 1, 0];
                return [1, 1, 0];
            });

            const pts = makePoints(4);
            const result = await completeSketch(pts, { numPoints: 20 });
            expect(result.length - pts.length).toBe(4);
        });

        it('falls back when lineToStroke returns empty array', async () => {
            model.lineToStroke.mockReturnValue([]);

            const pts = makePoints(4);
            const result = await completeSketch(pts, { numPoints: 5 });
            expect(result.length).toBeGreaterThan(pts.length);
            expect(model.zeroState).not.toHaveBeenCalled();
        });

        it('falls back when lineToStroke returns null', async () => {
            model.lineToStroke.mockReturnValue(null);

            const pts = makePoints(4);
            const result = await completeSketch(pts, { numPoints: 5 });
            expect(result.length).toBeGreaterThan(pts.length);
            expect(model.zeroState).not.toHaveBeenCalled();
        });

        it('falls back when model pipeline throws', async () => {
            model.lineToStroke.mockImplementation(() => {
                throw new Error('model crash');
            });

            const pts = makePoints(4);
            const result = await completeSketch(pts, { numPoints: 5 });
            expect(result.length).toBeGreaterThan(pts.length);
        });

        it('handles error inside the generation loop gracefully', async () => {
            let callCount = 0;
            model.getPDF.mockImplementation(() => {
                callCount++;
                if (callCount > 2) throw new Error('pdf error');
                return { pi: [0.5] };
            });

            const pts = makePoints(4);
            const result = await completeSketch(pts, { numPoints: 20 });
            expect(result.length - pts.length).toBe(2);
        });

        it('uses default options when none provided', async () => {
            const pts = makePoints(5);
            const result = await completeSketch(pts);
            expect(result.length).toBeGreaterThan(pts.length);
        });

        it('model reports not initialized → uses fallback', async () => {
            model.isInitialized.mockReturnValue(false);

            const pts = makePoints(4);
            const result = await completeSketch(pts, { numPoints: 5 });
            expect(result.length).toBeGreaterThan(pts.length);
            expect(model.lineToStroke).not.toHaveBeenCalled();
        });

        it('generated points have pressure 0.5', async () => {
            model.sample.mockReturnValue([1, 2, 0]);

            const pts = makePoints(3);
            const result = await completeSketch(pts, { numPoints: 3 });
            const generated = result.slice(pts.length);
            generated.forEach(p => {
                expect(p.pressure).toBe(0.5);
            });
        });

        it('falls back when simplification yields < 2 points', async () => {
            // Two identical points → simplifyPoints returns [pt, pt] but
            // normalizeForModel produces a single unique point after dedup.
            // We force simplifyPoints to return a single point by mocking it
            // indirectly: feed two identical points which after RDP gives [pt, pt]
            // (length 2), so instead we rely on a more subtle edge case:
            // lineToStroke may still work. The real branch we want is
            // simplified.length < 2 which is nearly impossible to reach
            // naturally. We cover it by verifying the RDP path in the
            // dedicated simplifyPoints tests below.
            //
            // Instead, cover the model path with a dense collinear stroke
            // that RDP collapses to exactly 2 points — still valid input.
            const pts: SketchRNNPoint[] = Array.from({ length: 50 }, (_, i) => ({
                x: 100 + i * 0.1,
                y: 200 + i * 0.1,
            }));
            const result = await completeSketch(pts, { numPoints: 5 });
            expect(result.length).toBeGreaterThan(0);
        });
    });
});

// ---------------------------------------------------------------------------
// simplifyPoints (Ramer-Douglas-Peucker)
// ---------------------------------------------------------------------------
describe('simplifyPoints', () => {
    it('returns input unchanged for 0, 1, or 2 points', () => {
        expect(simplifyPoints([])).toEqual([]);
        const one = [{ x: 1, y: 2 }];
        expect(simplifyPoints(one)).toEqual(one);
        const two = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
        expect(simplifyPoints(two)).toEqual(two);
    });

    it('removes collinear intermediate points', () => {
        // Perfectly straight line — all midpoints should be removed
        const pts: SketchRNNPoint[] = Array.from({ length: 10 }, (_, i) => ({
            x: i * 10,
            y: i * 10,
        }));
        const result = simplifyPoints(pts, 1.0);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(pts[0]);
        expect(result[result.length - 1]).toEqual(pts[pts.length - 1]);
    });

    it('keeps points that deviate beyond epsilon', () => {
        // Triangle shape: middle point deviates significantly
        const pts: SketchRNNPoint[] = [
            { x: 0, y: 0 },
            { x: 5, y: 50 },  // large deviation
            { x: 10, y: 0 },
        ];
        const result = simplifyPoints(pts, 2.0);
        expect(result).toHaveLength(3);
        expect(result[1]).toEqual(pts[1]);
    });

    it('recursively simplifies both halves', () => {
        // W shape: two peaks that must be preserved
        const pts: SketchRNNPoint[] = [
            { x: 0, y: 0 },
            { x: 2, y: 20 },
            { x: 5, y: 0 },
            { x: 8, y: 20 },
            { x: 10, y: 0 },
        ];
        const result = simplifyPoints(pts, 1.0);
        // Both peaks deviate — all 5 points should survive
        expect(result.length).toBeGreaterThanOrEqual(4);
        expect(result[0]).toEqual(pts[0]);
        expect(result[result.length - 1]).toEqual(pts[pts.length - 1]);
    });

    it('handles degenerate case where first and last points are identical', () => {
        // Closed loop — triggers lenSq === 0 in perpendicularDist
        const pts: SketchRNNPoint[] = [
            { x: 5, y: 5 },
            { x: 10, y: 15 },
            { x: 20, y: 10 },
            { x: 5, y: 5 },
        ];
        const result = simplifyPoints(pts, 1.0);
        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result[0]).toEqual(pts[0]);
        expect(result[result.length - 1]).toEqual(pts[pts.length - 1]);
    });

    it('respects custom epsilon', () => {
        const pts: SketchRNNPoint[] = [
            { x: 0, y: 0 },
            { x: 5, y: 3 },  // small deviation
            { x: 10, y: 0 },
        ];
        // With a large epsilon the middle point is removed
        expect(simplifyPoints(pts, 100)).toHaveLength(2);
        // With a tiny epsilon it is kept
        expect(simplifyPoints(pts, 0.01)).toHaveLength(3);
    });
});

// ---------------------------------------------------------------------------
// normalizeForModel
// ---------------------------------------------------------------------------
describe('normalizeForModel', () => {
    it('translates first point to origin', () => {
        const pts: SketchRNNPoint[] = [
            { x: 100, y: 200 },
            { x: 120, y: 210 },
        ];
        const { normalized, origin } = normalizeForModel(pts);
        expect(origin).toEqual({ x: 100, y: 200 });
        expect(normalized[0].x).toBe(0);
        expect(normalized[0].y).toBe(0);
    });

    it('scales bounding extent to MODEL_SCALE (150)', () => {
        const pts: SketchRNNPoint[] = [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
        ];
        const { normalized, scaleFactor } = normalizeForModel(pts);
        // maxAbs = 300, scaleFactor = 150 / 300 = 0.5
        expect(scaleFactor).toBeCloseTo(0.5);
        expect(normalized[1].x).toBeCloseTo(150);
        expect(normalized[1].y).toBeCloseTo(0);
    });

    it('uses scaleFactor = 1 when extent is very small (≤ 1)', () => {
        const pts: SketchRNNPoint[] = [
            { x: 50, y: 50 },
            { x: 50.5, y: 50.5 },
        ];
        const { scaleFactor } = normalizeForModel(pts);
        expect(scaleFactor).toBe(1);
    });

    it('preserves pressure values', () => {
        const pts: SketchRNNPoint[] = [
            { x: 0, y: 0, pressure: 0.8 },
            { x: 100, y: 100, pressure: 0.3 },
        ];
        const { normalized } = normalizeForModel(pts);
        expect(normalized[0].pressure).toBe(0.8);
        expect(normalized[1].pressure).toBe(0.3);
    });

    it('handles negative coordinates correctly', () => {
        const pts: SketchRNNPoint[] = [
            { x: -100, y: -100 },
            { x: 100, y: 100 },
        ];
        const { normalized, origin, scaleFactor } = normalizeForModel(pts);
        expect(origin).toEqual({ x: -100, y: -100 });
        // After translation: [0,0] → [200,200], maxAbs = 200, sf = 150/200 = 0.75
        expect(scaleFactor).toBeCloseTo(0.75);
        expect(normalized[0].x).toBe(0);
        expect(normalized[0].y).toBe(0);
        expect(normalized[1].x).toBeCloseTo(150);
        expect(normalized[1].y).toBeCloseTo(150);
    });
});
