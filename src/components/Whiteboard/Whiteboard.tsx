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
const DEFAULT_STROKE_COLOR = '#000000';

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

type Tool = 'draw' | 'text' | 'select';

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
    // Auto-focus when component mounts
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(value);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Check if the new focused element is inside the toolbar
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest('.toolbar')) {
      // Keep focus on the textarea if interacting with toolbar
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
        minHeight: `${fontSize * 1.5}px`, // Adjust height based on font size
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
        background: 'transparent', // Make background transparent to blend with canvas
      }}
      placeholder="Type text here..."
    />
  );
}

export default function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const [lines, setLines] = useState<StrokeLine[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Tool mode state
  const [tool, setTool] = useState<Tool>('draw');

  // Text annotations state
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [activeTextInput, setActiveTextInput] = useState<{
    x: number;
    y: number;
    visible: boolean;
    editingId?: string;
    initialText?: string;
  } | null>(null);

  // Drawing context - stores current tool settings
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR); // hex code

  // Text formatting state
  const [activeFontFamily, setActiveFontFamily] = useState('Arial');
  const [activeFontSize, setActiveFontSize] = useState(16);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

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

  // Start a new stroke with current tool settings (draw mode) or show text input (text mode)
  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    if (tool === 'text') {
      // Show text input at click position
      setActiveTextInput({ x: pos.x, y: pos.y, visible: true });
      return;
    }

    if (tool === 'select') {
      return;
    }

    // Draw mode - start a new stroke
    setIsDrawing(true);
    setLines([
      ...lines,
      {
        id: `stroke-${Date.now()}`,
        points: [pos.x, pos.y],
        color: strokeColor, // Apply selected color to new stroke
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

  // Handle text input submission
  const handleTextSubmit = (text: string) => {
    if (!activeTextInput || !text.trim()) {
      setActiveTextInput(null);
      return;
    }

    if (activeTextInput.editingId) {
      // Update existing text annotation
      setTextAnnotations(
        textAnnotations.map((annotation) =>
          annotation.id === activeTextInput.editingId
            ? {
              ...annotation,
              text: text.trim(),
              fontSize: activeFontSize,
              color: strokeColor, // Update color from toolbar state
              fontFamily: activeFontFamily,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal',
              textDecoration: isUnderline ? 'underline' : 'none',
            }
            : annotation
        )
      );
    } else {
      // Create new text annotation
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

  // Handle container clicks for text mode (fallback if Konva events don't fire)
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tool !== 'text') return;
    if (!containerRef.current) return;

    // Don't handle if clicking on toolbar or existing text input
    const target = e.target as HTMLElement;
    if (target.closest('.toolbar') || target.tagName === 'TEXTAREA') return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setActiveTextInput({ x, y, visible: true });
  };

  // Handle clicking on existing text to edit it (only in select mode)
  const handleTextClick = (textAnnotation: TextAnnotation) => {
    if (tool !== 'select') return;

    // Sync toolbar state
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

  // Helper to update text style for both state and active selection
  const updateTextStyle = (
    key: keyof TextAnnotation,
    value: string | number | boolean
  ) => {
    // Update local state helpers
    if (key === 'fontFamily') setActiveFontFamily(value as string);
    if (key === 'fontSize') setActiveFontSize(value as number);
    if (key === 'fontWeight') setIsBold(value === 'bold');
    if (key === 'fontStyle') setIsItalic(value === 'italic');
    if (key === 'textDecoration') setIsUnderline(value === 'underline');

    // If editing, update the annotation immediately
    if (activeTextInput?.editingId) {
      setTextAnnotations((prev) =>
        prev.map((t) => {
          if (t.id === activeTextInput.editingId) {
            // For boolean toggles, we need to map true/false to CSS values
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

  return (
    <div
      className="whiteboard-container"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        strokeColor={strokeColor}
        onColorChange={setStrokeColor}
        // Text formatting
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
        {/* Render strokes with their stored color */}
        <Layer>
          {lines.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke={line.color} // Each stroke uses its own color
              strokeWidth={line.strokeWidth}
              lineCap="round"
              lineJoin="round"
              tension={STROKE_TENSION}
            />
          ))}
        </Layer>
      </Stage>
      {/* SVG overlay for text annotations */}
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
              cursor: tool === 'select' ? 'pointer' : 'default',
              visibility: activeTextInput?.editingId === textAnnotation.id ? 'hidden' : 'visible',
            }}
            onClick={() => handleTextClick(textAnnotation)}
          >
            {textAnnotation.text}
          </text>
        ))}
      </svg>
      {/* Text input overlay */}
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
