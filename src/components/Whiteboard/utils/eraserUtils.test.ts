/**
 * Eraser Utilities Tests
 * 
 * Tests for eraser collision detection and vector logic.
 */

import { describe, it, expect } from 'vitest';
import { isPointInShape, eraseAtPosition } from './eraserUtils';
import { Shape, RectangleShape, CircleShape, BrushType, ShapeType } from '../../../types/shapes';
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


});
