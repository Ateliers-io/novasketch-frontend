import DOMPurify from 'dompurify';
import { Stage, Layer, Line } from 'react-konva';
import { useRef, useState, useEffect } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import Toolbar from '../Toolbar';
import type { ActiveTool, EraserMode } from '../Toolbar/Toolbar';
import './Whiteboard.css';
import {
  ToolType,
  Shape,
  ShapeType,
  createRectangle,
  createCircle,
  Position,
  isRectangle,
  isCircle,
  RectangleShape,
  CircleShape,
} from '../../types/shapes';
import SVGShapeRenderer from './SVGShapeRenderer';

// --- Constants ---
const GRID_SIZE = 40;
const GRID_COLOR = '#e0e0e0';
const STROKE_TENSION = 0.4;
const MIN_POINT_DISTANCE = 3;
const DEFAULT_BRUSH_SIZE = 3;
const DEFAULT_STROKE_COLOR = '#000000';
const DEFAULT_ERASER_SIZE = 20;

// --- Types ---
interface StrokeLine {
  id: string;
  points: number[];
  color: string;
  strokeWidth: number;
}

interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
}

interface GridProps {
  width: number;
  height: number;
}

// --- Helper Components ---

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

// --- Eraser Helper Functions ---

// Hit testing: find stroke ID at given position
function findStrokeAtPosition(
  x: number,
  y: number,
  strokes: StrokeLine[],
  hitRadius: number
): string | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    const points = stroke.points;

    for (let j = 0; j < points.length - 2; j += 2) {
      const x1 = points[j];
      const y1 = points[j + 1];
      const x2 = points[j + 2];
      const y2 = points[j + 3];

      const dist = pointToSegmentDistance(x, y, x1, y1, x2, y2);
      const threshold = hitRadius + stroke.strokeWidth / 2;
      if (dist <= threshold) {
        return stroke.id;
      }
    }
  }
  return null;
}

// Hit testing: find shape ID at given position
function findShapeAtPosition(
  x: number,
  y: number,
  shapes: Shape[],
  hitRadius: number
): string | null {
  // Check shapes in reverse order (top-most first)
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];

    if (isRectangle(shape)) {
      const rect = shape as RectangleShape;
      // Check if point is inside rectangle (with margin for hit radius)
      const margin = hitRadius;
      if (
        x >= rect.position.x - margin &&
        x <= rect.position.x + rect.width + margin &&
        y >= rect.position.y - margin &&
        y <= rect.position.y + rect.height + margin
      ) {
        return shape.id;
      }
    } else if (isCircle(shape)) {
      const circle = shape as CircleShape;
      // Check if point is inside circle (with margin for hit radius)
      const dx = x - circle.position.x;
      const dy = y - circle.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= circle.radius + hitRadius) {
        return shape.id;
      }
    }
  }
  return null;
}

// Calculate distance from point (px, py) to line segment (x1,y1)-(x2,y2)
function pointToSegmentDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

// Partial eraser: remove points near cursor and split strokes if needed
function eraseAtPosition(
  x: number,
  y: number,
  strokes: StrokeLine[],
  eraserRadius: number
): StrokeLine[] {
  const result: StrokeLine[] = [];

  for (const stroke of strokes) {
    const points = stroke.points;
    let currentLinePoints: number[] = [];
    let segmentCount = 0;

    const finishLine = () => {
      if (currentLinePoints.length >= 4) {
        result.push({
          ...stroke,
          id: `${stroke.id}-${segmentCount++}`,
          points: [...currentLinePoints],
        });
      }
      currentLinePoints = [];
    };

    if (points.length < 4) {
      result.push(stroke);
      continue;
    }

    let px = points[0];
    let py = points[1];

    if (!isPointInCircle(px, py, x, y, eraserRadius)) {
      currentLinePoints.push(px, py);
    }

    for (let i = 2; i < points.length; i += 2) {
      const cx = points[i];
      const cy = points[i + 1];

      const p1 = { x: px, y: py };
      const p2 = { x: cx, y: cy };

      const intersections = getSegmentCircleIntersections(p1, p2, { x, y }, eraserRadius);

      if (intersections.length === 0) {
        if (!isPointInCircle(cx, cy, x, y, eraserRadius)) {
          currentLinePoints.push(cx, cy);
        } else {
          finishLine();
        }
      } else {
        intersections.sort((a, b) => distSq(p1, a) - distSq(p1, b));

        for (const intersect of intersections) {
          if (currentLinePoints.length > 0) {
            currentLinePoints.push(intersect.x, intersect.y);
            finishLine();
          } else {
            currentLinePoints.push(intersect.x, intersect.y);
          }
        }

        if (!isPointInCircle(cx, cy, x, y, eraserRadius)) {
          currentLinePoints.push(cx, cy);
        }
      }

      px = cx;
      py = cy;
    }

    finishLine();
  }

  return result;
}

