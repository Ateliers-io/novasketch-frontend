/**
 * Stroke Component Tests
 *
 * Tests for the unified stroke renderer that handles both standard Konva Lines
 * and Magic Pencil (perfect-freehand) strokes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import Stroke from './Stroke';
import { BrushType } from '../../../types/shapes';
import type { StrokeLine } from '../../../services/sync.service';
import { getSmoothedStroke, getSvgPathFromStroke } from '../ai/strokeSmoother';

// Mock react-konva components since they need a canvas context
vi.mock('react-konva', () => ({
    Line: (props: Record<string, unknown>) => React.createElement('konva-line', props),
    Path: (props: Record<string, unknown>) => React.createElement('konva-path', props),
    Shape: (props: Record<string, unknown>) => React.createElement('konva-shape', props),
    Group: ({ children, ...props }: Record<string, unknown>) => React.createElement('konva-group', props, children as React.ReactNode),
}));

// Mock the stroke smoother
vi.mock('../ai/strokeSmoother', () => ({
    getSmoothedStroke: vi.fn(() => [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
    ]),
    getSvgPathFromStroke: vi.fn(() => 'M 0 0 Q 10 0 5 0 10 0 Q 10 10 10 5 10 10 Q 0 10 5 10 0 10 Q 0 0 0 5 Z'),
}));

const mockedGetSmoothedStroke = vi.mocked(getSmoothedStroke);
const mockedGetSvgPathFromStroke = vi.mocked(getSvgPathFromStroke);

const makeStrokeLine = (overrides: Partial<StrokeLine> = {}): StrokeLine => ({
    id: 'stroke-1',
    points: [0, 0, 10, 10, 20, 5],
    color: '#FF0000',
    strokeWidth: 4,
    ...overrides,
});

describe('Stroke Component', () => {
    describe('Standard brush rendering (non-magic-pencil)', () => {
        it('should render a Konva Line for standard BRUSH type', () => {
            const line = makeStrokeLine({ brushType: BrushType.BRUSH });

            const { container } = render(<Stroke line={line} />);

            const konvaLine = container.querySelector('konva-line');
            expect(konvaLine).toBeTruthy();
            expect(container.querySelector('konva-path')).toBeNull();
        });

        it('should pass all line properties to Konva Line', () => {
            const line = makeStrokeLine({
                brushType: BrushType.BRUSH,
                color: '#00FF00',
                strokeWidth: 8,
                tension: 0.3,
                lineCap: 'butt',
                lineJoin: 'bevel',
                opacity: 0.7,
                dash: [5, 3],
                shadowBlur: 10,
                shadowColor: '#0000FF',
            });

            const { container } = render(<Stroke line={line} />);

            const konvaLine = container.querySelector('konva-line');
            expect(konvaLine).toBeTruthy();
            expect(konvaLine?.getAttribute('stroke')).toBe('#00FF00');
            expect(konvaLine?.getAttribute('strokewidth')).toBe('8');
            expect(konvaLine?.getAttribute('tension')).toBe('0.3');
            expect(konvaLine?.getAttribute('linecap')).toBe('butt');
            expect(konvaLine?.getAttribute('linejoin')).toBe('bevel');
            expect(konvaLine?.getAttribute('opacity')).toBe('0.7');
            expect(konvaLine?.getAttribute('shadowblur')).toBe('10');
            expect(konvaLine?.getAttribute('shadowcolor')).toBe('#0000FF');
        });

        it('should use default values when optional props are undefined', () => {
            const line = makeStrokeLine({
                brushType: BrushType.BRUSH,
                tension: undefined,
                lineCap: undefined,
                lineJoin: undefined,
                opacity: undefined,
            });

            const { container } = render(<Stroke line={line} />);

            const konvaLine = container.querySelector('konva-line');
            expect(konvaLine).toBeTruthy();
            // Defaults: tension 0.5, lineCap round, lineJoin round, opacity 1
            expect(konvaLine?.getAttribute('tension')).toBe('0.5');
            expect(konvaLine?.getAttribute('linecap')).toBe('round');
            expect(konvaLine?.getAttribute('linejoin')).toBe('round');
            expect(konvaLine?.getAttribute('opacity')).toBe('1');
        });

        it('should use line color as shadow color fallback', () => {
            const line = makeStrokeLine({
                brushType: BrushType.BRUSH,
                color: '#FF00FF',
                shadowColor: undefined,
            });

            const { container } = render(<Stroke line={line} />);

            const konvaLine = container.querySelector('konva-line');
            expect(konvaLine?.getAttribute('shadowcolor')).toBe('#FF00FF');
        });

        it('should render Shape for CALLIGRAPHY brush', () => {
            const line = makeStrokeLine({ brushType: BrushType.CALLIGRAPHY });
            const { container } = render(<Stroke line={line} />);
            expect(container.querySelector('konva-shape')).toBeTruthy();
        });

        it('should render Line for MARKER brush', () => {
            const line = makeStrokeLine({ brushType: BrushType.MARKER });
            const { container } = render(<Stroke line={line} />);
            expect(container.querySelector('konva-line')).toBeTruthy();
        });

        it('should render Line for WATERCOLOUR brush', () => {
            const line = makeStrokeLine({ brushType: BrushType.WATERCOLOUR });
            const { container } = render(<Stroke line={line} />);
            expect(container.querySelector('konva-line')).toBeTruthy();
        });

        it('should render Line when brushType is undefined', () => {
            const line = makeStrokeLine({ brushType: undefined });
            const { container } = render(<Stroke line={line} />);
            expect(container.querySelector('konva-line')).toBeTruthy();
            expect(container.querySelector('konva-path')).toBeNull();
        });
    });

    describe('Magic Pencil rendering', () => {
        beforeEach(() => {
            mockedGetSmoothedStroke.mockClear();
            mockedGetSvgPathFromStroke.mockClear();
        });

        it('should render a Konva Path for MAGIC_PENCIL brush', () => {
            const line = makeStrokeLine({ brushType: BrushType.MAGIC_PENCIL });

            const { container } = render(<Stroke line={line} />);

            const konvaPath = container.querySelector('konva-path');
            expect(konvaPath).toBeTruthy();
            expect(container.querySelector('konva-line')).toBeNull();
        });

        it('should use fill with the line color (not stroke)', () => {
            const line = makeStrokeLine({
                brushType: BrushType.MAGIC_PENCIL,
                color: '#3B82F6',
            });

            const { container } = render(<Stroke line={line} />);

            const konvaPath = container.querySelector('konva-path');
            expect(konvaPath?.getAttribute('fill')).toBe('#3B82F6');
        });

        it('should pass opacity to the Path', () => {
            const line = makeStrokeLine({
                brushType: BrushType.MAGIC_PENCIL,
                opacity: 0.6,
            });

            const { container } = render(<Stroke line={line} />);

            const konvaPath = container.querySelector('konva-path');
            expect(konvaPath?.getAttribute('opacity')).toBe('0.6');
        });

        it('should use default opacity of 1 when not specified', () => {
            const line = makeStrokeLine({
                brushType: BrushType.MAGIC_PENCIL,
                opacity: undefined,
            });

            const { container } = render(<Stroke line={line} />);

            const konvaPath = container.querySelector('konva-path');
            expect(konvaPath?.getAttribute('opacity')).toBe('1');
        });

        it('should call getSmoothedStroke and getSvgPathFromStroke', () => {
            const line = makeStrokeLine({
                brushType: BrushType.MAGIC_PENCIL,
                points: [0, 0, 10, 10, 20, 5],
            });

            render(<Stroke line={line} />);

            expect(mockedGetSmoothedStroke).toHaveBeenCalledWith([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 5 },
            ]);
            expect(mockedGetSvgPathFromStroke).toHaveBeenCalled();
        });

        it('should correctly convert flat points array to {x,y} objects', () => {
            const line = makeStrokeLine({
                brushType: BrushType.MAGIC_PENCIL,
                points: [100, 200, 300, 400],
            });

            render(<Stroke line={line} />);

            expect(mockedGetSmoothedStroke).toHaveBeenCalledWith([
                { x: 100, y: 200 },
                { x: 300, y: 400 },
            ]);
        });

        it('should handle odd number of points gracefully', () => {
            const line = makeStrokeLine({
                brushType: BrushType.MAGIC_PENCIL,
                points: [0, 0, 10, 10, 20], // 5 elements — last one has no y pair
            });

            // Should not throw
            const { container } = render(<Stroke line={line} />);
            expect(container.querySelector('konva-path')).toBeTruthy();
        });

        it('should handle empty points array', () => {
            const line = makeStrokeLine({
                brushType: BrushType.MAGIC_PENCIL,
                points: [],
            });

            const { container } = render(<Stroke line={line} />);
            expect(container.querySelector('konva-path')).toBeTruthy();
        });

        it('should set the SVG path data on the Path element', () => {
            const line = makeStrokeLine({ brushType: BrushType.MAGIC_PENCIL });

            const { container } = render(<Stroke line={line} />);

            const konvaPath = container.querySelector('konva-path');
            expect(konvaPath?.getAttribute('data')).toBeTruthy();
            expect(konvaPath?.getAttribute('data')?.length).toBeGreaterThan(0);
        });
    });

    describe('Sketch-RNN rendering', () => {
        beforeEach(() => {
            mockedGetSmoothedStroke.mockClear();
            mockedGetSvgPathFromStroke.mockClear();
        });

        it('should render a Group with two Paths for SKETCH_RNN brush', () => {
            const line = makeStrokeLine({ brushType: BrushType.SKETCH_RNN });

            const { container } = render(<Stroke line={line} />);

            const group = container.querySelector('konva-group');
            expect(group).toBeTruthy();
            const paths = group?.querySelectorAll('konva-path');
            expect(paths?.length).toBe(2);
        });

        it('should render the fill path with 0.7x opacity', () => {
            const line = makeStrokeLine({
                brushType: BrushType.SKETCH_RNN,
                color: '#FF0000',
                opacity: 1,
            });

            const { container } = render(<Stroke line={line} />);

            const paths = container.querySelectorAll('konva-path');
            const fillPath = paths[0];
            expect(fillPath?.getAttribute('fill')).toBe('#FF0000');
            expect(fillPath?.getAttribute('opacity')).toBe('0.7');
        });

        it('should render the outline path with stroke and low opacity', () => {
            const line = makeStrokeLine({
                brushType: BrushType.SKETCH_RNN,
                color: '#00FF00',
            });

            const { container } = render(<Stroke line={line} />);

            const paths = container.querySelectorAll('konva-path');
            const outlinePath = paths[1];
            expect(outlinePath?.getAttribute('stroke')).toBe('#00FF00');
            expect(outlinePath?.getAttribute('strokewidth')).toBe('1');
            expect(outlinePath?.getAttribute('opacity')).toBe('0.3');
        });

        it('should use default opacity when not specified', () => {
            const line = makeStrokeLine({
                brushType: BrushType.SKETCH_RNN,
                opacity: undefined,
            });

            const { container } = render(<Stroke line={line} />);

            const fillPath = container.querySelectorAll('konva-path')[0];
            expect(fillPath?.getAttribute('opacity')).toBe('0.7');
        });

        it('should call getSmoothedStroke and getSvgPathFromStroke', () => {
            const line = makeStrokeLine({
                brushType: BrushType.SKETCH_RNN,
                points: [0, 0, 10, 10, 20, 5],
            });

            render(<Stroke line={line} />);

            expect(mockedGetSmoothedStroke).toHaveBeenCalledWith([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 5 },
            ]);
            expect(mockedGetSvgPathFromStroke).toHaveBeenCalled();
        });

        it('should not render a Konva Line', () => {
            const line = makeStrokeLine({ brushType: BrushType.SKETCH_RNN });

            const { container } = render(<Stroke line={line} />);

            expect(container.querySelector('konva-line')).toBeNull();
        });
    });
});
