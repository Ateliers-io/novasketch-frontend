import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    MousePointer2,
    Pencil,
    Square,
    Circle,
    Type,
    Eraser,
    Bold,
    Italic,
    Underline,
    ChevronDown,
    Minus,
    Trash2,
    Lock,
    Unlock,
    ArrowUp,
    ArrowDown,
    Undo2,
    Redo2,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Triangle,
    ArrowRight,
    Slash,
    Highlighter,
    PaintBucket,
    Paintbrush,
    Plus,
    Hand,
    Grid3x3,
    ImageIcon,
    LayoutTemplate,
    Sparkles,
} from 'lucide-react';
import { ToolType, BrushType, StrokeStyle } from '../../types/shapes';
import { GridConfig, GridSnapType, GridAppearance } from '../../types/grid';

/* --- TYPES --- */
export type ActiveTool = ToolType | 'text' | 'select' | 'eraser';
export type EraserMode = 'partial' | 'stroke';

const PRO_COLORS_DARK = [
    '#000000', '#FFFFFF',
    // vibrant dark theme colors
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e',
    '#78716c'
];

const PRO_COLORS_LIGHT = [
    '#bae6fd', '#FFFFFF',
    // softer, light theme colors
    '#fca5a5', '#fdba74', '#fde047', '#bef264', '#86efac', '#67e8f9',
    '#93c5fd', '#a5b4fc', '#c4b5fd', '#f0abfc', '#fda4af',
    '#d6d3d1'
];

interface ToolbarProps {
    activeTool: ActiveTool;
    onToolChange: (tool: ActiveTool) => void;
    isToolLocked: boolean;
    onToolLockChange: (locked: boolean) => void;
    brushSize: number;
    onBrushSizeChange: (size: number) => void;
    strokeColor: string;
    onColorChange: (color: string) => void;
    fillColor: string;
    onFillColorChange: (color: string) => void;
    cornerRadius?: number;
    onCornerRadiusChange?: (radius: number) => void;
    brushType: BrushType;
    onBrushTypeChange: (type: BrushType) => void;
    strokeStyle: StrokeStyle;
    onStrokeStyleChange: (style: StrokeStyle) => void;
    fontFamily: string;
    onFontFamilyChange: (font: string) => void;
    fontSize: number;
    onFontSizeChange: (size: number) => void;
    isBold: boolean;
    onBoldChange: (bold: boolean) => void;
    isItalic: boolean;
    onItalicChange: (italic: boolean) => void;
    isUnderline: boolean;
    onUnderlineChange: (underline: boolean) => void;
    textAlign: 'left' | 'center' | 'right';
    onTextAlignChange: (align: 'left' | 'center' | 'right') => void;
    isTextSelected: boolean;
    eraserMode: EraserMode;
    onEraserModeChange: (mode: EraserMode) => void;
    eraserSize: number;
    onEraserSizeChange: (size: number) => void;
    hasSelection: boolean;
    onBringForward: () => void;
    onSendBackward: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
    onDeleteSelected?: () => void;
    gridConfig: GridConfig;
    onGridConfigChange: (config: GridConfig) => void;
    isSessionLocked?: boolean;
    isOwner?: boolean;
    isLockActive?: boolean;
    onToggleLock?: () => Promise<void>;
    theme?: 'light' | 'dark';
    onImageUpload?: () => void;
    lineType?: 'straight' | 'curved' | 'stepped';
    onLineTypeChange?: (type: 'straight' | 'curved' | 'stepped') => void;
    arrowAtStart?: boolean;
    onArrowAtStartChange?: (arrow: boolean) => void;
    arrowAtEnd?: boolean;
    onArrowAtEndChange?: (arrow: boolean) => void;
}

/* --- BRUSH DATA --- */
const BRUSH_OPTIONS: { type: BrushType; label: string }[] = [
    { type: BrushType.BRUSH, label: 'Brush' },
    { type: BrushType.CALLIGRAPHY, label: 'Calligraphy' },
    { type: BrushType.CALLIGRAPHY_PEN, label: 'Calligraphy Pen' },
    { type: BrushType.AIRBRUSH, label: 'Airbrush' },
    { type: BrushType.OIL_BRUSH, label: 'Oil Brush' },
    { type: BrushType.CRAYON, label: 'Crayon' },
    { type: BrushType.MARKER, label: 'Marker' },
    { type: BrushType.NATURAL_PENCIL, label: 'Pencil' },
    { type: BrushType.WATERCOLOUR, label: 'Watercolour' },
    { type: BrushType.MAGIC_PENCIL, label: 'Magic Pencil' },
    { type: BrushType.SKETCH_RNN, label: 'AI Sketch' },
];

const SHAPE_ITEMS: { type: ToolType; label: string; icon: any | null }[] = [
    { type: ToolType.RECTANGLE, label: 'Rectangle', icon: Square },
    { type: ToolType.CIRCLE, label: 'Circle', icon: Circle },
    { type: ToolType.ELLIPSE, label: 'Ellipse', icon: null },
    { type: ToolType.TRIANGLE, label: 'Triangle', icon: Triangle },
    { type: ToolType.LINE, label: 'Line', icon: Slash },
    { type: ToolType.ARROW, label: 'Arrow', icon: ArrowRight },
];

const DROPDOWN_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#000000', '#FFFFFF'];