function distSq(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
}

function getSegmentCircleIntersections(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  c: { x: number; y: number },
  r: number
) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const fx = p1.x - c.x;
  const fy = p1.y - c.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;

  let discriminant = b * b - 4 * a * C;

  const intersections: { x: number; y: number }[] = [];

  if (discriminant >= 0) {
    if (a === 0) return [];

    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    if (t1 >= 0 && t1 <= 1) {
      intersections.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy });
    }
    if (t2 >= 0 && t2 <= 1) {
      intersections.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy });
    }
  }

  return intersections;
}

function isPointInCircle(px: number, py: number, cx: number, cy: number, r: number) {
  return (px - cx) ** 2 + (py - cy) ** 2 < r ** 2;
}

// --- Text Input Component ---

interface TextInputProps {
  x: number;
  y: number;
  onSubmit: (text: string) => void;
  initialValue?: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
}

function TextInput({
  x, y, onSubmit, initialValue = '',
  fontSize, color, fontFamily, fontWeight, fontStyle, textDecoration
}: TextInputProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(value);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest('.toolbar')) {
      e.target.focus();
      return;
    }
    onSubmit(value);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        minWidth: '200px',
        minHeight: `${fontSize * 1.5}px`,
        padding: '4px 8px',
        fontSize: `${fontSize}px`,
        color: color,
        fontFamily: fontFamily,
        fontWeight: fontWeight,
        fontStyle: fontStyle,
        textDecoration: textDecoration,
        border: '2px solid #4a90e2',
        borderRadius: '4px',
        outline: 'none',
        resize: 'both',
        zIndex: 1000,
        background: 'transparent',
      }}
      placeholder="Type text here..."
    />
  );
}

// --- Main Component ---

