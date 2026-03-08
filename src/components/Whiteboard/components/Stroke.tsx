/**
 * Stroke.tsx
 *
 * Unified stroke renderer for the Konva Layer.
 * - Standard brushes   → Konva <Line /> with brush-specific props (lineCap, tension, shadowBlur, etc.)
 * - MAGIC_PENCIL brush → Konva <Path /> driven by `perfect-freehand`, which calculates a
 *   variable-width filled polygon outline from raw points, producing Excalidraw-style smoothing.
 *
 * The raw `points` flat-array [x1, y1, x2, y2, …] stored in Yjs is NEVER mutated — the
 * smoothed outline is computed at render time only, so remote clients and undo/redo are
 * always working from the original input data.
 */

import { Path, Line } from 'react-konva';
import { BrushType } from '../../../types/shapes';
import { StrokeLine } from '../../../services/sync.service';
import { getSmoothedStroke, getSvgPathFromStroke } from '../ai/strokeSmoother';

interface StrokeProps {
  line: StrokeLine;
}

export default function Stroke({ line }: StrokeProps) {
  const isMagicPencil = line.brushType === BrushType.MAGIC_PENCIL;

  if (!isMagicPencil) {
    // All other brush types: render as a standard Konva Line.
    // Brush-specific Konva props (shadow, dash, composite op, etc.) are already
    // baked into the StrokeLine object by getBrushProperties() at draw time.
    return (
      <Line
        points={line.points}
        stroke={line.color}
        strokeWidth={line.strokeWidth}
        tension={line.tension ?? 0.5}
        lineCap={line.lineCap ?? 'round'}
        lineJoin={line.lineJoin ?? 'round'}
        opacity={line.opacity ?? 1}
        dash={line.dash}
        globalCompositeOperation={line.globalCompositeOperation as GlobalCompositeOperation}
        shadowBlur={line.shadowBlur}
        shadowColor={line.shadowColor || line.color}
      />
    );
  }

  // MAGIC_PENCIL path:
  // 1. Convert the flat Konva points array [x1,y1,x2,y2,…] to {x,y} objects
  //    that perfect-freehand expects.
  const rawPoints: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < line.points.length; i += 2) {
    rawPoints.push({ x: line.points[i], y: line.points[i + 1] });
  }

  // 2. Generate the stroke outline polygon via perfect-freehand,
  //    then convert it to an SVG path string for Konva <Path />.
  const outlinePoints = getSmoothedStroke(rawPoints);
  const pathData = getSvgPathFromStroke(outlinePoints);

  // 3. Render as a filled closed polygon (fill = color, no stroke).
  //    perfect-freehand produces a self-contained outline shape, so we
  //    use fill rather than stroke to paint it.
  return (
    <Path
      data={pathData}
      fill={line.color}
      opacity={line.opacity ?? 1}
    />
  );
}
