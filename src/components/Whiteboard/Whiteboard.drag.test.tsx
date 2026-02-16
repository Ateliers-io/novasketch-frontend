import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import Whiteboard from './Whiteboard';
import { ShapeType } from '../../types/shapes';

const {
    mockSetShapes,
    mockSetLines,
    mockSetTexts,
    mockAddToHistory,
    defaultShapes
} = vi.hoisted(() => ({
    mockSetShapes: vi.fn(),
    mockSetLines: vi.fn(),
    mockSetTexts: vi.fn(),
    mockAddToHistory: vi.fn(),
    defaultShapes: [
        {
            id: 'shape-1',
            type: 'rectangle', // ShapeType.RECTANGLE
            position: { x: 100, y: 100 },
            width: 100,
            height: 100,
            style: { stroke: '#000', strokeWidth: 2, hasFill: false },
            transform: { rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: 1,
            visible: true,
            opacity: 1,
        }
    ]
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'test-room' }),
}));

vi.mock('gsap', () => ({
    default: {
        to: vi.fn(),
        from: vi.fn(),
    },
}));

vi.mock('../../services/useSync', () => ({
    useSync: () => ({
        shapes: defaultShapes,
        lines: [],
        textAnnotations: [],
        isConnected: true,
        isLoading: false,
        setShapes: mockSetShapes,
        setLines: mockSetLines,
        setTexts: mockSetTexts,
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        addToHistory: mockAddToHistory,
        addShape: vi.fn(),
        updateShape: vi.fn(),
        deleteShape: vi.fn(),
        clearAll: vi.fn(),
    }),
}));

vi.mock('konva', () => ({
    default: {
        Stage: vi.fn(),
    },
}));

vi.mock('react-konva', () => ({
    Stage: ({ children }: any) => <div>{children}</div>,
    Layer: ({ children }: any) => <div>{children}</div>,
    Line: () => <div data-testid="konva-line" />,
}));


vi.mock('./hooks/useSelectionBounds', () => ({
    useSelectionBounds: ({ selectedShapeIds }: any) => {
        if (selectedShapeIds.has('shape-1')) {
            return { minX: 100, minY: 100, maxX: 200, maxY: 200, x: 100, y: 100, width: 100, height: 100, centerX: 150, centerY: 150 };
        }
        return null;
    },
}));

describe('Whiteboard - Move and Translate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.getBoundingClientRect = vi.fn(() => ({
            width: 1000,
            height: 800,
            top: 0,
            left: 0,
            bottom: 800,
            right: 1000,
            x: 0,
            y: 0,
            toJSON: () => { },
        }));

        vi.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calculates delta and updates object coordinates locally during drag', () => {
        const { container } = render(<Whiteboard />);

        const canvasContainer = container.firstChild as HTMLElement;

        fireEvent.mouseDown(canvasContainer, { clientX: 150, clientY: 150, buttons: 1 });
        fireEvent.mouseUp(canvasContainer);

        fireEvent.mouseDown(canvasContainer, { clientX: 150, clientY: 150, buttons: 1 });

        fireEvent.mouseMove(canvasContainer, { clientX: 200, clientY: 200, buttons: 1 });

        expect(mockSetShapes).toHaveBeenCalled();

        const updater = mockSetShapes.mock.lastCall[0];
        const newShapes = typeof updater === 'function' ? updater(defaultShapes) : updater;

        expect(newShapes[0].position).toEqual({ x: 150, y: 150 });
    });

    it('broadcasts final position update on pointer up', () => {
        const { container } = render(<Whiteboard />);
        const canvasContainer = container.firstChild as HTMLElement;

        fireEvent.mouseDown(canvasContainer, { clientX: 150, clientY: 150, buttons: 1 });
        fireEvent.mouseUp(canvasContainer);

        expect(container.querySelector('[data-resize-handle="n"]')).toBeInTheDocument();

        fireEvent.mouseDown(canvasContainer, { clientX: 150, clientY: 150, buttons: 1 });
        fireEvent.mouseMove(canvasContainer, { clientX: 200, clientY: 200, buttons: 1 });

        fireEvent.mouseUp(canvasContainer);

        expect(console.log).toHaveBeenCalled();
        const logCall = (console.log as any).mock.calls.find((call: any[]) => call[0] === '[Broadcast] Object Update:');
        expect(logCall).toBeTruthy();
        expect(logCall[1]).toMatchObject({
            type: 'move',
            shapes: expect.arrayContaining([
                expect.objectContaining({
                    id: 'shape-1'
                })
            ])
        });
    });
});
