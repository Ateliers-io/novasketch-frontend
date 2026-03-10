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
            // Actual rendering: angle-based variable-width polygon via sceneFunc in <Stroke />.
            // strokeWidth stored for data consistency; sceneFunc derives min/max width from it.
            return { lineCap: 'butt', lineJoin: 'miter', tension: 0, opacity: 1, strokeWidth: size * 3 };
        case BrushType.CALLIGRAPHY_PEN:
            // Actual rendering: multi-layer textured Lines via Group in <Stroke />.
            return { lineCap: 'round', lineJoin: 'round', tension: 0.2, opacity: 0.8, strokeWidth: size * 1.5 };
        case BrushType.AIRBRUSH:
            // Actual rendering: scatter-dot spray via sceneFunc in <Stroke />.
            // strokeWidth drives the spray radius; opacity controls dot density.
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.4, strokeWidth: size * 2.5 };
        case BrushType.OIL_BRUSH:
            // Actual rendering: layered semi-transparent Lines via Group in <Stroke />.
            // No shadowBlur. oil paint is opaque and matte, not glowing.
            return { lineCap: 'round', lineJoin: 'round', tension: 0.5, opacity: 0.9, strokeWidth: size * 2 };
        case BrushType.CRAYON:
            // Thinner nib variant of calligraphy; rendered with angle-based sceneFunc in <Stroke />.
            return { lineCap: 'butt', lineJoin: 'bevel', tension: 0.1, opacity: 1, strokeWidth: size * 1.2 };
        case BrushType.MARKER:
            // Wide chisel tip: bold, mostly opaque, flat square cap.
            return { lineCap: 'square', lineJoin: 'miter', tension: 0.1, opacity: 0.85, strokeWidth: size * 4, globalCompositeOperation: 'source-over' };
        case BrushType.NATURAL_PENCIL:
            // Fine graphite: thin, slightly textured via dash.
            return { lineCap: 'round', lineJoin: 'round', tension: 0.4, opacity: 0.65, strokeWidth: Math.max(1, size * 0.45), dash: [2, 2] };
        case BrushType.WATERCOLOUR:
            // Very wide, very transparent, highly diffuse wash.
            return { lineCap: 'round', lineJoin: 'round', tension: 0.8, opacity: 0.1, strokeWidth: size * 6, shadowBlur: 30, shadowColor: color };
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
