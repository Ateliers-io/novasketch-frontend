/**
 * Brush properties and stroke dash array helpers.
 * Extracted from Whiteboard.tsx (lines 720-751).
 */
import { BrushType, StrokeStyle } from '../../../types/shapes';
import { StrokeLine } from '../../../services/sync.service';

export function getBrushProperties(brush: BrushType, size: number, color: string): Partial<StrokeLine> {
    switch (brush) {
        case BrushType.BRUSH:
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 1, strokeWidth: size };
        case BrushType.CALLIGRAPHY:
            return { lineCap: 'butt', lineJoin: 'bevel', tension: 0.5, opacity: 1, strokeWidth: size * 1.5 };
        case BrushType.CALLIGRAPHY_PEN:
            return { lineCap: 'square', lineJoin: 'bevel', tension: 0, opacity: 1, strokeWidth: size, globalCompositeOperation: 'source-over' };
        case BrushType.AIRBRUSH:
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.5, strokeWidth: size * 1.5, shadowBlur: 10, shadowColor: color };
        case BrushType.OIL_BRUSH:
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.9, strokeWidth: size * 1.2, shadowBlur: 2, shadowColor: color };
        case BrushType.CRAYON:
            return { lineCap: 'butt', lineJoin: 'bevel', tension: 0.1, opacity: 0.8, strokeWidth: size, dash: [2, 3] };
        case BrushType.MARKER:
            return { lineCap: 'square', lineJoin: 'miter', tension: 0.2, opacity: 0.6, strokeWidth: size * 3, globalCompositeOperation: 'lighter' }; // Additive blend for neon marker on dark bg
        case BrushType.NATURAL_PENCIL:
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.8, strokeWidth: Math.max(1, size * 0.6), dash: [0.5, 0.5] }; // textured look
        case BrushType.WATERCOLOUR:
            return { lineCap: 'round', lineJoin: 'round', tension: 0.6, opacity: 0.3, strokeWidth: size * 2.5, shadowBlur: 5, shadowColor: color };
        default:
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 1, strokeWidth: size };
    }
}

export function getStrokeDashArray(style: StrokeStyle, strokeWidth: number): number[] | undefined {
    switch (style) {
        case 'dashed': return [strokeWidth * 4, strokeWidth * 2];
        case 'dotted': return [strokeWidth, strokeWidth * 2];
        case 'solid': default: return undefined;
    }
}