/* --- SVG BRUSH PREVIEW --- */
// hardcoded svg paths. rendering these dynamically is a waste of cycles.
const BrushPreview = ({ brushType }: { brushType: BrushType }) => {
    const getPath = () => {
        switch (brushType) {
            case BrushType.BRUSH:
                // Smooth tapered gesture stroke
                return <path d="M4 18 C30 4, 62 22, 96 8" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
            case BrushType.CALLIGRAPHY:
                // Three segments: thick downstroke -> thin upstroke -> thick downstroke
                return <g>
                    <path d="M4 7 Q22 22, 42 14" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" />
                    <path d="M42 14 Q62 6, 72 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    <path d="M72 9 Q84 17, 96 20" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" />
                </g>;
            case BrushType.CALLIGRAPHY_PEN:
                // Flat square nib: thin on diagonal runs, thick on perpendicular
                return <g>
                    <path d="M4 20 Q22 8, 40 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="square" />
                    <path d="M40 10 Q56 12, 62 20" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="square" />
                    <path d="M62 20 Q80 8, 96 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="square" />
                </g>;
            case BrushType.AIRBRUSH:
                // Soft spray: scattered particles spread along a diagonal path
                return <g>{[
                    [10,14,1.4,0.5],[13,9,0.9,0.35],[16,16,1.1,0.4],[21,11,1.7,0.45],[24,7,0.7,0.3],
                    [28,15,1.3,0.5],[32,10,0.9,0.4],[35,17,1.1,0.35],[39,12,1.5,0.45],[42,8,0.7,0.35],
                    [46,14,1.2,0.5],[49,10,1.7,0.4],[52,16,0.9,0.3],[56,9,1.3,0.45],[59,13,0.7,0.4],
                    [63,8,1.4,0.35],[66,15,0.9,0.5],[70,11,1.1,0.4],[73,17,1.5,0.35],[77,9,0.7,0.45],
                    [80,13,1.2,0.5],[84,8,0.9,0.4],[87,15,1.4,0.35],[91,11,1.1,0.45],[94,14,0.7,0.3],
                ].map(([cx, cy, r, op], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="currentColor" opacity={op} />)}</g>;
            case BrushType.OIL_BRUSH:
                // Heavy layered bristle strokes giving thick oil-paint body
                return <g>
                    <path d="M4 10 C40 18, 60 6, 96 13" stroke="currentColor" strokeWidth="9" fill="none" strokeLinecap="round" opacity="0.2" />
                    <path d="M4 11 C40 19, 60 7, 96 14" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.4" />
                    <path d="M4 12 C40 20, 60 8, 96 15" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
                    <path d="M4 11 C40 19, 60 7, 96 14" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5" />
                </g>;
            case BrushType.CRAYON:
                // Rough waxy texture: broken parallel strokes with dash gaps
                return <g>
                    <path d="M4 11 Q28 8, 50 13 Q72 18, 96 13" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="9 1.5" opacity="0.55" />
                    <path d="M4 14 Q28 11, 50 16 Q72 21, 96 16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="7 2.5" opacity="0.5" />
                    <path d="M5 9 Q28 6, 50 11 Q72 16, 95 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="5 4" opacity="0.35" />
                </g>;
            case BrushType.MARKER:
                // Wide chisel-tip: very thick semi-transparent band + crisp edge line
                return <g>
                    <path d="M4 13 C32 9, 62 17, 96 13" stroke="currentColor" strokeWidth="13" fill="none" strokeLinecap="square" opacity="0.25" />
                    <path d="M4 13 C32 9, 62 17, 96 13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="square" opacity="0.75" />
                </g>;
            case BrushType.NATURAL_PENCIL:
                // Very thin delicate line with a faint graphite grain shadow
                return <g>
                    <path d="M4 15 C20 11, 42 17, 60 13 C76 9, 86 15, 96 12" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.85" />
                    <path d="M5 17 C22 13, 44 19, 62 15 C78 11, 88 17, 96 14" stroke="currentColor" strokeWidth="0.5" fill="none" strokeLinecap="round" opacity="0.35" />
                </g>;
            case BrushType.WATERCOLOUR:
                // Soft wide transparent wash: multiple overlapping layers
                return <g>
                    <path d="M4 13 C32 3, 65 23, 96 13" stroke="currentColor" strokeWidth="18" fill="none" strokeLinecap="round" opacity="0.07" />
                    <path d="M6 13 C32 5, 65 21, 94 13" stroke="currentColor" strokeWidth="11" fill="none" strokeLinecap="round" opacity="0.1" />
                    <path d="M8 13 C32 7, 65 19, 92 13" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.16" />
                    <path d="M10 13 C34 9, 65 17, 90 13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.45" />
                </g>;
            case BrushType.MAGIC_PENCIL:
                // Glittery trail: thin path with star/cross sparkles along it
                return <g>
                    <path d="M4 14 C30 6, 65 22, 96 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.8" />
                    {[[20, 8], [35, 18], [50, 8], [65, 18], [80, 8]].map(([cx, cy], i) => (
                        <g key={i} opacity={0.65}>
                            <line x1={cx} y1={cy - 3} x2={cx} y2={cy + 3} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </g>
                    ))}
                </g>;
            case BrushType.SKETCH_RNN:
                // AI brain-wave: dashed path with sparkle dots indicating AI completion
                return <g>
                    <path d="M4 14 C30 8, 50 20, 70 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.9" />
                    <path d="M70 12 C78 8, 86 16, 96 10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 2" opacity="0.5" />
                    {[[74, 10], [82, 14], [90, 9]].map(([cx, cy], i) => (
                        <circle key={i} cx={cx} cy={cy} r="1.5" fill="currentColor" opacity={0.6 - i * 0.1} />
                    ))}
                </g>;
        }
    };
    return <svg width="100" height="26" viewBox="0 0 100 26" className="flex-shrink-0">{getPath()}</svg>;
};

/* --- COMPONENTS --- */
const IconCurvedLine = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 18 Q 12 4 20 18" /></svg>;
const IconStraightLine = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 20 L20 4" /></svg>;
const IconSteppedLine = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 20 L12 20 L12 4 L20 4" /></svg>;

const IconArrowStart = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10 18l-6-6 6-6" /><path d="M20 12H4" /></svg>;
const IconArrowEnd = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 12h16" /><path d="M14 6l6 6-6 6" /></svg>;
const IconArrowNone = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 12h16" /></svg>;



const ToolButton = ({
    isActive, onClick, icon: Icon, label, hasDropdown = false, size = 16,
}: {
    isActive: boolean; onClick: () => void; icon: any; label: string; hasDropdown?: boolean; size?: number;
}) => (
    <button
        onClick={onClick}
        title={label}
        className={`
            relative group flex items-center justify-center w-7 h-7 rounded-sm transition-all duration-150
            ${isActive
                ? 'shadow-sm'
                : ''
            }
        `}
        style={{
            background: isActive ? 'var(--ns-toolbar-active-bg)' : 'transparent',
            color: isActive ? 'var(--ns-toolbar-active-text)' : 'var(--ns-toolbar-muted)',
            boxShadow: isActive ? '0 0 8px var(--ns-toolbar-active-ring)' : 'none',
            ...(isActive ? { outline: '1px solid var(--ns-toolbar-active-ring)' } : {}),
        }}
        onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--ns-toolbar-hover)'; e.currentTarget.style.color = 'var(--ns-toolbar-text)'; } }}
        onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ns-toolbar-muted)'; } }}
    >
        <Icon size={size} />
        {hasDropdown && (
            <ChevronDown size={8} className="absolute bottom-0 right-0 opacity-60" />
        )}
    </button>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-center select-none opacity-80" style={{ color: 'var(--ns-section-label)' }}>
        {children}
    </div>
);

const ToolSection = ({ children, label }: { children: React.ReactNode; label: string }) => (
    <div className="-mt-0.5 flex flex-col items-center justify-end h-full px-1 pb-[2px] pt-1">
        <div className="mt-1 flex items-center gap-[1px] h-7 mb-[3px]">
            {children}
        </div>
        <SectionLabel>{label}</SectionLabel>
    </div>
);

const Separator = () => <div className="w-px h-8 mx-1 self-center opacity-70" style={{ background: 'var(--ns-separator)' }} />;

/* --- PORTAL DROPDOWN --- */
function DropdownPortal({
    triggerRef,
    children,
    offsetY = 8,
}: {
    triggerRef: React.RefObject<HTMLElement | null>;
    children: React.ReactNode;
    offsetY?: number;
}) {
    const [pos, setPos] = useState<React.CSSProperties>({ visibility: 'hidden' });
    useLayoutEffect(() => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setPos({
            position: 'fixed',
            top: rect.bottom + offsetY,
            left: rect.left + rect.width / 2,
            transform: 'translateX(-50%)',
            zIndex: 9999,
        });
    }, []);
    return createPortal(<div style={pos} data-portal-dropdown>{children}</div>, document.body);
}

