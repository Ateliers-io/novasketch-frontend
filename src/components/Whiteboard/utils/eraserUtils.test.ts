/**
 * Eraser Utilities Tests
 * 
 * Tests for eraser collision detection and vector logic.
 */

import { describe, it, expect } from 'vitest';
import { isPointInShape, eraseAtPosition, removeStrokesAt } from './eraserUtils';
import { RectangleShape, CircleShape, EllipseShape, LineShape, TriangleShape, ShapeType } from '../../../types/shapes';
import { StrokeLine } from '../../../services/sync.service';

describe('eraserUtils', () => {
    describe('isPointInShape', () => {
        it('should detect point inside rectangle', () => {
            const rect: RectangleShape = {
                id: '1',
                type: ShapeType.RECTANGLE,
                position: { x: 10, y: 10 },
                width: 100,
                height: 100,
                style: { stroke: 'black', strokeWidth: 2, fill: 'none', hasFill: false },
                cornerRadius: 0,
                zIndex: 1, // Corrected from layer
                visible: true,
                createdAt: '', updatedAt: '',
                opacity: 1,
                transform: { rotation: 0, scaleX: 1, scaleY: 1 }
            };

            // Center of rect
            expect(isPointInShape(rect, 60, 60, 5)).toBe(true);
            // Outside
            expect(isPointInShape(rect, 200, 200, 5)).toBe(false);
            // Near edge (within radius)
            expect(isPointInShape(rect, 5, 10, 10)).toBe(true);
        });

        it('should detect point inside circle', () => {
            const circle: CircleShape = {
                id: '2',
                type: ShapeType.CIRCLE,
                position: { x: 100, y: 100 },
                radius: 50,
                style: { stroke: 'black', strokeWidth: 2, fill: 'none', hasFill: false },
                zIndex: 1,
                visible: true,
                createdAt: '', updatedAt: '',
                opacity: 1,
                transform: { rotation: 0, scaleX: 1, scaleY: 1 }
            };

            // Center
            expect(isPointInShape(circle, 100, 100, 5)).toBe(true);
            // Edge
            expect(isPointInShape(circle, 150, 100, 5)).toBe(true);
            // Outside
            expect(isPointInShape(circle, 200, 200, 5)).toBe(false);
        });
    });

    it('should detect point inside ellipse', () => {
        const ellipse: EllipseShape = {
            id: '3', type: ShapeType.ELLIPSE, position: { x: 100, y: 100 }, radiusX: 50, radiusY: 20,
            style: { stroke: 'black', strokeWidth: 2, fill: 'none', hasFill: false },
            zIndex: 1, visible: true, createdAt: '', updatedAt: '', opacity: 1, transform: { rotation: 0, scaleX: 1, scaleY: 1 }
        };
        expect(isPointInShape(ellipse, 100, 100, 5)).toBe(true);
        expect(isPointInShape(ellipse, 140, 100, 5)).toBe(true);
        expect(isPointInShape(ellipse, 100, 150, 5)).toBe(false);
    });

    it('should detect point near line', () => {
        const line: LineShape = {
            id: '4', type: ShapeType.LINE, position: { x: 0, y: 0 }, startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: 100 },
            style: { stroke: 'black', strokeWidth: 2, fill: 'none', hasFill: false },
            zIndex: 1, visible: true, createdAt: '', updatedAt: '', opacity: 1, transform: { rotation: 0, scaleX: 1, scaleY: 1 }
        };
        expect(isPointInShape(line, 50, 50, 5)).toBe(true);
        expect(isPointInShape(line, 0, 50, 5)).toBe(false);
    });

    it('should detect point inside triangle', () => {
        const triangle: TriangleShape = {
            id: '5', type: ShapeType.TRIANGLE, position: { x: 0, y: 0 }, points: [{ x: 50, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
            style: { stroke: 'black', strokeWidth: 2, fill: 'none', hasFill: false },
            zIndex: 1, visible: true, createdAt: '', updatedAt: '', opacity: 1, transform: { rotation: 0, scaleX: 1, scaleY: 1 }
        };
        expect(isPointInShape(triangle, 50, 50, 5)).toBe(true);
    });
});

describe('eraseAtPosition', () => {
    it('should split stroke when erased in the middle', () => {
        const strokes: StrokeLine[] = [{
            id: 's1', points: [0, 0, 10, 0, 20, 0, 30, 0, 40, 0],
            brushType: 'BRUSH', color: 'black', strokeWidth: 2, opacity: 1
        }];
        const result = eraseAtPosition(20, 0, strokes, 5);
        expect(result.length).toBe(2);
        expect(result[0].points).toEqual([0, 0, 10, 0, 15, 0]);
        expect(result[1].points).toEqual([25, 0, 30, 0, 40, 0]);
    });

    it('should remove entire stroke if completely matching eraser', () => {
        const strokes: StrokeLine[] = [{
            id: 's1', points: [20, 0, 22, 0],
            brushType: 'BRUSH', color: 'black', strokeWidth: 2, opacity: 1
        }];
        const result = eraseAtPosition(21, 0, strokes, 5);
        expect(result.length).toBe(0);
    });

    it('should ignore strokes with too few points', () => {
        const strokes: StrokeLine[] = [{
            id: 's1', points: [20, 0],
            brushType: 'BRUSH', color: 'black', strokeWidth: 2, opacity: 1
        }];
        const result = eraseAtPosition(21, 0, strokes, 5);
        expect(result).toEqual(strokes); // unchanged
    });
});

describe('removeStrokesAt', () => {
    it('should remove strokes that intersect with eraser', () => {
        const strokes: StrokeLine[] = [
            { id: 's1', points: [0, 0, 10, 10], brushType: 'BRUSH', color: 'black', strokeWidth: 2, opacity: 1 },
            { id: 's2', points: [100, 100, 110, 110], brushType: 'BRUSH', color: 'black', strokeWidth: 2, opacity: 1 }
        ];
        const result = removeStrokesAt(5, 5, strokes, 10);
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('s2');
    });
});
