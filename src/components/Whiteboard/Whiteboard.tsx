import { Stage, Layer, Line } from 'react-konva';
import { useRef, useState, useEffect } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import Toolbar from '../Toolbar';
import './Whiteboard.css';

const GRID_SIZE = 40; // px between grid lines
const GRID_COLOR = '#e0e0e0';
const STROKE_TENSION = 0.4; // bezier curve smoothing (0 = sharp, 1 = very smooth)
const MIN_POINT_DISTANCE = 3; // skip points closer than this to reduce jitter
const DEFAULT_BRUSH_SIZE = 3;

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
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);

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

  // Start a new stroke
  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    setIsDrawing(true);
    setLines([
      ...lines,
      {
        id: `stroke-${Date.now()}`,
        points: [pos.x, pos.y],
        color: '#000000',
        strokeWidth: brushSize,
      },
    ]);
  };

  // Add points to current stroke while drawing
  const handlePointerMove = (e: KonvaEventObject<PointerEvent>) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    setLines((prevLines) => {
      const lastLine = prevLines[prevLines.length - 1];
      if (!lastLine) return prevLines;

      const points = lastLine.points;
      const lastX = points[points.length - 2];
      const lastY = points[points.length - 1];

      // Distance check for point simplification
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
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  return (
    <div className="whiteboard-container" ref={containerRef}>
      <Toolbar brushSize={brushSize} onBrushSizeChange={setBrushSize} />
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
      </Stage>
    </div>
  );
}
