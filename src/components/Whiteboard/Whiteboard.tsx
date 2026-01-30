import { Stage, Layer, Line } from 'react-konva';
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

// --- Constants ---
const GRID_SIZE = 40;
const GRID_COLOR = '#e0e0e0';
const STROKE_TENSION = 0.4;
const MIN_POINT_DISTANCE = 3;
const DEFAULT_BRUSH_SIZE = 3;
const DEFAULT_STROKE_COLOR = '#000000';

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

// Union type for tools to support both Enums (Shapes/Pen) and Strings (Text/Select)
type ActiveTool = ToolType | 'text' | 'select';

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

  // Text Styles
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

    // 1. Handle Text Tool Click
    if (activeTool === 'text') {
      setActiveTextInput({ x: pos.x, y: pos.y, visible: true });
      return;
    }

    // 2. Handle Select Tool (Logic handled by onClick on elements)
    if (activeTool === 'select') {
      return;
    }

    // 3. Handle Drawing/Shapes
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
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

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
    if (!activeTextInput || !text.trim()) {
      setActiveTextInput(null);
      return;
    }

    if (activeTextInput.editingId) {
      setTextAnnotations(
        textAnnotations.map((annotation) =>
          annotation.id === activeTextInput.editingId
            ? {
              ...annotation,
              text: text.trim(),
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
        text: text.trim(),
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

    // Only create input if we didn't just click an existing text (handled by bubble up)
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

  return (
    <div
      className="whiteboard-container"
      ref={containerRef}
      onClick={handleContainerClick}
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
      />

      {/* Canvas Layer */}
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
              e.stopPropagation(); // Prevent creation of new text box
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
    </div>
  );
}