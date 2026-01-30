import { Stage, Layer, Line, Rect, Circle } from 'react-konva';
import { useRef, useState, useEffect } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import Toolbar from '../Toolbar';
import './Whiteboard.css';
import {
  ToolType,
  Shape,
  ShapeType,
  createRectangle,
  createCircle,
  Position,
} from '../../types/shapes';
import SVGShapeRenderer from './SVGShapeRenderer';

const GRID_SIZE = 40;
const GRID_COLOR = '#e0e0e0';
const STROKE_TENSION = 0.4;
const MIN_POINT_DISTANCE = 3;
const DEFAULT_BRUSH_SIZE = 3;
const DEFAULT_STROKE_COLOR = '#000000';

interface StrokeLine {
  id: string;
  points: number[];
  color: string;
  strokeWidth: number;
}

interface GridProps {
  width: number;
  height: number;
}

function Grid({ width, height }: GridProps) {
  const lines = [];

  for (let x = 0; x <= width; x += GRID_SIZE) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, height]}
        stroke={GRID_COLOR}
        strokeWidth={1}
      />
    );
  }

  for (let y = 0; y <= height; y += GRID_SIZE) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}
        stroke={GRID_COLOR}
        strokeWidth={1}
      />
    );
  }

  return <>{lines}</>;
}

export default function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const [lines, setLines] = useState<StrokeLine[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.PEN);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [fillColor, setFillColor] = useState('#3B82F6');

  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [previewShape, setPreviewShape] = useState<Shape | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  const handleShapeClick = (shape: Shape) => {
    if (activeTool === ToolType.SELECT) {
      setSelectedShapeId(shape.id);
    }
  };

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isShapeTool = (tool: ToolType) => {
    return tool === ToolType.RECTANGLE || tool === ToolType.CIRCLE;
  };

  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    setIsDrawing(true);

    if (isShapeTool(activeTool)) {
      setDragStart({ x: pos.x, y: pos.y });

      if (activeTool === ToolType.RECTANGLE) {
        const rect = createRectangle(pos.x, pos.y, 0, 0, {
          style: {
            fill: fillColor,
            hasFill: true,
            stroke: strokeColor,
            strokeWidth: brushSize,
            lineCap: 'round',
            lineJoin: 'round',
          },
        });
        setPreviewShape(rect);
      } else if (activeTool === ToolType.CIRCLE) {
        const circle = createCircle(pos.x, pos.y, 0, {
          style: {
            fill: fillColor,
            hasFill: true,
            stroke: strokeColor,
            strokeWidth: brushSize,
            lineCap: 'round',
            lineJoin: 'round',
          },
        });
        setPreviewShape(circle);
      }
    } else if (activeTool === ToolType.PEN) {
      setLines([
        ...lines,
        {
          id: `stroke-${Date.now()}`,
          points: [pos.x, pos.y],
          color: strokeColor,
          strokeWidth: brushSize,
        },
      ]);
    }
  };

  const handlePointerMove = (e: KonvaEventObject<PointerEvent>) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    if (isShapeTool(activeTool) && dragStart && previewShape) {
      // Calculate dimensions from drag
      const width = pos.x - dragStart.x;
      const height = pos.y - dragStart.y;

      if (activeTool === ToolType.RECTANGLE) {
        // Handle negative drag (dragging left/up)
        const x = width < 0 ? pos.x : dragStart.x;
        const y = height < 0 ? pos.y : dragStart.y;

        setPreviewShape({
          ...previewShape,
          type: ShapeType.RECTANGLE,
          position: { x, y },
          width: Math.abs(width),
          height: Math.abs(height),
        } as Shape);
      } else if (activeTool === ToolType.CIRCLE) {
        // Radius is distance from start point
        const radius = Math.sqrt(width * width + height * height);
        setPreviewShape({
          ...previewShape,
          type: ShapeType.CIRCLE,
          position: dragStart,
          radius,
        } as Shape);
      }
    } else if (activeTool === ToolType.PEN) {
      setLines((prevLines) => {
        const lastLine = prevLines[prevLines.length - 1];
        if (!lastLine) return prevLines;

        const points = lastLine.points;
        const lastX = points[points.length - 2];
        const lastY = points[points.length - 1];

        const dx = pos.x - lastX;
        const dy = pos.y - lastY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < MIN_POINT_DISTANCE) return prevLines;

        const updatedLine = {
          ...lastLine,
          points: [...points, pos.x, pos.y],
        };

        return [...prevLines.slice(0, -1), updatedLine];
      });
    }
  };

  const handlePointerUp = () => {
    if (isShapeTool(activeTool) && previewShape) {
      // Only add shape if it has dimensions
      const hasSize =
        (previewShape.type === ShapeType.RECTANGLE &&
          (previewShape as any).width > 5 &&
          (previewShape as any).height > 5) ||
        (previewShape.type === ShapeType.CIRCLE &&
          (previewShape as any).radius > 5);

      if (hasSize) {
        setShapes([...shapes, previewShape]);
      }
    }

    setIsDrawing(false);
    setDragStart(null);
    setPreviewShape(null);
  };

  const renderShape = (shape: Shape) => {
    if (shape.type === ShapeType.RECTANGLE) {
      return (
        <Rect
          key={shape.id}
          x={shape.position.x}
          y={shape.position.y}
          width={shape.width}
          height={shape.height}
          fill={shape.style.hasFill ? shape.style.fill : undefined}
          stroke={shape.style.stroke}
          strokeWidth={shape.style.strokeWidth}
          cornerRadius={shape.cornerRadius}
          opacity={shape.opacity}
        />
      );
    } else if (shape.type === ShapeType.CIRCLE) {
      return (
        <Circle
          key={shape.id}
          x={shape.position.x}
          y={shape.position.y}
          radius={shape.radius}
          fill={shape.style.hasFill ? shape.style.fill : undefined}
          stroke={shape.style.stroke}
          strokeWidth={shape.style.strokeWidth}
          opacity={shape.opacity}
        />
      );
    }
    return null;
  };

  // Combine shapes with preview for SVG rendering
  const allShapesForSVG = previewShape ? [...shapes, previewShape] : shapes;

  return (
    <div className="whiteboard-container" ref={containerRef}>
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        strokeColor={strokeColor}
        onColorChange={setStrokeColor}
        fillColor={fillColor}
        onFillColorChange={setFillColor}
      />
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <Layer>
          <Grid width={dimensions.width} height={dimensions.height} />
        </Layer>
        <Layer>
          {lines.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke={line.color}
              strokeWidth={line.strokeWidth}
              lineCap="round"
              lineJoin="round"
              tension={STROKE_TENSION}
            />
          ))}
        </Layer>
        <Layer>
          {shapes.map(renderShape)}
          {previewShape && renderShape(previewShape)}
        </Layer>
      </Stage>

      <SVGShapeRenderer
        shapes={allShapesForSVG}
        width={dimensions.width}
        height={dimensions.height}
        onShapeClick={handleShapeClick}
        selectedShapeId={selectedShapeId}
      />
    </div>
  );
}
