/**
 * Stroke.tsx: Unified stroke renderer for the Konva Layer.
 *
 * Render strategy by brush type:
 * - MAGIC_PENCIL      -> Konva <Path /> via `perfect-freehand` (variable-width filled polygon)
 * - CALLIGRAPHY /
 *   CRAYON            - Konva <Shape sceneFunc> — angle-based variable-width polygon per segment,
 *                        simulating a flat nib whose stoke width varies with direction.
 * - AIRBRUSH          -> Konva <Shape sceneFunc> — scatter dots sprayed around each point,
 *                        producing a realistic spray-paint cloud effect.
 * - OIL_BRUSH         -> Konva <Group> of three layered <Line>s (wide base → narrow highlight)
 * - CALLIGRAPHY_PEN   -> Konva <Group> of three <Line>s with staggered dash arrays for waxy texture
 * - All others        -> Konva <Line /> with brush-specific props from getBrushProperties()
 *
 * The raw `points` flat-array [x1, y1, x2, y2, …] stored in Yjs is NEVER mutated — all
 * effects are computed at render time only so undo/redo and remote clients remain consistent.
 */

import { Path, Line, Shape, Group } from 'react-konva';
import { BrushType } from '../../../types/shapes';
import { StrokeLine } from '../../../services/sync.service';
import { getSmoothedStroke, getSvgPathFromStroke } from '../ai/strokeSmoother';

interface StrokeProps {
  line: StrokeLine;
}

