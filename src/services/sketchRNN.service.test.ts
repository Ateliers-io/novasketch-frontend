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

        it('accumulates deltas as absolute coordinates', async () => {
            model.sample.mockReturnValue([5, 10, 0]);

            const pts = makePoints(3);
            const lastInput = pts[pts.length - 1];
            const result = await completeSketch(pts, { numPoints: 2 });

            const firstGenerated = result[pts.length];
            expect(firstGenerated.x).toBe(lastInput.x + 5);
            expect(firstGenerated.y).toBe(lastInput.y + 10);

            const secondGenerated = result[pts.length + 1];
            expect(secondGenerated.x).toBe(lastInput.x + 10);
            expect(secondGenerated.y).toBe(lastInput.y + 20);
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
    });
});
