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

        it('should return default to standard brush attributes for unknown types', () => {
            const props = getBrushProperties('UNKNOWN_BRUSH' as BrushType, 5, '#000000');
            expect(props).toHaveProperty('lineCap', 'round');
        });

        it('should return properties for CALLIGRAPHY', () => {
            const props = getBrushProperties(BrushType.CALLIGRAPHY, 5, '#000');
            expect(props.lineCap).toBe('butt');
            expect(props.lineJoin).toBe('bevel');
            expect(props.strokeWidth).toBe(7.5);
        });

        it('should return properties for CALLIGRAPHY_PEN', () => {
            const props = getBrushProperties(BrushType.CALLIGRAPHY_PEN, 5, '#000');
            expect(props.lineCap).toBe('square');
            expect(props.tension).toBe(0);
        });

        it('should return properties for AIRBRUSH', () => {
            const props = getBrushProperties(BrushType.AIRBRUSH, 5, '#123');
            expect(props.shadowBlur).toBe(10);
            expect(props.shadowColor).toBe('#123');
        });

        it('should return properties for OIL_BRUSH', () => {
            const props = getBrushProperties(BrushType.OIL_BRUSH, 5, '#321');
            expect(props.opacity).toBe(0.9);
            expect(props.shadowBlur).toBe(2);
        });

        it('should return properties for NATURAL_PENCIL', () => {
            const props = getBrushProperties(BrushType.NATURAL_PENCIL, 5, '#000');
            expect(props.dash).toEqual([0.5, 0.5]);
            expect(props.strokeWidth).toBe(3);
        });

        it('should return properties for MAGIC_PENCIL', () => {
            const props = getBrushProperties(BrushType.MAGIC_PENCIL, 5, '#000');
            expect(props.lineCap).toBe('round');
            expect(props.lineJoin).toBe('round');
            expect(props.tension).toBe(0.5);
            expect(props.opacity).toBe(1);
            expect(props.strokeWidth).toBe(5);
        });

        it('should scale MAGIC_PENCIL strokeWidth to the exact input size', () => {
            const props = getBrushProperties(BrushType.MAGIC_PENCIL, 12, '#FFF');
            expect(props.strokeWidth).toBe(12);
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