// ---------------------------------------------------------------------------
// CALLIGRAPHY: angle-based variable-width nib
// ---------------------------------------------------------------------------
// Simulates a flat calligraphy pen held at a fixed 45 degree angle. The stroke width
// varies continuously: maximum (thick) when moving perpendicular to the nib
// angle, minimum (thin) when moving parallel to it.
function CalligraphyStroke({ line }: StrokeProps) {
  const { points, color, strokeWidth = 8, opacity = 1 } = line;
  const isPen = line.brushType === BrushType.CRAYON;
  const maxW = isPen ? strokeWidth * 1.5 : strokeWidth * 3;
  const minW = isPen ? strokeWidth * 0.2  : strokeWidth * 0.25;
  const PEN_ANGLE = -Math.PI / 4; // 45 degree nib bearing

  return (
    <Shape
      opacity={opacity}
      strokeEnabled={false}
      listening={false}
      sceneFunc={(ctx) => {
        const native = (ctx as any)._context as CanvasRenderingContext2D;
        native.save();
        native.fillStyle = color;

        for (let i = 0; i < points.length - 3; i += 2) {
          const x1 = points[i],     y1 = points[i + 1];
          const x2 = points[i + 2], y2 = points[i + 3];
          const segAngle = Math.atan2(y2 - y1, x2 - x1);

          // Width proportional to how perpendicular the stroke is to the nib angle
          const t = Math.abs(Math.sin(segAngle - PEN_ANGLE));
          const halfW = (minW + (maxW - minW) * t) / 2;

          const perpX = Math.sin(segAngle) * halfW;
          const perpY = -Math.cos(segAngle) * halfW;

          native.beginPath();
          native.moveTo(x1 + perpX, y1 + perpY);
          native.lineTo(x2 + perpX, y2 + perpY);
          native.lineTo(x2 - perpX, y2 - perpY);
          native.lineTo(x1 - perpX, y1 - perpY);
          native.closePath();
          native.fill();
        }

        native.restore();
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// AIRBRUSH: scatter-dot spray cloud
// ---------------------------------------------------------------------------
// For each recorded point, a cluster of tiny dots is drawn within a circular
// spray radius. Dot positions are seeded deterministically from the point
// coordinates so the same stroke always renders identically (reproducible
// across re-renders, remote clients, and undo/redo).
function AirbrushStroke({ line }: StrokeProps) {
  const { points, color, strokeWidth = 10, opacity = 0.4 } = line;
  const sprayRadius = strokeWidth * 2.5;
  const dotsPerPoint = Math.max(8, Math.floor(sprayRadius * 1.2));

  return (
    <Shape
      strokeEnabled={false}
      listening={false}
      sceneFunc={(ctx) => {
        const native = (ctx as any)._context as CanvasRenderingContext2D;
        native.save();
        native.fillStyle = color;

        // Simple deterministic LCG seeded per-point
        let seed = 1;
        const rand = () => {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };

        for (let i = 0; i < points.length - 1; i += 2) {
          const px = points[i], py = points[i + 1];
          // Seed is derived from the point position so it's stable across re-renders
          seed = Math.abs(Math.floor(px * 1000 + py * 997) & 0x7fffffff) + i * 13 + 1;

          for (let d = 0; d < dotsPerPoint; d++) {
            const angle = rand() * Math.PI * 2;
            // sqrt gives uniform distribution across the circle area
            const dist  = Math.sqrt(rand()) * sprayRadius;
            const dotX  = px + Math.cos(angle) * dist;
            const dotY  = py + Math.sin(angle) * dist;
            const dotR  = rand() * 1.8 + 0.3;
            // Dots at the edge of the radius are more transparent (soft falloff)
            const dotOpacity = Math.pow(1 - dist / sprayRadius, 1.5) * opacity;

            native.globalAlpha = Math.max(0, Math.min(1, dotOpacity));
            native.beginPath();
            native.arc(dotX, dotY, dotR, 0, Math.PI * 2);
            native.fill();
          }
        }

        native.globalAlpha = 1;
        native.restore();
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// OIL BRUSH: layered semi-transparent Lines
// ---------------------------------------------------------------------------
// Three concentric Line passes with decreasing width and increasing opacity
// give the visual weight and depth of thick oil paint without a shadow glow.
function OilBrushStroke({ line }: StrokeProps) {
  const { points, color, strokeWidth = 12 } = line;
  const w = strokeWidth;
  return (
    <Group listening={false}>
      <Line points={points} stroke={color} strokeWidth={w * 2.5} tension={0.5}
            lineCap="round" lineJoin="round" opacity={0.12} />
      <Line points={points} stroke={color} strokeWidth={w * 1.6} tension={0.5}
            lineCap="round" lineJoin="round" opacity={0.28} />
      <Line points={points} stroke={color} strokeWidth={w * 0.85} tension={0.5}
            lineCap="round" lineJoin="round" opacity={0.9} />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// CRAYON: multi-layer waxy textured stroke
// ---------------------------------------------------------------------------
// Three Line passes with different stroke widths and staggered dash arrays
// reproduce the broken, fibrous texture of a wax crayon.
function CrayonStroke({ line }: StrokeProps) {
  const { points, color, strokeWidth = 8 } = line;
  const w = strokeWidth * 1.5;
  return (
    <Group listening={false}>
      {/* Wide base with large gaps */}
      <Line points={points} stroke={color} strokeWidth={w}       tension={0.2}
            lineCap="round" lineJoin="round" opacity={0.45}
            dash={[w * 0.6, w * 0.3, w * 1.0, w * 0.25]} />
      {/* Mid layer */}
      <Line points={points} stroke={color} strokeWidth={w * 0.55} tension={0.25}
            lineCap="round" lineJoin="round" opacity={0.6}
            dash={[w * 0.4, w * 0.5, w * 0.8, w * 0.35]} />
      {/* Thin highlight - sharpest edge fibres */}
      <Line points={points} stroke={color} strokeWidth={w * 0.25} tension={0.3}
            lineCap="round" lineJoin="round" opacity={0.8}
            dash={[w * 0.2, w * 0.7, w * 0.5, w * 0.45]} />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Main Stroke component: dispatcher
// ---------------------------------------------------------------------------
export default function Stroke({ line }: StrokeProps) {
  // MAGIC_PENCIL: perfect-freehand variable-width filled polygon ---
  if (line.brushType === BrushType.MAGIC_PENCIL) {
    const rawPoints: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < line.points.length; i += 2) {
      rawPoints.push({ x: line.points[i], y: line.points[i + 1] });
    }
    const outlinePoints = getSmoothedStroke(rawPoints);
    const pathData = getSvgPathFromStroke(outlinePoints);
    return <Path data={pathData} fill={line.color} opacity={line.opacity ?? 1} />;
  }

  // --- CALLIGRAPHY / CRAYON: angle-based nib ---
  if (line.brushType === BrushType.CALLIGRAPHY || line.brushType === BrushType.CRAYON) {
    return <CalligraphyStroke line={line} />;
  }

  // --- AIRBRUSH: scatter-dot spray ---
  if (line.brushType === BrushType.AIRBRUSH) {
    return <AirbrushStroke line={line} />;
  }

  // --- OIL BRUSH: layered depth ---
  if (line.brushType === BrushType.OIL_BRUSH) {
    return <OilBrushStroke line={line} />;
  }

  // --- CALLIGRAPHY_PEN: waxy multi-layer texture ---
  if (line.brushType === BrushType.CALLIGRAPHY_PEN) {
    return <CrayonStroke line={line} />;
  }

  // --- All other brushes: standard Konva Line ---
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
