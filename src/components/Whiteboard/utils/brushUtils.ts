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
            return { lineCap: 'butt', lineJoin: 'miter', tension: 0, opacity: 1, strokeWidth: size * 2 };
        case BrushType.CALLIGRAPHY_PEN:
            return { lineCap: 'square', lineJoin: 'bevel', tension: 0, opacity: 1, strokeWidth: size, globalCompositeOperation: 'source-over' };
        case BrushType.AIRBRUSH:
            // Simulates spray paint using shadowBlur.
            // Note: Heavy GPU usage due to shadow calculations; performance may degrade with many active strokes.
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.5, strokeWidth: size * 1.5, shadowBlur: 10, shadowColor: color };
        case BrushType.OIL_BRUSH:
            return { lineCap: 'round', lineJoin: 'round', tension: 0.4, opacity: 0.85, strokeWidth: size * 1.8, shadowBlur: 6, shadowColor: color };
        case BrushType.CRAYON:
            // Simulates texture using a dash array, which is significantly more performant than pattern fills.
            return { lineCap: 'butt', lineJoin: 'bevel', tension: 0.1, opacity: 0.75, strokeWidth: size * 1.1, dash: [4, 6] };
        case BrushType.MARKER:
            // Uses 'lighter' globalCompositeOperation for additive blending, creating a neon glow effect on overlapping strokes.
            return { lineCap: 'square', lineJoin: 'miter', tension: 0.2, opacity: 0.4, strokeWidth: size * 3, globalCompositeOperation: 'source-over' };
        case BrushType.NATURAL_PENCIL:
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.7, strokeWidth: Math.max(1, size * 0.7), dash: [1.5, 3] };
        case BrushType.WATERCOLOUR:
            return { lineCap: 'round', lineJoin: 'round', tension: 0.6, opacity: 0.25, strokeWidth: size * 3, shadowBlur: 15, shadowColor: color };
        case BrushType.MAGIC_PENCIL:
            // Rendered by perfect-freehand in <Stroke /> as a filled variable-width polygon.
            // These Konva Line props are stored in Yjs for data consistency but are not used directly.
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 1, strokeWidth: size };
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
