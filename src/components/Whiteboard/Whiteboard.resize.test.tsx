import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import Whiteboard from './Whiteboard';

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
            type: 'rectangle',
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

describe('Whiteboard - Resize and Rotate', () => {
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

    it('resizes shape when dragging resize handle', () => {
        const { container } = render(<Whiteboard />);
        const canvasContainer = container.firstChild as HTMLElement;

        // Select shape
        fireEvent.mouseDown(canvasContainer, { clientX: 150, clientY: 150, buttons: 1 });
        fireEvent.mouseUp(canvasContainer);

        // Find and drag 'se' (southeast/bottom-right) handle
        // Bounding box: x:100, y:100, w:100, h:100 -> Bottom-Right is at (200, 200)
        // The mock useSelectionBounds returns a fixed box, but the handles are rendered based on it.
        // We need to simulate clicking THE HANDLE, not just the canvas.
        const seHandle = container.querySelector('[data-resize-handle="se"]');
        expect(seHandle).toBeInTheDocument();

        // Start Resizing
        fireEvent.mouseDown(seHandle!, { clientX: 200, clientY: 200, buttons: 1 });

        // Drag to (250, 250) -> increase size by 50x50
        fireEvent.mouseMove(canvasContainer, { clientX: 250, clientY: 250, buttons: 1 });
        fireEvent.mouseUp(canvasContainer);

        expect(mockSetShapes).toHaveBeenCalled();
        const updater = mockSetShapes.mock.lastCall[0];
        const newShapes = typeof updater === 'function' ? updater(defaultShapes) : updater;

        // Original size 100x100. New size should be larger.
        // Logic: newWidth = x - box.x = 250 - 100 = 150.
        // Expect width to be 150.
        const updatedShape = newShapes.find((s: any) => s.id === 'shape-1');
        expect(updatedShape.width).toBe(150);
        expect(updatedShape.height).toBe(150);
    });

    it('locks aspect ratio when resizing with Shift key', () => {
        const { container } = render(<Whiteboard />);
        const canvasContainer = container.firstChild as HTMLElement;

        fireEvent.mouseDown(canvasContainer, { clientX: 150, clientY: 150, buttons: 1 });
        fireEvent.mouseUp(canvasContainer);

        const seHandle = container.querySelector('[data-resize-handle="se"]');

        fireEvent.mouseDown(seHandle!, { clientX: 200, clientY: 200, buttons: 1 });

        // Move to (250, 220) - disproportionate drag
        // Without shift: w=150, h=120
        // With shift: Ratio 1:1 maintained. 
        // Logic checks if resizing 'se', uses dominant axis or similar logic?
        // Code says: if (resizeHandle === 'se' ...) projectedHeight = newWidth / ratio;
        // if newHeight < projectedHeight -> use projectedHeight.

        // Let's drag wide: w=150 (250-100), h=120 (220-100). Ratio=1.25. target ratio=1.
        // projectedHeight = 150 / 1 = 150.
        // actual h=120. 120 < 150 -> newHeight = 150.
        // So both should be 150.

        fireEvent.mouseMove(canvasContainer, {
            clientX: 250,
            clientY: 220,
            buttons: 1,
            shiftKey: true
        });
        fireEvent.mouseUp(canvasContainer);

        const updater = mockSetShapes.mock.lastCall[0];
        const newShapes = typeof updater === 'function' ? updater(defaultShapes) : updater;
        const updatedShape = newShapes.find((s: any) => s.id === 'shape-1');

        expect(updatedShape.width).toBe(150);
        expect(updatedShape.height).toBe(150);
    });

    it('broadcasts resize update on pointer up', () => {
        const { container } = render(<Whiteboard />);
        const canvasContainer = container.firstChild as HTMLElement;

        fireEvent.mouseDown(canvasContainer, { clientX: 150, clientY: 150, buttons: 1 });
        fireEvent.mouseUp(canvasContainer);

        const seHandle = container.querySelector('[data-resize-handle="se"]');
        fireEvent.mouseDown(seHandle!, { clientX: 200, clientY: 200, buttons: 1 });
        fireEvent.mouseMove(canvasContainer, { clientX: 250, clientY: 250, buttons: 1 });
        fireEvent.mouseUp(canvasContainer);

        expect(console.log).toHaveBeenCalledWith(
            '[Broadcast] Object Update:',
            expect.objectContaining({
                type: 'resize',
                shapes: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'shape-1',
                        // We check if width/height are present in payload
                        width: expect.any(Number),
                        height: expect.any(Number)
                    })
                ])
            })
        );
    });
});
