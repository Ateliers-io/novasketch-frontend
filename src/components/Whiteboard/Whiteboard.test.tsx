/**
 * Whiteboard Integration Tests
 * 
 * Tests for Whiteboard component high-level interactions:
 * - Rendering
 * - Tool Selection (Brush, Eraser)
 * - Freehand Drawing Simulation (State Updates)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Whiteboard from './Whiteboard';

// Mock Dependencies

// Mock useSync hook - verifying path specific to Whiteboard.tsx import
vi.mock('../../services/useSync', () => ({
    useSync: () => ({
        lines: [],
        shapes: [],
        textAnnotations: [],
        isSynced: true,
        addToHistory: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        setLines: vi.fn(),
        setShapes: vi.fn(),
        setTextAnnotations: vi.fn(),
        clearAll: vi.fn(),
    })
}));

// Mock Toolbar
vi.mock('../Toolbar/Toolbar', () => ({
    default: ({ activeTool, onToolChange }: any) => (
        <div data-testid="toolbar">
            <button
                title="Brush"
                className={activeTool === 'brush' ? 'active' : ''}
                onClick={() => onToolChange('brush')}
            >
                Brush
            </button>
            <button
                title="Eraser"
                className={activeTool === 'eraser' ? 'active' : ''}
                onClick={() => onToolChange('eraser')}
            >
                Eraser
            </button>
        </div>
    ),
    ActiveTool: {},
    EraserMode: {}
}));

// Mock ExportTools
vi.mock('../ExportTools/ExportTools', () => ({
    default: () => <div data-testid="export-tools" />
}));

// Mock SVGShapeRenderer
vi.mock('./SVGShapeRenderer', () => ({
    default: () => <div data-testid="svg-renderer" />
}));

// Mock Konva Stage/Layer/Line (since they use Canvas API)
vi.mock('react-konva', () => ({
    Stage: ({ children, onMouseDown, onMouseMove, onMouseUp, 'data-testid': testId }: any) => (
        <div
            data-testid={testId || 'stage'}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
        >
            {children}
        </div>
    ),
    Layer: ({ children }: any) => <div data-testid="layer">{children}</div>,
    Line: () => <div data-testid="line" />,
    Rect: () => <div data-testid="rect" />,
    Circle: () => <div data-testid="circle" />,
    Text: () => <div data-testid="text" />,
    Group: ({ children }: any) => <div>{children}</div>,
    Image: () => <div />,
    Arrow: () => <div />
}));

// Mock useImage hook
vi.mock('use-image', () => ({
    default: () => [null, 'loaded'],
}));

// Mock hooks
vi.mock('./hooks/useKeyboardShortcuts', () => ({
    useKeyboardShortcuts: vi.fn(),
}));

// Mock utils that might be heavy or rely on DOM
vi.mock('../../utils/boundingBox', () => ({
    getShapeBoundingBox: vi.fn(() => ({ x: 0, y: 0, width: 0, height: 0 })),
    getCombinedBoundingBox: vi.fn(),
    isPointInBoundingBox: vi.fn(),
}));

describe('Whiteboard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderWhiteboard = () => {
        return render(<Whiteboard />);
    };

    it('should render the whiteboard and stage', () => {
        renderWhiteboard();
        expect(screen.getByTestId('main-stage')).toBeInTheDocument();
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    });

    describe('Tool Selection', () => {
        it('should allow switching to Eraser tool', () => {
            renderWhiteboard();
            const eraserBtn = screen.getByTitle('Eraser');
            fireEvent.click(eraserBtn);
            // Check if mock toolbar received the change props if we could spy on it, 
            // but since we render a functional mock, we can check its class if it updates based on props.
            // However, Whiteboard holds state. The mock Toolbar renders class based on `activeTool` prop passed from Whiteboard.
            // So if Whiteboard updates state, Toolbar re-renders with new active tool.
            expect(eraserBtn).toHaveClass('active');
        });

        it('should allow switching to Brush tool', () => {
            renderWhiteboard();
            const brushBtn = screen.getByTitle('Brush');
            fireEvent.click(brushBtn);
            expect(brushBtn).toHaveClass('active');
        });
    });

    describe('Freehand Drawing Interaction', () => {
        it('should handle mouse events on stage', () => {
            renderWhiteboard();
            const stage = screen.getByTestId('main-stage');

            // Just verifying interaction doesn't crash
            fireEvent.mouseDown(stage, { clientX: 100, clientY: 100 });
            fireEvent.mouseMove(stage, { clientX: 110, clientY: 110 });
            fireEvent.mouseUp(stage);

            expect(stage).toBeInTheDocument();
        });
    });
});