export default function Toolbar({
    activeTool, onToolChange,
    isToolLocked, onToolLockChange,
    brushSize, onBrushSizeChange,
    strokeColor, onColorChange,
    fillColor, onFillColorChange,
    cornerRadius, onCornerRadiusChange,
    brushType, onBrushTypeChange,
    strokeStyle, onStrokeStyleChange,
    fontFamily, onFontFamilyChange,
    fontSize, onFontSizeChange,
    isBold, onBoldChange,
    isItalic, onItalicChange,
    isUnderline, onUnderlineChange,
    eraserMode, onEraserModeChange,
    eraserSize, onEraserSizeChange,
    hasSelection, onBringForward, onSendBackward,
    canUndo = false, canRedo = false, onUndo, onRedo,
    textAlign = 'left', onTextAlignChange, isTextSelected = false,
    onDeleteSelected,
    gridConfig, onGridConfigChange,
    isSessionLocked = false,
    isOwner = false,
    isLockActive = false,
    onToggleLock,
    theme = 'dark',
    onImageUpload,
    lineType = 'curved', onLineTypeChange,
    arrowAtStart = false, onArrowAtStartChange,
    arrowAtEnd = false, onArrowAtEndChange,
}: ToolbarProps) {
    const [showEraserMenu, setShowEraserMenu] = useState(false);
    const [showBrushMenu, setShowBrushMenu] = useState(false);
    const [showStrokeStyleMenu, setShowStrokeStyleMenu] = useState(false);
    const [showGridMenu, setShowGridMenu] = useState(false);
    const [showLineStyleMenu, setShowLineStyleMenu] = useState(false);
    const [showShapesMenu, setShowShapesMenu] = useState(false);
    const [showColorMenu, setShowColorMenu] = useState(false);
    const [lastShapeTool, setLastShapeTool] = useState<ToolType>(ToolType.RECTANGLE);
    const gridColorRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Local state for Color Mode (Stroke vs Fill)
    const [activeColorMode, setActiveColorMode] = useState<'stroke' | 'fill'>('stroke');
    const eraserMenuRef = useRef<HTMLDivElement>(null);
    const brushMenuRef = useRef<HTMLDivElement>(null);
    const strokeStyleRef = useRef<HTMLDivElement>(null);
    const gridMenuRef = useRef<HTMLDivElement>(null);
    const lineStyleRef = useRef<HTMLDivElement>(null);
    const shapesMenuRef = useRef<HTMLDivElement>(null);
    const colorMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Portal dropdowns are rendered in document.body outside all refs.
            // If the click is inside any portal dropdown, don't close anything.
            if ((event.target as HTMLElement).closest?.('[data-portal-dropdown]')) return;
            if (eraserMenuRef.current && !eraserMenuRef.current.contains(event.target as Node)) setShowEraserMenu(false);
            if (brushMenuRef.current && !brushMenuRef.current.contains(event.target as Node)) setShowBrushMenu(false);
            if (strokeStyleRef.current && !strokeStyleRef.current.contains(event.target as Node)) setShowStrokeStyleMenu(false);
            if (gridMenuRef.current && !gridMenuRef.current.contains(event.target as Node)) setShowGridMenu(false);
            if (lineStyleRef.current && !lineStyleRef.current.contains(event.target as Node)) setShowLineStyleMenu(false);
            if (shapesMenuRef.current && !shapesMenuRef.current.contains(event.target as Node)) setShowShapesMenu(false);
            if (colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) setShowColorMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Native wheel listener: passive:false so preventDefault works,
    // prevents 2-finger trackpad scroll from panning the whiteboard.
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            el.scrollLeft += (e.deltaY || e.deltaX);
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    // Auto-switch color context depending on tool selected
    useEffect(() => {
        if (activeTool === ToolType.FILL_BUCKET) {
            setActiveColorMode('fill');
        } else if ([ToolType.PEN, ToolType.HIGHLIGHTER, ToolType.LINE, ToolType.ARROW].includes(activeTool as ToolType)) {

            setActiveColorMode('stroke');
        }
    }, [activeTool]);

    const isShapeTool = [ToolType.RECTANGLE, ToolType.CIRCLE, ToolType.ELLIPSE, ToolType.LINE, ToolType.ARROW, ToolType.TRIANGLE, ToolType.FRAME].includes(activeTool as ToolType);
    const isBrushTool = [ToolType.PEN, ToolType.HIGHLIGHTER].includes(activeTool as ToolType);
    const isDrawMode = isShapeTool || isBrushTool;
    const isTextMode = activeTool === 'text';
    const isEraserMode = activeTool === 'eraser';
    const isFillBucket = activeTool === ToolType.FILL_BUCKET;

    const FONT_SIZES = [
        12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72
    ] as const;

    const toolbarBorderColor = isSessionLocked ? 'rgba(245,158,11,0.3)' : 'var(--ns-toolbar-border)';
    const undoColor = canUndo ? 'var(--ns-toolbar-muted)' : 'var(--ns-disabled)';
    const undoCursor = canUndo ? 'pointer' : 'not-allowed';
    const redoColor = canRedo ? 'var(--ns-toolbar-muted)' : 'var(--ns-disabled)';
    const redoCursor = canRedo ? 'pointer' : 'not-allowed';

    return (
        <div className="relative" data-component="toolbar">
            <div
                className="rounded-xl backdrop-blur-2xl transition-all duration-300"
                style={{
                    background: 'var(--ns-toolbar-bg)',
                    border: `1px solid ${toolbarBorderColor}`,
                    boxShadow: 'var(--ns-toolbar-shadow)',
                    opacity: isSessionLocked ? 0.5 : 1,
                    pointerEvents: isSessionLocked ? 'none' : 'auto',
                }}
            >
                <div
                    ref={scrollContainerRef}
                    className="flex items-stretch gap-0.5 px-2 py-1 overflow-x-auto"
                    style={{ scrollbarWidth: 'none', color: 'var(--ns-toolbar-text)' }}
                >

                    {/* HISTORY */}
                    <ToolSection label="History">
                        <button onClick={onUndo} disabled={canUndo === false} title="Undo (Ctrl+Z)"
                            className="flex items-center justify-center w-7 h-7 rounded-sm transition-all duration-150 active:scale-95"
                            style={{ color: undoColor, cursor: undoCursor }}
                            onMouseEnter={(e) => { if (canUndo) { e.currentTarget.style.background = 'var(--ns-toolbar-hover)'; e.currentTarget.style.color = 'var(--ns-toolbar-text)'; } }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = undoColor; }}>
                            <Undo2 size={14} />
                        </button>
                        <button onClick={onRedo} disabled={canRedo === false} title="Redo (Ctrl+Y)"
                            className="flex items-center justify-center w-7 h-7 rounded-sm transition-all duration-150 active:scale-95"
                            style={{ color: redoColor, cursor: redoCursor }}
                            onMouseEnter={(e) => { if (canRedo) { e.currentTarget.style.background = 'var(--ns-toolbar-hover)'; e.currentTarget.style.color = 'var(--ns-toolbar-text)'; } }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = redoColor; }}>
                            <Redo2 size={14} />
                        </button>
                    </ToolSection>

                    <Separator />

                    {/* SELECTION */}
                    <ToolSection label="Select">
                        <ToolButton icon={MousePointer2} label="Select (V)" isActive={activeTool === 'select'} onClick={() => onToolChange('select')} />
                        <ToolButton icon={Hand} label="Hand (H)" isActive={activeTool === ToolType.HAND} onClick={() => onToolChange(ToolType.HAND)} />
                        <button onClick={() => onToolLockChange(!isToolLocked)} title={isToolLocked ? 'Unlock Tool' : 'Lock Tool'}
                            className={`flex items-center justify-center w-7 h-7 rounded-sm transition-all duration-150 ${isToolLocked ? 'bg-[#3B82F6]/15 text-[#3B82F6] ring-1 ring-[#3B82F6]/40' : 'text-[#4a5b6a] hover:bg-[#262e35] hover:text-[#8b9dad]'}`}>
                            {isToolLocked ? <Lock size={12} /> : <Unlock size={12} />}
                        </button>
                    </ToolSection>

                    <Separator />

                    {/* TOOLS */}
                    <ToolSection label="Tools">
                        {/* Pen (just activates pen, no dropdown) */}
                        <ToolButton icon={Pencil} label="Pen (P)" isActive={activeTool === ToolType.PEN} onClick={() => onToolChange(ToolType.PEN)} />

                        {/* Brush Type Dropdown: separate button */}
                        <div className="relative" ref={brushMenuRef}>
                            <button
                                onClick={() => setShowBrushMenu(!showBrushMenu)}
                                title={`Brush Type: ${BRUSH_OPTIONS.find(b => b.type === brushType)?.label || 'Brush'}`}
                                className={`flex items-center justify-center w-7 h-7 rounded-sm transition-all duration-150 ${showBrushMenu ? 'bg-[#3B82F6]/15 text-[#3B82F6] ring-1 ring-[#3B82F6]/40' : 'text-[#8b9dad] hover:bg-[#262e35] hover:text-white'}`}
                            >
                                <Paintbrush size={16} />
                                <ChevronDown size={8} className="absolute bottom-0 right-0 opacity-60" />
                            </button>

                            {/* Brush Dropdown Panel */}
                            {showBrushMenu && (
                                <DropdownPortal triggerRef={brushMenuRef}>
                                    <div className="w-[280px] bg-[#151a1f] border border-[#2a333b] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] overflow-hidden"
                                        style={{ animation: 'fadeIn 150ms ease-out' }}>
                                        <div className="px-2 pt-2 pb-1">
                                            <div className="text-[10px] font-semibold uppercase text-[#4a5b6a] tracking-wider px-2 mb-1">Brush Type</div>
                                        </div>
                                        <div className="px-1.5 pb-2 max-h-[380px] overflow-y-auto">
                                            {BRUSH_OPTIONS.map((brush) => (
                                                <button
                                                    key={brush.type}
                                                    onClick={() => {
                                                        onBrushTypeChange(brush.type);
                                                        if (activeTool !== ToolType.PEN && activeTool !== ToolType.HIGHLIGHTER) {
                                                            onToolChange(ToolType.PEN);
                                                        }
                                                        setShowBrushMenu(false);
                                                    }}
                                                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-100 ${brushType === brush.type
                                                        ? 'bg-[#3B82F6]/10 text-[#3B82F6]'
                                                        : 'text-[#b0bec5] hover:bg-[#1e262d] hover:text-white'
                                                        }`}
                                                >
                                                    <div className={`w-[3px] h-6 rounded-full flex-shrink-0 ${brushType === brush.type ? 'bg-[#3B82F6]' : 'bg-transparent'}`} />
                                                    <span className="text-[12px] font-medium min-w-[85px] text-left">{brush.label}</span>
                                                    <div className={`ml-auto ${brushType === brush.type ? 'text-[#3B82F6]' : 'text-[#7a8c9c]'}`}>
                                                        <BrushPreview brushType={brush.type} />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </DropdownPortal>
                            )}
                        </div>

                        <ToolButton icon={Highlighter} label="Highlighter" isActive={activeTool === ToolType.HIGHLIGHTER} onClick={() => onToolChange(ToolType.HIGHLIGHTER)} />
                        <ToolButton icon={PaintBucket} label="Fill Bucket (G)" isActive={isFillBucket} onClick={() => onToolChange(ToolType.FILL_BUCKET)} />

                        {/* Eraser with dropdown */}
                        <div className="relative" ref={eraserMenuRef}>
                            <ToolButton icon={Eraser} label="Eraser (E)" isActive={isEraserMode} hasDropdown
                                onClick={() => { onToolChange('eraser'); setShowEraserMenu(!showEraserMenu); }} />

                            {showEraserMenu && (
                                <DropdownPortal triggerRef={eraserMenuRef}>
                                    <div className="w-44 p-2.5 bg-[#151a1f] border border-[#2a333b] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col gap-2.5"
                                        style={{ animation: 'fadeIn 150ms ease-out' }}>
                                        <div className="flex gap-1.5 p-0.5 bg-[#0d1117] rounded-lg">
                                            <button className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md ${eraserMode === 'partial' ? 'bg-[#1e262d] text-white shadow-sm' : 'text-[#5a6d7e] hover:text-white'}`}
                                                onClick={() => onEraserModeChange('partial')}>
                                                <Minus size={13} /> Partial
                                            </button>
                                            <button className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md ${eraserMode === 'stroke' ? 'bg-[#1e262d] text-white shadow-sm' : 'text-[#5a6d7e] hover:text-white'}`}
                                                onClick={() => onEraserModeChange('stroke')}>
                                                <Trash2 size={13} /> Stroke
                                            </button>
                                        </div>
                                        {eraserMode === 'partial' && (
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[9px] uppercase font-bold" style={{ color: 'var(--ns-section-label)' }}>
                                                    <span>Size</span><span style={{ color: 'var(--ns-accent)' }}>{eraserSize}px</span>
                                                </div>
                                                <input type="range" min={5} max={50} value={eraserSize}
                                                    onChange={(e) => onEraserSizeChange(Number(e.target.value))}
                                                    className="w-full cursor-pointer" style={{ accentColor: 'var(--ns-accent)' }} />
                                            </div>
                                        )}
                                    </div>
                                </DropdownPortal>
                            )}
                        </div>

                        <ToolButton icon={Type} label="Text (T)" isActive={activeTool === 'text'} onClick={() => onToolChange('text')} />
                        <ToolButton icon={ImageIcon} label="Image (I)" isActive={activeTool === ToolType.IMAGE} onClick={() => { onToolChange(ToolType.IMAGE); onImageUpload?.(); }} />
                        <ToolButton icon={LayoutTemplate} label="Frame (F)" isActive={activeTool === ToolType.FRAME} onClick={() => onToolChange(ToolType.FRAME)} />
                    </ToolSection>

                    <Separator />

                    {/* SHAPES */}
                    <div className="relative -mt-2" ref={shapesMenuRef}>
                        <ToolSection label="Shapes">
                            <button
                                onClick={() => setShowShapesMenu(!showShapesMenu)}
                                title="Shapes"
                                className={`mt-0.5 relative flex items-center justify-center -mt-11.5 w-7 h-7 rounded-sm transition-all duration-150 ${isShapeTool || showShapesMenu ? 'shadow-sm' : ''}`}
                                style={{
                                    background: isShapeTool ? 'var(--ns-toolbar-active-bg)' : showShapesMenu ? 'var(--ns-toolbar-hover)' : 'transparent',
                                    color: isShapeTool ? 'var(--ns-toolbar-active-text)' : 'var(--ns-toolbar-muted)',
                                    boxShadow: isShapeTool ? '0 0 8px var(--ns-toolbar-active-ring)' : 'none',
                                    ...(isShapeTool ? { outline: '1px solid var(--ns-toolbar-active-ring)' } : {}),
                                }}
                                onMouseEnter={(e) => { if (!isShapeTool) { e.currentTarget.style.background = 'var(--ns-toolbar-hover)'; e.currentTarget.style.color = 'var(--ns-toolbar-text)'; } }}
                                onMouseLeave={(e) => { if (!isShapeTool) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ns-toolbar-muted)'; } }}
                            >
                                {(() => {
                                    const activeItem = SHAPE_ITEMS.find(s => s.type === activeTool) || SHAPE_ITEMS.find(s => s.type === lastShapeTool) || SHAPE_ITEMS[0];
                                    return activeItem.icon ? <activeItem.icon size={16} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="6" /></svg>;
                                })()}
                                <ChevronDown size={8} className="absolute bottom-0 right-0 opacity-60" />
                            </button>
                        </ToolSection>
                        {showShapesMenu && (
                            <DropdownPortal triggerRef={shapesMenuRef}>
                                <div className="p-2 bg-[#151a1f] border border-[#2a333b] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
                                    style={{ animation: 'fadeIn 150ms ease-out' }}>
                                    <div className="grid grid-cols-4 gap-1">
                                        {SHAPE_ITEMS.map((shape) => (
                                            <button
                                                key={shape.type}
                                                onClick={() => { onToolChange(shape.type as ActiveTool); setLastShapeTool(shape.type); setShowShapesMenu(false); }}
                                                title={shape.label}
                                                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${activeTool === shape.type ? 'bg-[#3B82F6]/15 text-[#3B82F6] ring-1 ring-[#3B82F6]/40' : 'text-[#8b9dad] hover:bg-[#1e262d] hover:text-white'}`}
                                            >
                                                {shape.icon ? <shape.icon size={16} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="6" /></svg>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </DropdownPortal>
                        )}
                    </div>

                    {/* STROKE STYLE (only for shapes) */}
                    {isShapeTool && (
                        <>
                            <Separator />
                            <div className="relative" ref={strokeStyleRef}>
                                <ToolSection label="Style">
                                    <button onClick={() => setShowStrokeStyleMenu(!showStrokeStyleMenu)} title={`Stroke: ${strokeStyle}`}
                                        className={`relative flex items-center justify-center w-7 h-7 rounded-sm transition-all duration-150 ${showStrokeStyleMenu ? 'bg-[#3B82F6]/15 text-[#3B82F6] ring-1 ring-[#3B82F6]/40' : 'text-[#8b9dad] hover:bg-[#262e35] hover:text-white'}`}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            {strokeStyle === 'solid' && <line x1="3" y1="12" x2="21" y2="12" />}
                                            {strokeStyle === 'dashed' && <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="5 3" />}
                                            {strokeStyle === 'dotted' && <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="2 3" strokeLinecap="round" />}
                                        </svg>
                                        <ChevronDown size={8} className="absolute bottom-0 right-0 opacity-60" />
                                    </button>
                                </ToolSection>

                                {showStrokeStyleMenu && (
                                    <DropdownPortal triggerRef={strokeStyleRef}>
                                        <div className="w-40 bg-[#151a1f] border border-[#2a333b] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-1.5"
                                            style={{ animation: 'fadeIn 150ms ease-out' }}>
                                            {([
                                                { style: 'solid' as StrokeStyle, label: 'Solid', dash: undefined },
                                                { style: 'dashed' as StrokeStyle, label: 'Dashed', dash: '8 4' },
                                                { style: 'dotted' as StrokeStyle, label: 'Dotted', dash: '2 4' },
                                            ]).map(({ style, label, dash }) => (
                                                <button key={style}
                                                    onClick={() => { onStrokeStyleChange(style); setShowStrokeStyleMenu(false); }}
                                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all"
                                                    style={{
                                                        background: strokeStyle === style ? 'var(--ns-toolbar-active-bg, rgba(59,130,246,0.1))' : 'transparent',
                                                        color: strokeStyle === style ? 'var(--ns-toolbar-active-text, #3B82F6)' : 'var(--ns-toolbar-muted, #b0bec5)'
                                                    }}
                                                    onMouseEnter={(e) => { if (strokeStyle !== style) { e.currentTarget.style.background = 'var(--ns-toolbar-hover, #1e262d)'; e.currentTarget.style.color = 'var(--ns-toolbar-text, #fff)'; } }}
                                                    onMouseLeave={(e) => { if (strokeStyle !== style) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ns-toolbar-muted, #b0bec5)'; } }}
                                                >
                                                    <svg width="50" height="6" viewBox="0 0 50 6"><line x1="0" y1="3" x2="50" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" /></svg>
                                                    <span className="text-[11px] font-medium">{label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </DropdownPortal>
                                )}
                            </div>
                        </>
                    )}

                    {/* LINE & ARROW STYLES */}
                    {(activeTool === ToolType.LINE || activeTool === ToolType.ARROW || (hasSelection && onLineTypeChange)) && (
                        <>
                            <Separator />
                            <div className="relative" ref={lineStyleRef}>
                                <ToolSection label="Lines">
                                    <button onClick={() => setShowLineStyleMenu(!showLineStyleMenu)} title="Line Options"
                                        className={`relative flex items-center justify-center w-7 h-7 rounded-sm transition-all duration-150 ${showLineStyleMenu ? 'bg-[#3B82F6]/15 text-[#3B82F6] ring-1 ring-[#3B82F6]/40' : 'text-[#8b9dad] hover:bg-[#262e35] hover:text-white'}`}>
                                        {lineType === 'curved' && <IconCurvedLine />}
                                        {lineType === 'straight' && <IconStraightLine />}
                                        {lineType === 'stepped' && <IconSteppedLine />}
                                        <ChevronDown size={8} className="absolute bottom-0 right-0 opacity-60" />
                                    </button>
                                </ToolSection>

                                {showLineStyleMenu && (
                                    <DropdownPortal triggerRef={lineStyleRef}>
                                        <div className="w-48 bg-[#151a1f] border border-[#2a333b] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-2 flex flex-col gap-3"
                                            style={{ animation: 'fadeIn 150ms ease-out' }}>

                                            {/* Line Styles */}
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-[#8b9dad] mb-1.5 px-1 tracking-wider">Line Style</div>
                                                <div className="flex gap-1">
                                                    {[
                                                        { type: 'straight', icon: IconStraightLine, title: 'Straight' },
                                                        { type: 'curved', icon: IconCurvedLine, title: 'Curved' },
                                                        { type: 'stepped', icon: IconSteppedLine, title: 'Stepped' },
                                                    ].map((style) => (
                                                        <button key={style.type} title={style.title}
                                                            onClick={() => onLineTypeChange?.(style.type as any)}
                                                            className={`flex-1 flex justify-center py-2 rounded-lg transition-all ${lineType === style.type ? 'bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30' : 'text-[#b0bec5] hover:bg-[#1e262d] hover:text-white border border-transparent'}`}>
                                                            <style.icon />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Arrow Heads */}
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-[#8b9dad] mb-1.5 px-1 tracking-wider">Arrows</div>
                                                <div className="flex gap-1">
                                                    {/* Start */}
                                                    <div className="flex-1 flex gap-0.5 p-1 bg-[#0d1117] rounded-lg">
                                                        <button onClick={() => onArrowAtStartChange?.(true)} title="Arrow Start"
                                                            className={`flex-1 flex justify-center py-1.5 rounded-md transition-all ${arrowAtStart ? 'bg-[#1e262d] text-[#3B82F6]' : 'text-[#5a6d7e] hover:text-white'}`}>
                                                            <IconArrowStart />
                                                        </button>
                                                        <button onClick={() => onArrowAtStartChange?.(false)} title="Line Start"
                                                            className={`flex-1 flex justify-center py-1.5 rounded-md transition-all ${!arrowAtStart ? 'bg-[#1e262d] text-[#3B82F6]' : 'text-[#5a6d7e] hover:text-white'}`}>
                                                            <IconArrowNone />
                                                        </button>
                                                    </div>
                                                    {/* End */}
                                                    <div className="flex-1 flex gap-0.5 p-1 bg-[#0d1117] rounded-lg">
                                                        <button onClick={() => onArrowAtEndChange?.(false)} title="Line End"
                                                            className={`flex-1 flex justify-center py-1.5 rounded-md transition-all ${!arrowAtEnd ? 'bg-[#1e262d] text-[#3B82F6]' : 'text-[#5a6d7e] hover:text-white'}`}>
                                                            <IconArrowNone />
                                                        </button>
                                                        <button onClick={() => onArrowAtEndChange?.(true)} title="Arrow End"
                                                            className={`flex-1 flex justify-center py-1.5 rounded-md transition-all ${arrowAtEnd ? 'bg-[#1e262d] text-[#3B82F6]' : 'text-[#5a6d7e] hover:text-white'}`}>
                                                            <IconArrowEnd />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    </DropdownPortal>
                                )}
                            </div>
                        </>
                    )}

                    {!isEraserMode && (
                        <>
                            <Separator />
                            <ToolSection label="Stroke">
                                <div
                                className="w-5 h-5 rounded-full border-2 relative shadow-sm transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                                    style={{
                                        borderColor: activeColorMode === 'stroke' ? (theme === 'light' ? '#3B82F6' : '#66FCF1') : (theme === 'light' ? '#cbd5e1' : '#4b5563'),
                                        boxShadow: activeColorMode === 'stroke' ? `0 0 0 2px ${theme === 'light' ? '#3B82F6' : '#66FCF1'}` : 'none',
                                    }}
                                    onClick={() => setActiveColorMode('stroke')}
                                    title="Stroke Color"
                                >
                                    <div className="absolute inset-0 rounded-full border border-black/20" style={{ background: strokeColor }} />
                                    <input type="color" value={strokeColor} onChange={(e) => onColorChange(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                                </div>
                            </ToolSection>
                            <Separator />
                            <ToolSection label="Fill">
                                <div
                                    className="w-5 h-5 rounded-full border-2 relative shadow-sm transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                                    style={{
                                        borderColor: activeColorMode === 'fill' ? (theme === 'light' ? '#3B82F6' : '#66FCF1') : (theme === 'light' ? '#cbd5e1' : '#4b5563'),
                                        boxShadow: activeColorMode === 'fill' ? `0 0 0 2px ${theme === 'light' ? '#3B82F6' : '#66FCF1'}` : 'none',
                                    }}
                                    onClick={() => setActiveColorMode('fill')}
                                    title="Fill Color"
                                >
                                    {fillColor === 'transparent' ? (
                                        <div className={`absolute inset-0 flex items-center justify-center text-red-500 rounded-full ${theme === 'light' ? 'bg-gray-100' : 'bg-[#1e262d]'}`}>
                                            <Slash size={10} strokeWidth={1} />
                                        </div>
                                    ) : (
                                        <div className="absolute inset-0 rounded-full border border-black/20" style={{ background: fillColor }} />
                                    )}
                                    <input type="color" value={fillColor === 'transparent' ? '#ffffff' : fillColor} onChange={(e) => { setActiveColorMode('fill'); onFillColorChange(e.target.value); }} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                                </div>
                            </ToolSection>
                            <Separator />
                            <ToolSection label="Colors">
                                <div className="relative" ref={colorMenuRef}>
                                    <button
                                        onClick={() => setShowColorMenu(!showColorMenu)}
                                        className="w-5 h-5 rounded-full border-2 cursor-pointer relative shadow-sm transition-all duration-200 hover:scale-110 active:scale-95"
                                        style={{
                                            borderColor: showColorMenu ? (theme === 'light' ? '#3B82F6' : '#66FCF1') : (theme === 'light' ? '#cbd5e1' : '#4b5563'),
                                            boxShadow: showColorMenu ? `0 0 0 2px ${theme === 'light' ? '#3B82F6' : '#66FCF1'}` : 'none',
                                        }}
                                        title="Color Palette"
                                    >
                                        {(() => {
                                            const currentColor = activeColorMode === 'stroke' ? strokeColor : fillColor;
                                            if (currentColor === 'transparent') {
                                                return <div className={`absolute inset-0 flex items-center justify-center text-red-500 rounded-full ${theme === 'light' ? 'bg-gray-100' : 'bg-[#1e262d]'}`}>
                                                    <Slash size={10} strokeWidth={2} />
                                                </div>;
                                            }
                                            return <div className="absolute inset-0 rounded-full border border-black/20" style={{ background: currentColor }} />;
                                        })()}
                                        <ChevronDown size={7} className="absolute -bottom-0.5 -right-0.5 opacity-60" style={{ color: 'var(--ns-toolbar-muted)' }} />
                                    </button>
                                    {showColorMenu && (
                                        <DropdownPortal triggerRef={colorMenuRef}>
                                            <div className="p-2 bg-[#151a1f] border border-[#2a333b] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
                                                style={{ animation: 'fadeIn 150ms ease-out' }}>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    <button
                                                        onClick={() => { setActiveColorMode('fill'); onFillColorChange('transparent'); setShowColorMenu(false); }}
                                                        className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all hover:scale-110 ${fillColor === 'transparent' && activeColorMode === 'fill' ? 'ring-2 ring-[#3B82F6] border-transparent' : 'border-gray-600 hover:border-gray-400'}`}
                                                        style={{ background: theme === 'light' ? '#f1f5f9' : '#1a2025' }}
                                                        title="No Fill"
                                                    >
                                                        <Slash size={12} className="text-red-400" />
                                                    </button>
                                                    {DROPDOWN_COLORS.map(c => {
                                                        const isSelected = (activeColorMode === 'stroke' && strokeColor === c) || (activeColorMode === 'fill' && fillColor === c);
                                                        return (
                                                            <button
                                                                key={c}
                                                                onClick={() => { activeColorMode === 'stroke' ? onColorChange(c) : onFillColorChange(c); setShowColorMenu(false); }}
                                                                className={`w-7 h-7 rounded-full border transition-all hover:scale-110 ${isSelected ? 'ring-2 ring-[#3B82F6] border-transparent' : 'border-gray-700/50 hover:border-white'}`}
                                                                style={{ background: c }}
                                                                title={c}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </DropdownPortal>
                                    )}
                                </div>
                            </ToolSection>
                        </>
                    )}

                    {/* WIDTH & RADIUS */}
                    {
                        (isDrawMode || isFillBucket || (hasSelection && cornerRadius !== undefined)) && (
                            <>
                                <Separator />
                                <ToolSection label="Properties">
                                    <div className="flex gap-4 px-1">
                                        {/* Size Slider */}
                                        <div className="flex flex-col gap-0.5 w-[56px]">
                                            <div className="flex justify-between text-[10px] font-mono mb-1" style={{ color: 'var(--ns-section-label)' }}>
                                                <span>SIZE</span>
                                                <span className="font-bold" style={{ color: 'var(--ns-accent)' }}>{brushSize}px</span>
                                            </div>
                                            <input type="range" min={1} max={50} value={brushSize}
                                                onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                                                className="w-full cursor-pointer" style={{ accentColor: 'var(--ns-accent)' }} />
                                        </div>

                                        {/* Corner Radius Slider (Contextual) */}
                                        {(activeTool === ToolType.RECTANGLE || (hasSelection && cornerRadius !== undefined)) && (
                                            <div className="flex flex-col gap-0.5 w-[56px] animate-fadeIn">
                                                <div className="flex justify-between text-[10px] font-mono mb-1" style={{ color: 'var(--ns-section-label)' }}>
                                                    <span>ROUNDNESS</span>
                                                    <span className="font-bold text-[#a855f7]">{Math.round(cornerRadius || 0)}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="50"
                                                    value={cornerRadius || 0}
                                                    onChange={(e) => onCornerRadiusChange?.(Number(e.target.value))}
                                                    className="w-full cursor-pointer" style={{ accentColor: '#a855f7' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </ToolSection>
                            </>
                        )
                    }



                    {/* LAYERS */}
                    {
                        hasSelection && (
                            <>
                                <Separator />
                                <ToolSection label="Layers">
                                    <ToolButton icon={ArrowUp} label="Bring Forward" isActive={false} onClick={onBringForward} />
                                    <ToolButton icon={ArrowDown} label="Send Backward" isActive={false} onClick={onSendBackward} />
                                    {onDeleteSelected && (
                                        <button onClick={onDeleteSelected} title="Delete (Del)"
                                            className="flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 text-[#f87171] hover:bg-[#f87171]/10">
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </ToolSection>
                            </>
                        )
                    }

                    <Separator />

                    {/* GRID */}
                    <ToolSection label="View">
                        <div className="relative" ref={gridMenuRef}>
                            <button
                                onClick={() => setShowGridMenu(!showGridMenu)}
                                title="Grid Settings"
                                className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 ${showGridMenu || (gridConfig.appearance !== 'dots' && gridConfig.appearance as any !== 'none') ? 'text-[#3B82F6] bg-[#3B82F6]/10' : 'text-[#8b9dad] hover:bg-[#262e35] hover:text-white'}`}
                            >
                                <Grid3x3 size={18} />
                                {/* Show dot if grid is active */}
                                {(gridConfig.snapEnabled || (gridConfig.appearance !== 'dots' && gridConfig.appearance as any !== 'none')) && (
                                    <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#3B82F6] rounded-full" />
                                )}
                            </button>

                            {showGridMenu && (
                                <DropdownPortal triggerRef={gridMenuRef} offsetY={12}>
                                    <div className="w-[220px] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] overflow-hidden transition-colors"
                                        style={{ animation: 'fadeIn 150ms ease-out', background: 'var(--ns-panel-bg, #151a1f)', border: '1px solid var(--ns-panel-border, #2a333b)', boxShadow: 'var(--ns-panel-shadow)' }}>

                                        <div className="px-3 py-2 flex justify-between items-center transition-colors border-b" style={{ background: 'var(--ns-toolbar-hover, #1e262d)', borderColor: 'var(--ns-separator, #2a333b)' }}>
                                            <span className="text-[11px] font-bold" style={{ color: 'var(--ns-toolbar-text, #dde3e8)' }}>Grid Options</span>
                                        </div>

                                        <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">

                                            {/* Snap Toggle */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ns-section-label, #8b9dad)' }}>Snap to Grid</span>
                                                <button
                                                    onClick={() => onGridConfigChange({ ...gridConfig, snapEnabled: !gridConfig.snapEnabled })}
                                                    className="relative w-8 h-4 rounded-full transition-colors"
                                                    style={{ background: gridConfig.snapEnabled ? 'var(--ns-accent, #3B82F6)' : 'var(--ns-separator, #2a333b)' }}
                                                >
                                                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${gridConfig.snapEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </button>
                                            </div>

                                            {/* Snap Type */}
                                            {gridConfig.snapEnabled && (
                                                <div className="space-y-1.5">
                                                    <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ns-section-label, #8b9dad)' }}>Grid Snapping</div>
                                                    <div className="flex flex-col gap-1">
                                                        {[
                                                            { value: 'none', label: 'None' },
                                                            { value: 'horizontal_lines', label: 'Horizontal Lines' },
                                                            { value: 'vertical_lines', label: 'Vertical Lines' },
                                                            { value: 'lines', label: 'Lines' },
                                                            { value: 'points', label: 'Points' },
                                                        ].map(opt => (
                                                            <label key={opt.value}
                                                                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-[11px] transition-colors ${gridConfig.snapType === opt.value
                                                                    ? 'bg-[#3B82F6]/10 text-[#3B82F6]'
                                                                    : 'text-[#8b9dad] hover:bg-[#1e262d] hover:text-white'
                                                                    }`}
                                                                onClick={() => onGridConfigChange({ ...gridConfig, snapType: opt.value as GridSnapType })}
                                                            >
                                                                <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${gridConfig.snapType === opt.value
                                                                    ? 'border-[#3B82F6]'
                                                                    : 'border-[#4a5568]'
                                                                    }`}>
                                                                    {gridConfig.snapType === opt.value && (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                                                                    )}
                                                                </span>
                                                                {opt.label}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="w-full h-px" style={{ background: 'var(--ns-separator, #2a333b)' }} />

                                            {/* Appearance */}
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ns-section-label, #8b9dad)' }}>Appearance</div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {['dots', 'lines', 'crosses', 'none'].map(app => {
                                                        const isSel = gridConfig.appearance === app;
                                                        return (
                                                            <button key={app} onClick={() => onGridConfigChange({ ...gridConfig, appearance: app as GridAppearance })}
                                                                className="px-2 py-1 text-[11px] rounded transition-colors border"
                                                                style={{
                                                                    background: isSel ? 'var(--ns-toolbar-active-bg, rgba(59,130,246,0.15))' : 'transparent',
                                                                    color: isSel ? 'var(--ns-toolbar-active-text, #3B82F6)' : 'var(--ns-toolbar-muted, #8b9dad)',
                                                                    borderColor: isSel ? 'transparent' : 'var(--ns-separator, #2a333b)'
                                                                }}
                                                                onMouseEnter={(e) => { if (!isSel) { e.currentTarget.style.background = 'var(--ns-toolbar-hover, #1e262d)'; e.currentTarget.style.color = 'var(--ns-toolbar-text, #fff)'; } }}
                                                                onMouseLeave={(e) => { if (!isSel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ns-toolbar-muted, #8b9dad)'; } }}
                                                            >{app === 'none' ? 'Hidden' : app}</button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Size Slider */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ns-section-label, #8b9dad)' }}>Cell Size</span>
                                                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--ns-toolbar-active-text, #3B82F6)' }}>{gridConfig.size}px</span>
                                                </div>
                                                <div className="relative pt-2 pb-1">
                                                    <input type="range" min="10" max="100" step="5" value={gridConfig.size}
                                                        onChange={(e) => onGridConfigChange({ ...gridConfig, size: Number(e.target.value) })}
                                                        className="w-full cursor-pointer" style={{ accentColor: 'var(--ns-accent)' }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Color Picker */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ns-section-label, #8b9dad)' }}>Color</span>
                                                    <div className="relative">
                                                        <div
                                                            className="w-6 h-6 rounded-full border-2 cursor-pointer transition-shadow hover:shadow-md"
                                                            style={{ backgroundColor: gridConfig.color, borderColor: 'var(--ns-separator, #2a333b)' }}
                                                            onClick={() => gridColorRef.current?.click()}
                                                        />
                                                        <input
                                                            ref={gridColorRef}
                                                            type="color"
                                                            value={gridConfig.color}
                                                            onChange={(e) => onGridConfigChange({ ...gridConfig, color: e.target.value })}
                                                            className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </DropdownPortal>
                            )}
                        </div>
                    </ToolSection>

                    {/* Lock Session Button: only visible if user owns the board */}
                    {isOwner && onToggleLock && (
                        <>
                            <Separator />
                            <ToolSection label={isLockActive ? 'LOCKED' : 'UNLOCKED'}>
                                <button
                                    onClick={() => onToggleLock()}
                                    className="px-1 py-0.75 ph-1 rounded-lg transition-all duration-200 border group"
                                    style={{
                                        background: isLockActive
                                            ? 'rgba(239,68,68,0.1)'
                                            : 'var(--ns-toolbar-active-bg, rgba(59,130,246,0.1))',
                                        borderColor: isLockActive
                                            ? 'rgba(239,68,68,0.3)'
                                            : 'var(--ns-toolbar-active-ring, rgba(59,130,246,0.3))',
                                        color: isLockActive
                                            ? '#ef4444'
                                            : 'var(--ns-toolbar-active-text, #3B82F6)',
                                    }}
                                    title={isLockActive ? 'Unlock Session' : 'Lock Session'}
                                >
                                    <span key={isLockActive ? 'locked' : 'unlocked'} className="inline-flex" style={{ animation: 'lockBounce 0.35s ease-out' }}>
                                        {isLockActive ? <Lock size={18} /> : <Unlock size={18} />}
                                    </span>
                                </button>
                            </ToolSection>
                        </>
                    )}

                </div>
            </div>

            {/* Floating Text Formatting Toolbar */}
            {
                (isTextMode || (activeTool === 'select' && isTextSelected)) && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 flex items-center gap-1.5 px-2 py-1.5 rounded-lg shadow-xl animate-fadeIn z-[100] whitespace-nowrap border"
                        style={{ background: 'var(--ns-panel-bg, #151a1f)', borderColor: 'var(--ns-panel-border, #2a333b)', boxShadow: 'var(--ns-panel-shadow)' }}>
                        {/* Font Family */}
                        <div className="relative group">
                            <select value={fontFamily} onChange={(e) => onFontFamilyChange(e.target.value)}
                                className="appearance-none text-[11px] font-medium rounded h-7 pl-2 pr-6 outline-none cursor-pointer min-w-[120px] transition-colors border"
                                style={{ background: 'var(--ns-toolbar-bg, #0d1117)', color: 'var(--ns-toolbar-text, #fff)', borderColor: 'var(--ns-separator, #2a333b)' }}
                            >
                                <option value="Arial">Arial</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Courier New">Courier New</option>
                            </select>
                            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ns-toolbar-muted)' }} />
                        </div>

                        <div className="w-px h-4" style={{ background: 'var(--ns-separator)' }} />

                        {/* Font Size */}
                        <div className="relative group">
                            <select value={fontSize} onChange={(e) => onFontSizeChange(Number(e.target.value))}
                                className="appearance-none text-[11px] font-medium rounded h-7 pl-2 pr-6 outline-none cursor-pointer min-w-[60px] transition-colors border"
                                style={{ background: 'var(--ns-toolbar-bg, #0d1117)', color: 'var(--ns-toolbar-text, #fff)', borderColor: 'var(--ns-separator, #2a333b)' }}
                            >
                                {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ns-toolbar-muted)' }} />
                        </div>

                        <div className="w-px h-4" style={{ background: 'var(--ns-separator)' }} />

                        {/* Bold/Italic/Underline */}
                        <div className="flex rounded p-0.5 gap-0.5 border" style={{ background: 'var(--ns-toolbar-bg, #0d1117)', borderColor: 'var(--ns-separator, #2a333b)' }}>
                            <button
                                onClick={() => onBoldChange(!isBold)}
                                className="p-1 rounded transition-colors"
                                style={{ background: isBold ? 'var(--ns-toolbar-active-bg, rgba(59,130,246,0.2))' : 'transparent', color: isBold ? 'var(--ns-toolbar-active-text, #3B82F6)' : 'var(--ns-toolbar-muted, #9ca3af)' }}
                                onMouseEnter={(e) => { if (!isBold) { e.currentTarget.style.background = 'var(--ns-toolbar-hover, #1e262d)'; e.currentTarget.style.color = 'var(--ns-toolbar-text, #fff)'; } }}
                                onMouseLeave={(e) => { if (!isBold) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ns-toolbar-muted, #9ca3af)'; } }}
                            ><Bold size={13} /></button>
                            <button
                                onClick={() => onItalicChange(!isItalic)}
                                className="p-1 rounded transition-colors"
                                style={{ background: isItalic ? 'var(--ns-toolbar-active-bg, rgba(59,130,246,0.2))' : 'transparent', color: isItalic ? 'var(--ns-toolbar-active-text, #3B82F6)' : 'var(--ns-toolbar-muted, #9ca3af)' }}
                                onMouseEnter={(e) => { if (!isItalic) { e.currentTarget.style.background = 'var(--ns-toolbar-hover, #1e262d)'; e.currentTarget.style.color = 'var(--ns-toolbar-text, #fff)'; } }}
                                onMouseLeave={(e) => { if (!isItalic) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ns-toolbar-muted, #9ca3af)'; } }}
                            ><Italic size={13} /></button>
                            <button
                                onClick={() => onUnderlineChange(!isUnderline)}
                                className="p-1 rounded transition-colors"
                                style={{ background: isUnderline ? 'var(--ns-toolbar-active-bg, rgba(59,130,246,0.2))' : 'transparent', color: isUnderline ? 'var(--ns-toolbar-active-text, #3B82F6)' : 'var(--ns-toolbar-muted, #9ca3af)' }}
                                onMouseEnter={(e) => { if (!isUnderline) { e.currentTarget.style.background = 'var(--ns-toolbar-hover, #1e262d)'; e.currentTarget.style.color = 'var(--ns-toolbar-text, #fff)'; } }}
                                onMouseLeave={(e) => { if (!isUnderline) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ns-toolbar-muted, #9ca3af)'; } }}
                            ><Underline size={13} /></button>
                        </div>

                        {/* Align */}
                        <>
                            <div className="w-px h-4" style={{ background: 'var(--ns-separator)' }} />

                            <div className="flex rounded p-0.5 gap-0.5 border" style={{ background: 'var(--ns-toolbar-bg, #0d1117)', borderColor: 'var(--ns-separator, #2a333b)' }}>
                                <button
                                    onClick={() => onTextAlignChange('left')}
                                    className="p-1 rounded transition-colors"
                                    style={{ background: textAlign === 'left' ? 'var(--ns-toolbar-active-bg, rgba(59,130,246,0.2))' : 'transparent', color: textAlign === 'left' ? 'var(--ns-toolbar-active-text, #3B82F6)' : 'var(--ns-toolbar-muted, #9ca3af)' }}
                                    onMouseEnter={(e) => { if (textAlign !== 'left') { e.currentTarget.style.background = 'var(--ns-toolbar-hover, #1e262d)'; e.currentTarget.style.color = 'var(--ns-toolbar-text, #fff)'; } }}
                                    onMouseLeave={(e) => { if (textAlign !== 'left') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ns-toolbar-muted, #9ca3af)'; } }}
                                ><AlignLeft size={13} /></button>
                                <button
                                    onClick={() => onTextAlignChange('center')}
                                    className="p-1 rounded transition-colors"
                                    style={{ background: textAlign === 'center' ? 'var(--ns-toolbar-active-bg, rgba(59,130,246,0.2))' : 'transparent', color: textAlign === 'center' ? 'var(--ns-toolbar-active-text, #3B82F6)' : 'var(--ns-toolbar-muted, #9ca3af)' }}
                                    onMouseEnter={(e) => { if (textAlign !== 'center') { e.currentTarget.style.background = 'var(--ns-toolbar-hover, #1e262d)'; e.currentTarget.style.color = 'var(--ns-toolbar-text, #fff)'; } }}
                                    onMouseLeave={(e) => { if (textAlign !== 'center') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ns-toolbar-muted, #9ca3af)'; } }}
                                ><AlignCenter size={13} /></button>
                                <button
                                    onClick={() => onTextAlignChange('right')}
                                    className="p-1 rounded transition-colors"
                                    style={{ background: textAlign === 'right' ? 'var(--ns-toolbar-active-bg, rgba(59,130,246,0.2))' : 'transparent', color: textAlign === 'right' ? 'var(--ns-toolbar-active-text, #3B82F6)' : 'var(--ns-toolbar-muted, #9ca3af)' }}
                                    onMouseEnter={(e) => { if (textAlign !== 'right') { e.currentTarget.style.background = 'var(--ns-toolbar-hover, #1e262d)'; e.currentTarget.style.color = 'var(--ns-toolbar-text, #fff)'; } }}
                                    onMouseLeave={(e) => { if (textAlign !== 'right') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ns-toolbar-muted, #9ca3af)'; } }}
                                ><AlignRight size={13} /></button>
                            </div>
                        </>
                    </div>
                )
            }

            {/* Dropdown animation */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-4px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes lockBounce {
                    0% { transform: scale(0.5) rotate(-15deg); opacity: 0.3; }
                    50% { transform: scale(1.2) rotate(5deg); opacity: 1; }
                    100% { transform: scale(1) rotate(0deg); opacity: 1; }
                }
                [data-component="toolbar"] .overflow-x-auto::-webkit-scrollbar { display: none; }
            `}</style>
        </div >
    );
}