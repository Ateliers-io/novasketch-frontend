import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSelectionBounds } from './useSelectionBounds';
import { Shape, ShapeType } from '../../../types/shapes';
import { StrokeLine } from '../../../services/sync.service';
import { TextAnnotation } from '../types';

describe('useSelectionBounds', () => {
    it('should return null when nothing is selected', () => {
        const { result } = renderHook((props: any) => useSelectionBounds(props), {
            initialProps: {
                selectedShapeIds: new Set(),
                selectedLineIds: new Set(),
                selectedTextIds: new Set(),
                shapes: [],
                lines: [],
                textAnnotations: [],
                isDragging: false
            }
        });

        expect(result.current).toBeNull();
    });

    it('should compute bounds for a selected shape (frame/rectangle)', () => {
        const shapes: Shape[] = [
            {
                id: 'shape-1',
                type: ShapeType.RECTANGLE,
                position: { x: 50, y: 50 },
                width: 100,
                height: 100,
                transform: { rotation: 0, scaleX: 1, scaleY: 1 }
            } as Shape
        ];

        const { result } = renderHook((props: any) => useSelectionBounds(props), {
            initialProps: {
                selectedShapeIds: new Set(['shape-1']),
                selectedLineIds: new Set(),
                selectedTextIds: new Set(),
                shapes,
                lines: [],
                textAnnotations: [],
                isDragging: false
            }
        });

        expect(result.current).toBeTruthy();
        expect(result.current?.minX).toBe(50);
        expect(result.current?.minY).toBe(50);
        expect(result.current?.maxX).toBe(150);
        expect(result.current?.maxY).toBe(150);
    });

    it('should compute bounds for a shape inside a transformed frame (parent scaling)', () => {
        const shapes: Shape[] = [
            {
                id: 'frame-1',
                type: ShapeType.FRAME,
                position: { x: 10, y: 10 },
                width: 200,
                height: 200,
                transform: { rotation: 0, scaleX: 2, scaleY: 2 }
            } as Shape,
            {
                id: 'shape-2',
                parentId: 'frame-1',
                type: ShapeType.RECTANGLE,
                position: { x: 10, y: 10 },
                width: 50,
                height: 50,
                transform: { rotation: 0, scaleX: 1, scaleY: 1 }
            } as Shape
        ];

        const { result } = renderHook((props: any) => useSelectionBounds(props), {
            initialProps: {
                selectedShapeIds: new Set(['shape-2']),
                selectedLineIds: new Set(),
                selectedTextIds: new Set(),
                shapes,
                lines: [],
                textAnnotations: [],
                isDragging: false
            }
        });

        expect(result.current).toBeTruthy();
        expect(result.current?.minX).toBe(30);
        expect(result.current?.minY).toBe(30);
        expect(result.current?.maxX).toBe(130);
        expect(result.current?.maxY).toBe(130);
    });

    it('should compute bounds for lines', () => {
        const lines: StrokeLine[] = [
            {
                id: 'line-1',
                points: [0, 0, 10, 10, 20, 5],
                color: '#fff',
                strokeWidth: 2
            } as StrokeLine
        ];

        const { result } = renderHook((props: any) => useSelectionBounds(props), {
            initialProps: {
                selectedShapeIds: new Set(),
                selectedLineIds: new Set(['line-1']),
                selectedTextIds: new Set(),
                shapes: [],
                lines,
                textAnnotations: [],
                isDragging: false
            }
        });

        expect(result.current).toBeTruthy();
        expect(result.current?.minX).toBe(0);
        expect(result.current?.minY).toBe(0);
        expect(result.current?.maxX).toBe(20);
        expect(result.current?.maxY).toBe(10);
    });

    it('should compute bounds for text', () => {
        const textAnnotations: TextAnnotation[] = [
            {
                id: 'text-1',
                text: 'Hello',
                x: 100,
                y: 100,
                fontSize: 20,
                color: '#fff'
            } as TextAnnotation
        ];

        const { result } = renderHook((props: any) => useSelectionBounds(props), {
            initialProps: {
                selectedShapeIds: new Set(),
                selectedLineIds: new Set(),
                selectedTextIds: new Set(['text-1']),
                shapes: [],
                lines: [],
                textAnnotations,
                isDragging: false
            }
        });

        expect(result.current).toBeTruthy();
        expect(result.current?.minX).toBe(100);
        expect(result.current?.minY).toBe(100);
        expect(result.current?.maxX).toBe(160);
        expect(result.current?.maxY).toBe(124);
    });

    it('should freeze bounds during freeze/drag to prevent jitter', () => {
        const shapes: Shape[] = [
            {
                id: 'shape-1',
                type: ShapeType.RECTANGLE,
                position: { x: 50, y: 50 },
                width: 100,
                height: 100,
                transform: { rotation: 0, scaleX: 1, scaleY: 1 }
            } as Shape
        ];

        const initialProps = {
            selectedShapeIds: new Set(['shape-1']),
            selectedLineIds: new Set(),
            selectedTextIds: new Set(),
            shapes,
            lines: [],
            textAnnotations: [],
            isDragging: true
        };

        const { result, rerender } = renderHook((props: any) => useSelectionBounds(props), {
            initialProps
        });

        // Initial render while dragging returns null or last state (null here)
        expect(result.current).toBeNull();

        // Turn dragging off to compute bounds
        rerender({ ...initialProps, isDragging: false });
        expect(result.current?.minX).toBe(50);

        // Turn dragging back on, change shape pos, should still be 50
        const updatedShapes = [
            {
                ...shapes[0],
                position: { x: 200, y: 200 }
            } as Shape
        ];

        rerender({ ...initialProps, shapes: updatedShapes, isDragging: true });
        // Since isDragging is true, bounds don't update to the new shapes
        expect(result.current?.minX).toBe(50);
    });
});
