import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import Whiteboard from './Whiteboard';

// Mock dependencies
const { mockUndo, mockRedo } = vi.hoisted(() => ({
    mockUndo: vi.fn(),
    mockRedo: vi.fn(),
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

// Default mock values for useSync
let mockCanUndo = false;
let mockCanRedo = false;

vi.mock('../../services/useSync', () => ({
    useSync: () => ({
        shapes: [],
        lines: [],
        textAnnotations: [],
        isConnected: true,
        isLoading: false,
        setShapes: vi.fn(),
        setLines: vi.fn(),
        setTexts: vi.fn(),
        undo: mockUndo,
        redo: mockRedo,
        canUndo: mockCanUndo,
        canRedo: mockCanRedo,
        addToHistory: vi.fn(),
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
    useSelectionBounds: () => null,
}));

describe('Whiteboard - Undo/Redo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset default states
        mockCanUndo = false;
        mockCanRedo = false;

        // Mock getBoundingClientRect
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
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('triggers undo when Undo button is clicked', () => {
        // Enable undo
        mockCanUndo = true; // This won't dynamically update the mock in real-time for *this* render if we rely on module-level var, 
        // but since we render *inside* the test, and the mock factory is hoisted, we need a way to control it.
        // Actually, vi.mock is hoisted, so changing `mockCanUndo` variable *after* hoisting might not affect the mock 
        // if the mock function captured the value at hoist time.
        // However, we used a function `() => ({ ... canUndo: mockCanUndo })` in the mock factory.
        // Since `useSync` is called *during* render, it should read the current value of `mockCanUndo`.

        const { getByTitle } = render(<Whiteboard />);
        const undoBtn = getByTitle(/Undo/i); // "Undo (Ctrl+Z)"

        expect(undoBtn).toBeEnabled();
        fireEvent.click(undoBtn);

        expect(mockUndo).toHaveBeenCalledTimes(1);
    });

    it('triggers redo when Redo button is clicked', () => {
        mockCanRedo = true;
        const { getByTitle } = render(<Whiteboard />);
        const redoBtn = getByTitle(/Redo/i); // "Redo (Ctrl+Y)"

        expect(redoBtn).toBeEnabled();
        fireEvent.click(redoBtn);

        expect(mockRedo).toHaveBeenCalledTimes(1);
    });

    it('triggers undo on Ctrl+Z', () => {
        render(<Whiteboard />);

        fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
        expect(mockUndo).toHaveBeenCalledTimes(1);
    });

    it('triggers redo on Ctrl+Y', () => {
        render(<Whiteboard />);

        fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
        expect(mockRedo).toHaveBeenCalledTimes(1);
    });

    it('triggers redo on Ctrl+Shift+Z', () => {
        render(<Whiteboard />);

        fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
        expect(mockRedo).toHaveBeenCalledTimes(1);
    });

    it('disables Undo button when history is empty', () => {
        mockCanUndo = false;
        const { getByTitle } = render(<Whiteboard />);
        const undoBtn = getByTitle(/Undo/i);

        expect(undoBtn).toBeDisabled();
    });

    it('disables Redo button when redo stack is empty', () => {
        mockCanRedo = false;
        const { getByTitle } = render(<Whiteboard />);
        const redoBtn = getByTitle(/Redo/i);

        expect(redoBtn).toBeDisabled();
    });
});
