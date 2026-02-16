import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import Whiteboard from './Whiteboard';

// Mock dependencies
const { mockSetShapes, mockAddToHistory, defaultShapes } = vi.hoisted(() => ({
    mockSetShapes: vi.fn(),
    mockAddToHistory: vi.fn(),
    defaultShapes: [
        {
            id: 'shape-1', // Index 0 (Bottom)
            type: 'rectangle',
            position: { x: 100, y: 100 },
            width: 50,
            height: 50,
            style: { stroke: '#000', strokeWidth: 2, hasFill: false },
            transform: { rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: 0,
            visible: true,
            opacity: 1,
        },
        {
            id: 'shape-2', // Index 1 (Middle)
            type: 'rectangle',
            position: { x: 200, y: 200 },
            width: 50,
            height: 50,
            style: { stroke: '#000', strokeWidth: 2, hasFill: false },
            transform: { rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: 1,
            visible: true,
            opacity: 1,
        },
        {
            id: 'shape-3', // Index 2 (Top)
            type: 'rectangle',
            position: { x: 300, y: 300 },
            width: 50,
            height: 50,
            style: { stroke: '#000', strokeWidth: 2, hasFill: false },
            transform: { rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: 2,
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
        setLines: vi.fn(),
        setTexts: vi.fn(),
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

// Mock useSelectionBounds to ensure selection works visually (triggers toolbar update)
vi.mock('./hooks/useSelectionBounds', () => ({
    useSelectionBounds: ({ selectedShapeIds }: any) => {
        if (selectedShapeIds.size > 0) {
            return { minX: 0, minY: 0, maxX: 100, maxY: 100, x: 0, y: 0, width: 100, height: 100, centerX: 50, centerY: 50 };
        }
        return null;
    },
}));

describe('Whiteboard - Z-Index Layers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock getBoundingClientRect for hit testing
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

    it('brings shape forward when "Bring Forward" is clicked', () => {
        const { container, getByText, getByTitle } = render(<Whiteboard />);
        const canvasContainer = container.firstChild as HTMLElement;

        // 1. Select Shape 1 (Bottom, index 0). Position (100, 100)
        fireEvent.mouseDown(canvasContainer, { clientX: 100, clientY: 100, buttons: 1 });
        fireEvent.mouseUp(canvasContainer);

        // Verify "Bring Forward" button is visible (Layers section)
        // Toolbar buttons usually have 'title' attributes or accessible names.
        // Looking at Toolbar.tsx: label="Bring Forward". Title might be same.
        // Wait, ToolButton title uses label. "Bring Forward" is the label passed.
        // let's check exact text or title.
        const bringForwardBtn = screen.getByTitle('Bring Forward');
        expect(bringForwardBtn).toBeInTheDocument();

        // 2. Click "Bring Forward"
        fireEvent.click(bringForwardBtn);

        // 3. Verify setShapes call
        // Initial: [S1, S2, S3]
        // Move S1 forward -> Swap with S2 -> [S2, S1, S3]
        expect(mockSetShapes).toHaveBeenCalled();
        const updater = mockSetShapes.mock.lastCall[0];
        // updater is likely arrays or function returning array because we mocked it as vi.fn()
        // but implementation calls setShapes(newShapes) directly with array for layers
        // Let's check.
        // handleBringForward -> setShapes(newShapes). It passes the array directly.

        // Wait, the hook re-implementation might wrap it?
        // In Whiteboard.tsx: 
        // const setShapes = useCallback((updater) => { ... syncSetShapes(updater) ... })
        // syncSetShapes comes from useSync mock.
        // The mock implementation we wrote does pass it through.

        // However, handleBringForward calls setShapes(newShapes) directly.
        // So the argument to mockSetShapes should be the new array.

        // Let's verify if it's a function or value.
        // In Whiteboard.tsx: `if (newShapes !== shapes) setShapes(newShapes);`
        // So it's a value.

        // BUT wait, Whiteboard.tsx wraps setShapes:
        // const setShapes = useCallback((updater) ... => syncSetShapes(newShapes) ...
        // So the mockSetShapes (which is syncSetShapes in our mock) receives the FINAL array.

        const newShapes = updater; // Should be the array

        expect(newShapes[0].id).toBe('shape-2');
        expect(newShapes[1].id).toBe('shape-1');
        expect(newShapes[2].id).toBe('shape-3');
    });

    it('sends shape backward when "Send Backward" is clicked', () => {
        const { container } = render(<Whiteboard />);
        const canvasContainer = container.firstChild as HTMLElement;

        // 1. Select Shape 2 (Middle, index 1). Position (200, 200)
        fireEvent.mouseDown(canvasContainer, { clientX: 200, clientY: 200, buttons: 1 });
        fireEvent.mouseUp(canvasContainer);

        const sendBackwardBtn = screen.getByTitle('Send Backward');
        expect(sendBackwardBtn).toBeInTheDocument();

        // 2. Click "Send Backward"
        fireEvent.click(sendBackwardBtn);

        // 3. Verify setShapes call
        // Initial: [S1, S2, S3]
        // Move S2 backward -> Swap with S1 -> [S2, S1, S3] -- WAIT.
        // S2 is at index 1. S1 at 0.
        // Move S2 backward -> S2 goes to index 0. S1 goes to index 1.
        // Result: [S2, S1, S3].
        // Wait, moveBackward logic:
        // for i=1..len. if curr is selected and prev is not, swap.
        // i=1 (S2). Selected. Prev (S1) not. Swap.
        // Result: [S2, S1, S3].

        // Let's try sending Shape 3 (Top) Backward.
        // Index 2.
        // i=1 (S2 not sel). i=2 (S3 sel). Prev (S2) not. Swap.
        // Result: [S1, S3, S2].

        // Let's use Shape 2 backward for the test.
        // Expect [S2, S1, S3].

        expect(mockSetShapes).toHaveBeenCalled();
        const newShapes = mockSetShapes.mock.lastCall[0];

        expect(newShapes[0].id).toBe('shape-2');
        expect(newShapes[1].id).toBe('shape-1');
        expect(newShapes[2].id).toBe('shape-3');
    });

    it('broadcasts layer reorder event', () => {
        const { container } = render(<Whiteboard />);
        const canvasContainer = container.firstChild as HTMLElement;

        // Select Shape 1
        fireEvent.mouseDown(canvasContainer, { clientX: 100, clientY: 100, buttons: 1 });
        fireEvent.mouseUp(canvasContainer);

        const bringForwardBtn = screen.getByTitle('Bring Forward');
        fireEvent.click(bringForwardBtn);

        expect(console.log).toHaveBeenCalledWith(
            '[Broadcast] Layer Reorder:',
            expect.objectContaining({
                type: 'LAYER_REORDER',
                shapeOrder: expect.arrayContaining(['shape-1', 'shape-2', 'shape-3'])
            })
        );

        // Specifically check the order in the broadcast
        const logCall = (console.log as any).mock.calls.find((call: any[]) => call[0] === '[Broadcast] Layer Reorder:');
        const payload = logCall[1];
        expect(payload.shapeOrder).toEqual(['shape-2', 'shape-1', 'shape-3']);
    });
});
