/**
 * Brush Utilities Tests
 * 
 * Tests for brush configuration and stroke style helpers.
 */

import { describe, it, expect } from 'vitest';
import { getBrushProperties, getStrokeDashArray } from './brushUtils';
import { BrushType } from '../../../types/shapes';

describe('brushUtils', () => {
    describe('getBrushProperties', () => {
        it('should return correct properties for standard BRUSH', () => {
            const props = getBrushProperties(BrushType.BRUSH, 5, '#000000');
            expect(props).toEqual({
                lineCap: 'round',
                lineJoin: 'round',
                tension: 0.5,
                opacity: 1,
                strokeWidth: 5,
            });
        });

        it('should return transparent opacity for WATERCOLOUR', () => {
            const props = getBrushProperties(BrushType.WATERCOLOUR, 10, '#FF0000');
            expect(props.opacity).toBe(0.3);
            expect(props.shadowColor).toBe('#FF0000');
        });

        it('should return dashed line for CRAYON', () => {
            const props = getBrushProperties(BrushType.CRAYON, 5, '#000000');
            expect(props.dash).toEqual([2, 3]);
        });

        it('should use lighter composite operation for MARKER', () => {
            const props = getBrushProperties(BrushType.MARKER, 5, '#00FFFF');
            expect(props.globalCompositeOperation).toBe('lighter');
        });

        it('should default to standard brush attributes for unknown types', () => {
            const props = getBrushProperties('UNKNOWN_BRUSH' as BrushType, 5, '#000000');
            expect(props).toHaveProperty('lineCap', 'round');
        });
    });

    describe('getStrokeDashArray', () => {
        it('should return undefined for solid lines', () => {
            expect(getStrokeDashArray('solid', 5)).toBeUndefined();
        });

        it('should return correct array for dashed lines', () => {
            expect(getStrokeDashArray('dashed', 2)).toEqual([8, 4]); // [width*4, width*2]
        });

        it('should return correct array for dotted lines', () => {
            expect(getStrokeDashArray('dotted', 5)).toEqual([5, 10]); // [width, width*2]
        });
    });
});