export default function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // -- State: Content --
  const [lines, setLines] = useState<StrokeLine[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);

  // -- State: Interaction --
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>(ToolType.PEN);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  // -- State: Shape Drawing --
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [previewShape, setPreviewShape] = useState<Shape | null>(null);

  // -- State: Text Editing --
  const [activeTextInput, setActiveTextInput] = useState<{
    x: number;
    y: number;
    visible: boolean;
    editingId?: string;
    initialText?: string;
  } | null>(null);

  // -- State: Styles --
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [fillColor, setFillColor] = useState('#3B82F6');

  // -- State: Eraser --
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [eraserSize, setEraserSize] = useState(DEFAULT_ERASER_SIZE);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // -- State: Text Styles --
  const [activeFontFamily, setActiveFontFamily] = useState('Arial');
  const [activeFontSize, setActiveFontSize] = useState(16);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  // -- Lifecycle --
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

  // -- Helpers --
  const isShapeTool = (tool: ActiveTool) => {
    return tool === ToolType.RECTANGLE || tool === ToolType.CIRCLE;
  };

  const updateTextStyle = (
    key: keyof TextAnnotation,
    value: string | number | boolean
  ) => {
    if (key === 'fontFamily') setActiveFontFamily(value as string);
    if (key === 'fontSize') setActiveFontSize(value as number);
    if (key === 'fontWeight') setIsBold(value === 'bold');
    if (key === 'fontStyle') setIsItalic(value === 'italic');
    if (key === 'textDecoration') setIsUnderline(value === 'underline');

    if (activeTextInput?.editingId) {
      setTextAnnotations((prev) =>
        prev.map((t) => {
          if (t.id === activeTextInput.editingId) {
            let newValue = value;
            if (key === 'fontWeight') newValue = value ? 'bold' : 'normal';
            if (key === 'fontStyle') newValue = value ? 'italic' : 'normal';
            if (key === 'textDecoration') newValue = value ? 'underline' : 'none';
            return { ...t, [key]: newValue };
          }
          return t;
        })
      );
    }
  };

  // -- Event Handlers --

  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    // 1. Handle Eraser Tool - erases both strokes AND shapes
    if (activeTool === 'eraser') {
      // Try to find a stroke at this position
      const hitStrokeId = findStrokeAtPosition(pos.x, pos.y, lines, eraserSize / 2);
      // Try to find a shape at this position
      const hitShapeId = findShapeAtPosition(pos.x, pos.y, shapes, eraserSize / 2);

      if (eraserMode === 'stroke') {
        // Stroke mode: delete entire stroke or shape under cursor
        if (hitStrokeId) {
          setLines(lines.filter((line) => line.id !== hitStrokeId));
        }
        if (hitShapeId) {
          setShapes(shapes.filter((shape) => shape.id !== hitShapeId));
        }
      } else {
        // Partial mode: for strokes, split them; for shapes, just delete entirely
        setLines(eraseAtPosition(pos.x, pos.y, lines, eraserSize / 2));
        if (hitShapeId) {
          setShapes(shapes.filter((shape) => shape.id !== hitShapeId));
        }
      }
      return;
    }

    // 2. Handle Text Tool Click
    if (activeTool === 'text') {
      setActiveTextInput({ x: pos.x, y: pos.y, visible: true });
      return;
    }

    // 3. Handle Select Tool
    if (activeTool === 'select') {
      return;
    }

    // 4. Handle Drawing/Shapes
    setIsDrawing(true);

    if (isShapeTool(activeTool)) {
      setDragStart({ x: pos.x, y: pos.y });

      const commonStyle = {
        fill: fillColor,
        hasFill: true,
        stroke: strokeColor,
        strokeWidth: brushSize,
        lineCap: 'round' as const,
        lineJoin: 'round' as const,
      };

      if (activeTool === ToolType.RECTANGLE) {
        const rect = createRectangle(pos.x, pos.y, 0, 0, { style: commonStyle });
        setPreviewShape(rect);
      } else if (activeTool === ToolType.CIRCLE) {
        const circle = createCircle(pos.x, pos.y, 0, { style: commonStyle });
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
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    // Track cursor for eraser visualization
    if (activeTool === 'eraser') {
      setCursorPos(pos);
    } else {
      setCursorPos(null);
    }

    // Handle eraser while dragging
    // Handle eraser while dragging - erases both strokes AND shapes
    if (activeTool === 'eraser' && e.evt.buttons === 1) {
      const hitStrokeId = findStrokeAtPosition(pos.x, pos.y, lines, eraserSize / 2);
      const hitShapeId = findShapeAtPosition(pos.x, pos.y, shapes, eraserSize / 2);

      if (eraserMode === 'stroke') {
        // Stroke mode: delete entire stroke or shape
        if (hitStrokeId) {
          setLines((prev) => prev.filter((line) => line.id !== hitStrokeId));
        }
        if (hitShapeId) {
          setShapes((prev) => prev.filter((shape) => shape.id !== hitShapeId));
        }
      } else {
        // Partial mode: split strokes, delete shapes entirely
        setLines((prev) => eraseAtPosition(pos.x, pos.y, prev, eraserSize / 2));
        if (hitShapeId) {
          setShapes((prev) => prev.filter((shape) => shape.id !== hitShapeId));
        }
      }
      return;
    }

    if (!isDrawing) return;

    // Handle shape preview
    if (isShapeTool(activeTool) && dragStart && previewShape) {
      const width = pos.x - dragStart.x;
      const height = pos.y - dragStart.y;

      if (activeTool === ToolType.RECTANGLE) {
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
      const hasSize =
        (previewShape.type === ShapeType.RECTANGLE && (previewShape as any).width > 5) ||
        (previewShape.type === ShapeType.CIRCLE && (previewShape as any).radius > 5);

      if (hasSize) {
        setShapes([...shapes, previewShape]);
      }
    }
    setIsDrawing(false);
    setDragStart(null);
    setPreviewShape(null);
  };

const handleTextSubmit = (text: string) => {
    // 1. Basic validation
    if (!activeTextInput || !text.trim()) {
      setActiveTextInput(null);
      return;
    }

    // 2. SANITIZATION (Security Requirement 2.3.2)
    // This strips out <script>, <img> onerror attributes, and other XSS vectors.
    const sanitizedText = DOMPurify.sanitize(text.trim());

    // 3. Prevent saving if sanitization resulted in an empty string
    if (!sanitizedText) {
      setActiveTextInput(null);
      return;
    }

    if (activeTextInput.editingId) {
      setTextAnnotations(
        textAnnotations.map((annotation) =>
          annotation.id === activeTextInput.editingId
            ? {
              ...annotation,
              text: sanitizedText, // Use sanitized text
              fontSize: activeFontSize,
              color: strokeColor,
              fontFamily: activeFontFamily,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal',
              textDecoration: isUnderline ? 'underline' : 'none',
            }
            : annotation
        )
      );
    } else {
      const newTextAnnotation: TextAnnotation = {
        id: `text-${Date.now()}`,
        x: activeTextInput.x,
        y: activeTextInput.y,
        text: sanitizedText, // Use sanitized text
        fontSize: activeFontSize,
        color: strokeColor,
        fontFamily: activeFontFamily,
        fontWeight: isBold ? 'bold' : 'normal',
        fontStyle: isItalic ? 'italic' : 'normal',
        textDecoration: isUnderline ? 'underline' : 'none',
      };
      setTextAnnotations([...textAnnotations, newTextAnnotation]);
    }
    setActiveTextInput(null);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'text') return;
    if (!containerRef.current) return;

    const target = e.target as HTMLElement;
    if (target.closest('.toolbar') || target.tagName === 'TEXTAREA') return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setActiveTextInput({ x, y, visible: true });
  };

  const handleTextClick = (textAnnotation: TextAnnotation) => {
    if (activeTool !== 'select') return;

    setActiveFontSize(textAnnotation.fontSize);
    setActiveFontFamily(textAnnotation.fontFamily || 'Arial');
    setIsBold(textAnnotation.fontWeight === 'bold');
    setIsItalic(textAnnotation.fontStyle === 'italic');
    setIsUnderline(textAnnotation.textDecoration === 'underline');
    setStrokeColor(textAnnotation.color);

    setActiveTextInput({
      x: textAnnotation.x,
      y: textAnnotation.y,
      visible: true,
      editingId: textAnnotation.id,
      initialText: textAnnotation.text,
    });
  };

  const handleShapeClick = (shape: Shape) => {
    if (activeTool === 'select') {
      setSelectedShapeId(shape.id);
    }
  };

  const allShapesForSVG = previewShape ? [...shapes, previewShape] : shapes;

  // Helper function to erase shape at position
  const eraseShapeAtPosition = (x: number, y: number) => {
    const hitShapeId = findShapeAtPosition(x, y, shapes, eraserSize / 2);
    if (hitShapeId) {
      setShapes((prev) => prev.filter((shape) => shape.id !== hitShapeId));
    }
  };

  // Track mouse position at container level (for eraser cursor over SVG shapes)
  // Also handles eraser dragging over shapes
  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'eraser' && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCursorPos({ x, y });

      // If mouse button is held (dragging), erase shapes continuously
      if (e.buttons === 1) {
        eraseShapeAtPosition(x, y);
      }
    }
  };

  // Handle eraser on container level (so it works over SVG shapes too)
  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'eraser' && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Erase shape at this position (works for both stroke and partial modes)
      eraseShapeAtPosition(x, y);
    }
  };

  return (
    <div
      className="whiteboard-container"
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseMove={handleContainerMouseMove}
      onMouseDown={handleContainerMouseDown}
      onMouseLeave={() => setCursorPos(null)}
    >
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        strokeColor={strokeColor}
        onColorChange={setStrokeColor}
        fillColor={fillColor}
        onFillColorChange={setFillColor}
        fontFamily={activeFontFamily}
        onFontFamilyChange={(val) => updateTextStyle('fontFamily', val)}
        fontSize={activeFontSize}
        onFontSizeChange={(val) => updateTextStyle('fontSize', val)}
        isBold={isBold}
        onBoldChange={(val) => updateTextStyle('fontWeight', val ? 'bold' : 'normal')}
        isItalic={isItalic}
        onItalicChange={(val) => updateTextStyle('fontStyle', val ? 'italic' : 'normal')}
        isUnderline={isUnderline}
        onUnderlineChange={(val) => updateTextStyle('textDecoration', val ? 'underline' : 'none')}
        eraserMode={eraserMode}
        onEraserModeChange={setEraserMode}
        eraserSize={eraserSize}
        onEraserSizeChange={setEraserSize}
      />

      {/* Canvas Layer */}
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          handlePointerUp();
          setCursorPos(null);
        }}
        style={{ cursor: activeTool === 'eraser' ? 'none' : 'default' }}
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

      {/* SVG Shapes Layer */}
      <SVGShapeRenderer
        shapes={allShapesForSVG}
        width={dimensions.width}
        height={dimensions.height}
        onShapeClick={handleShapeClick}
        selectedShapeId={selectedShapeId}
      />

      {/* Text Annotations Layer */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: dimensions.width,
          height: dimensions.height,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {textAnnotations.map((textAnnotation) => (
          <text
            key={textAnnotation.id}
            x={textAnnotation.x}
            y={textAnnotation.y}
            fontSize={textAnnotation.fontSize}
            fill={textAnnotation.color}
            fontFamily={textAnnotation.fontFamily || 'Arial'}
            fontWeight={textAnnotation.fontWeight}
            fontStyle={textAnnotation.fontStyle}
            textDecoration={textAnnotation.textDecoration}
            dominantBaseline="hanging"
            style={{
              pointerEvents: 'auto',
              cursor: activeTool === 'select' ? 'pointer' : 'default',
              visibility: activeTextInput?.editingId === textAnnotation.id ? 'hidden' : 'visible',
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTextClick(textAnnotation);
            }}
          >
            {textAnnotation.text}
          </text>
        ))}
      </svg>

      {/* Active Text Input */}
      {activeTextInput?.visible && (
        <TextInput
          x={activeTextInput.x}
          y={activeTextInput.y}
          onSubmit={handleTextSubmit}
          initialValue={activeTextInput.initialText}
          fontSize={activeFontSize}
          color={strokeColor}
          fontFamily={activeFontFamily}
          fontWeight={isBold ? 'bold' : 'normal'}
          fontStyle={isItalic ? 'italic' : 'normal'}
          textDecoration={isUnderline ? 'underline' : 'none'}
        />
      )}

      {/* Eraser Cursor Overlay - always on top */}
      {activeTool === 'eraser' && cursorPos && (
        <div
          style={{
            position: 'absolute',
            left: cursorPos.x - eraserSize / 2,
            top: cursorPos.y - eraserSize / 2,
            width: eraserSize,
            height: eraserSize,
            borderRadius: '50%',
            border: '2px solid #333',
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        />
      )}
    </div>
  );
}

