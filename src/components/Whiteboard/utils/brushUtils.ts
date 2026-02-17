// Brush configuration factory.
// Extracted from Whiteboard.tsx to improve maintainability and separate concerns.
import { BrushType, StrokeStyle } from '../../../types/shapes';
import { StrokeLine } from '../../../services/sync.service';

export function getBrushProperties(brush: BrushType, size: number, color: string): Partial<StrokeLine> {
    switch (brush) {
        case BrushType.BRUSH:
            // Standard round cap for consistent, smooth strokes.
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 1, strokeWidth: size };
        case BrushType.CALLIGRAPHY:
            return { lineCap: 'butt', lineJoin: 'bevel', tension: 0.5, opacity: 1, strokeWidth: size * 1.5 };
        case BrushType.CALLIGRAPHY_PEN:
            return { lineCap: 'square', lineJoin: 'bevel', tension: 0, opacity: 1, strokeWidth: size, globalCompositeOperation: 'source-over' };
        case BrushType.AIRBRUSH:
            // Simulates spray paint using shadowBlur.
            // Note: Heavy GPU usage due to shadow calculations; performance may degrade with many active strokes.
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.5, strokeWidth: size * 1.5, shadowBlur: 10, shadowColor: color };
        case BrushType.OIL_BRUSH:
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.9, strokeWidth: size * 1.2, shadowBlur: 2, shadowColor: color };
        case BrushType.CRAYON:
            // Simulates texture using a dash array, which is significantly more performant than pattern fills.
            return { lineCap: 'butt', lineJoin: 'bevel', tension: 0.1, opacity: 0.8, strokeWidth: size, dash: [2, 3] };
        case BrushType.MARKER:
            // Uses 'lighter' globalCompositeOperation for additive blending, creating a neon glow effect on overlapping strokes.
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
