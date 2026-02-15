import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { ToolType, BrushType, StrokeStyle } from '../../types/shapes';

/* --- TYPES --- */
export type ActiveTool = ToolType | 'text' | 'select' | 'eraser';
export type EraserMode = 'partial' | 'stroke';

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
];

/* --- SVG BRUSH PREVIEW --- */
const BrushPreview = ({ brushType }: { brushType: BrushType }) => {
    const getPath = () => {
        switch (brushType) {
            case BrushType.BRUSH:
                return <path d="M4 20 Q18 5, 50 14 Q70 20, 96 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />;
            case BrushType.CALLIGRAPHY:
                return <path d="M4 18 Q14 5, 28 13 Q42 22, 58 8 Q74 2, 96 12" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="butt" />;
            case BrushType.CALLIGRAPHY_PEN:
                return <path d="M4 18 Q22 6, 48 14 Q68 20, 96 8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="square" />;
            case BrushType.AIRBRUSH:
                return <g>{Array.from({ length: 25 }, (_, i) => <circle key={i} cx={8 + Math.sin(i * 1.3) * 35 + 40} cy={4 + Math.cos(i * 0.9) * 10 + 10} r={0.6 + (i % 3) * 0.6} fill="currentColor" opacity={0.25} />)}</g>;
            case BrushType.OIL_BRUSH:
                return <path d="M4 15 Q18 6, 38 14 Q55 20, 70 10 Q84 4, 96 12" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.85" />;
            case BrushType.CRAYON:
                return <path d="M4 15 Q14 9, 28 14 Q40 18, 52 12 Q64 6, 78 14 Q90 19, 96 10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="3 1" opacity="0.7" />;
            case BrushType.MARKER:
                return <path d="M4 14 Q28 7, 50 14 Q78 21, 96 11" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="square" opacity="0.55" />;
            case BrushType.NATURAL_PENCIL:
                return <path d="M4 18 Q18 8, 38 14 Q58 20, 78 10 Q90 6, 96 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.9" />;
            case BrushType.WATERCOLOUR:
                return <path d="M4 14 Q22 4, 48 14 Q74 24, 96 10" stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.25" />;
        }
    };
    return <svg width="100" height="26" viewBox="0 0 100 26" className="flex-shrink-0">{getPath()}</svg>;
};

/* --- COMPONENTS --- */

const ToolButton = ({
    isActive, onClick, icon: Icon, label, hasDropdown = false, size = 18,
}: {
    isActive: boolean; onClick: () => void; icon: any; label: string; hasDropdown?: boolean; size?: number;
}) => (
    <button
        onClick={onClick}
        title={label}
        className={`
            relative group flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150
            ${isActive
                ? 'bg-[#2dd4bf]/15 text-[#2dd4bf] ring-1 ring-[#2dd4bf]/40 shadow-[0_0_8px_rgba(45,212,191,0.15)]'
                : 'text-[#8b9dad] hover:bg-[#262e35] hover:text-white'
            }
        `}
    >
        <Icon size={size} />
        {hasDropdown && (
            <ChevronDown size={8} className="absolute bottom-0.5 right-0.5 opacity-60" />
        )}
    </button>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[8px] font-semibold uppercase text-[#4a5b6a] tracking-[0.12em] text-center select-none leading-none">
        {children}
    </div>
);

const ToolSection = ({ children, label }: { children: React.ReactNode; label: string }) => (
    <div className="flex flex-col items-center gap-[3px]">
        <div className="flex items-center gap-[2px]">
            {children}
        </div>
        <SectionLabel>{label}</SectionLabel>
    </div>
);

const Separator = () => <div className="w-px h-9 bg-[#2a333b] mx-1.5 self-center" />;

/* --- MS PAINT COLOR PALETTE --- */
const ROW1_COLORS = ['#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4'];
const ROW2_COLORS = ['#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7'];

export default function Toolbar({
    activeTool, onToolChange,
    isToolLocked, onToolLockChange,
    brushSize, onBrushSizeChange,
    strokeColor, onColorChange,
    fillColor, onFillColorChange,
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
}: ToolbarProps) {
    const [showEraserMenu, setShowEraserMenu] = useState(false);
    const [showBrushMenu, setShowBrushMenu] = useState(false);
    const [showStrokeStyleMenu, setShowStrokeStyleMenu] = useState(false);
    const eraserMenuRef = useRef<HTMLDivElement>(null);
    const brushMenuRef = useRef<HTMLDivElement>(null);
    const strokeStyleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (eraserMenuRef.current && !eraserMenuRef.current.contains(event.target as Node)) setShowEraserMenu(false);
            if (brushMenuRef.current && !brushMenuRef.current.contains(event.target as Node)) setShowBrushMenu(false);
            if (strokeStyleRef.current && !strokeStyleRef.current.contains(event.target as Node)) setShowStrokeStyleMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isShapeTool = [ToolType.RECTANGLE, ToolType.CIRCLE, ToolType.ELLIPSE, ToolType.LINE, ToolType.ARROW, ToolType.TRIANGLE].includes(activeTool as ToolType);
    const isBrushTool = [ToolType.PEN, ToolType.HIGHLIGHTER].includes(activeTool as ToolType);
    const isDrawMode = isShapeTool || isBrushTool;
    const isTextMode = activeTool === 'text';
    const isEraserMode = activeTool === 'eraser';
    const isFillBucket = activeTool === ToolType.FILL_BUCKET;

    const FONT_SIZES = [
        { label: 'S', size: 14 },
        { label: 'M', size: 18 },
        { label: 'L', size: 24 },
        { label: 'XL', size: 32 }
    ] as const;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50" data-component="toolbar">
            <div className="flex items-stretch gap-0 px-3 py-1.5 bg-[#151a1f]/97 backdrop-blur-2xl border border-[#2a333b]/80 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-[#dde3e8]">

                {/* ═══ HISTORY ═══ */}
                <ToolSection label="History">
                    <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)"
                        className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 ${!canUndo ? 'text-[#2a333b] cursor-not-allowed' : 'text-[#5a6d7e] hover:bg-[#262e35] hover:text-white active:scale-95'}`}>
                        <Undo2 size={15} />
                    </button>
                    <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)"
                        className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 ${!canRedo ? 'text-[#2a333b] cursor-not-allowed' : 'text-[#5a6d7e] hover:bg-[#262e35] hover:text-white active:scale-95'}`}>
                        <Redo2 size={15} />
                    </button>
                </ToolSection>

                <Separator />

                {/* ═══ SELECTION ═══ */}
                <ToolSection label="Select">
                    <ToolButton icon={MousePointer2} label="Select (V)" isActive={activeTool === 'select'} onClick={() => onToolChange('select')} />
                    <button onClick={() => onToolLockChange(!isToolLocked)} title={isToolLocked ? 'Unlock Tool' : 'Lock Tool'}
                        className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 ${isToolLocked ? 'bg-[#2dd4bf]/15 text-[#2dd4bf] ring-1 ring-[#2dd4bf]/40' : 'text-[#4a5b6a] hover:bg-[#262e35] hover:text-[#8b9dad]'}`}>
                        {isToolLocked ? <Lock size={13} /> : <Unlock size={13} />}
                    </button>
                </ToolSection>

                <Separator />

                {/* ═══ BRUSHES ═══ */}
                <ToolSection label="Brushes">
                    {/* Pen (just activates pen, no dropdown) */}
                    <ToolButton icon={Pencil} label="Pen (P)" isActive={activeTool === ToolType.PEN} onClick={() => onToolChange(ToolType.PEN)} />

                    {/* Brush Type Dropdown — separate button */}
                    <div className="relative" ref={brushMenuRef}>
                        <button
                            onClick={() => setShowBrushMenu(!showBrushMenu)}
                            title={`Brush Type: ${BRUSH_OPTIONS.find(b => b.type === brushType)?.label || 'Brush'}`}
                            className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 ${showBrushMenu ? 'bg-[#2dd4bf]/15 text-[#2dd4bf] ring-1 ring-[#2dd4bf]/40' : 'text-[#8b9dad] hover:bg-[#262e35] hover:text-white'}`}
                        >
                            <Paintbrush size={16} />
                            <ChevronDown size={8} className="absolute bottom-0.5 right-0.5 opacity-60" />
                        </button>

                        {/* Brush Dropdown Panel */}
                        {showBrushMenu && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[280px] bg-[#151a1f] border border-[#2a333b] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] overflow-hidden z-[200]"
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
                                                ? 'bg-[#2dd4bf]/10 text-[#2dd4bf]'
                                                : 'text-[#b0bec5] hover:bg-[#1e262d] hover:text-white'
                                                }`}
                                        >
                                            {/* Active bar */}
                                            <div className={`w-[3px] h-6 rounded-full flex-shrink-0 ${brushType === brush.type ? 'bg-[#2dd4bf]' : 'bg-transparent'}`} />

                                            {/* Name */}
                                            <span className="text-[12px] font-medium min-w-[85px] text-left">{brush.label}</span>

                                            {/* Preview */}
                                            <div className={`ml-auto ${brushType === brush.type ? 'text-[#2dd4bf]' : 'text-[#7a8c9c]'}`}>
                                                <BrushPreview brushType={brush.type} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <ToolButton icon={Highlighter} label="Highlighter (H)" isActive={activeTool === ToolType.HIGHLIGHTER} onClick={() => onToolChange(ToolType.HIGHLIGHTER)} />
                    <ToolButton icon={PaintBucket} label="Fill Bucket (G)" isActive={isFillBucket} onClick={() => onToolChange(ToolType.FILL_BUCKET)} />

                    {/* Eraser with dropdown */}
                    <div className="relative" ref={eraserMenuRef}>
                        <ToolButton icon={Eraser} label="Eraser (E)" isActive={isEraserMode} hasDropdown
                            onClick={() => { onToolChange('eraser'); setShowEraserMenu(!showEraserMenu); }} />

                        {showEraserMenu && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-44 p-2.5 bg-[#151a1f] border border-[#2a333b] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col gap-2.5 z-[200]"
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
                                        <div className="flex justify-between text-[9px] uppercase text-[#4a5b6a] font-bold">
                                            <span>Size</span><span>{eraserSize}px</span>
                                        </div>
                                        <input type="range" min={5} max={50} value={eraserSize}
                                            onChange={(e) => onEraserSizeChange(Number(e.target.value))}
                                            className="w-full h-1 bg-[#1e262d] rounded-lg appearance-none cursor-pointer accent-[#2dd4bf]" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ToolSection>

                <Separator />

                {/* ═══ SHAPES ═══ */}
                <ToolSection label="Shapes">
                    <ToolButton icon={Square} label="Rectangle (R)" isActive={activeTool === ToolType.RECTANGLE} onClick={() => onToolChange(ToolType.RECTANGLE)} />
                    <ToolButton icon={Circle} label="Circle (C)" isActive={activeTool === ToolType.CIRCLE} onClick={() => onToolChange(ToolType.CIRCLE)} />
                    {/* Custom Ellipse */}
                    <button onClick={() => onToolChange(ToolType.ELLIPSE)} title="Ellipse"
                        className={`relative group flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 ${activeTool === ToolType.ELLIPSE ? 'bg-[#2dd4bf]/15 text-[#2dd4bf] ring-1 ring-[#2dd4bf]/40 shadow-[0_0_8px_rgba(45,212,191,0.15)]' : 'text-[#8b9dad] hover:bg-[#262e35] hover:text-white'}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="6" /></svg>
                    </button>
                    <ToolButton icon={Triangle} label="Triangle" isActive={activeTool === ToolType.TRIANGLE} onClick={() => onToolChange(ToolType.TRIANGLE)} />
                    <ToolButton icon={Slash} label="Line (L)" isActive={activeTool === ToolType.LINE} onClick={() => onToolChange(ToolType.LINE)} />
                    <ToolButton icon={ArrowRight} label="Arrow" isActive={activeTool === ToolType.ARROW} onClick={() => onToolChange(ToolType.ARROW)} />
                    <ToolButton icon={Type} label="Text (T)" isActive={activeTool === 'text'} onClick={() => onToolChange('text')} />
                </ToolSection>

                {/* ═══ STROKE STYLE (only for shapes) ═══ */}
                {isShapeTool && (
                    <>
                        <Separator />
                        <div className="relative" ref={strokeStyleRef}>
                            <ToolSection label="Style">
                                <button onClick={() => setShowStrokeStyleMenu(!showStrokeStyleMenu)} title={`Stroke: ${strokeStyle}`}
                                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 ${showStrokeStyleMenu ? 'bg-[#2dd4bf]/15 text-[#2dd4bf] ring-1 ring-[#2dd4bf]/40' : 'text-[#8b9dad] hover:bg-[#262e35] hover:text-white'}`}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        {strokeStyle === 'solid' && <line x1="3" y1="12" x2="21" y2="12" />}
                                        {strokeStyle === 'dashed' && <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="5 3" />}
                                        {strokeStyle === 'dotted' && <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="2 3" strokeLinecap="round" />}
                                    </svg>
                                    <ChevronDown size={8} className="absolute bottom-0.5 right-0.5 opacity-60" />
                                </button>
                            </ToolSection>

                            {showStrokeStyleMenu && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 bg-[#151a1f] border border-[#2a333b] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-1.5 z-[200]"
                                    style={{ animation: 'fadeIn 150ms ease-out' }}>
                                    {([
                                        { style: 'solid' as StrokeStyle, label: 'Solid', dash: undefined },
                                        { style: 'dashed' as StrokeStyle, label: 'Dashed', dash: '8 4' },
                                        { style: 'dotted' as StrokeStyle, label: 'Dotted', dash: '2 4' },
                                    ]).map(({ style, label, dash }) => (
                                        <button key={style}
                                            onClick={() => { onStrokeStyleChange(style); setShowStrokeStyleMenu(false); }}
                                            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all ${strokeStyle === style ? 'bg-[#2dd4bf]/10 text-[#2dd4bf]' : 'text-[#b0bec5] hover:bg-[#1e262d] hover:text-white'}`}>
                                            <svg width="50" height="6" viewBox="0 0 50 6"><line x1="0" y1="3" x2="50" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" /></svg>
                                            <span className="text-[11px] font-medium">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                <Separator />

                {/* ═══ COLOURS ═══ */}
                {!isEraserMode && (
                    <ToolSection label="Colours">
                        <div className="flex items-center gap-3 px-1">
                            {/* Stroke & Fill — large overlapping circles (like MS Paint) */}
                            <div className="flex flex-col items-center gap-0">
                                <div className="relative w-[52px] h-[36px]">
                                    {/* Fill (back, bottom-right) */}
                                    <div className="absolute bottom-0 right-0 w-[26px] h-[26px] rounded-md border-2 border-[#2a333b] overflow-hidden cursor-pointer hover:border-[#2dd4bf]/60 transition-colors z-[1] shadow-sm"
                                        title="Fill Color">
                                        <div className="absolute inset-0" style={{ backgroundColor: fillColor }} />
                                        <input type="color" value={fillColor} onChange={(e) => onFillColorChange(e.target.value)}
                                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                                    </div>
                                    {/* Stroke (front, top-left) */}
                                    <div className="absolute top-0 left-0 w-[26px] h-[26px] rounded-md border-2 border-[#3d4a56] overflow-hidden cursor-pointer hover:border-[#2dd4bf]/60 transition-colors z-[2] shadow-md"
                                        title="Stroke Color">
                                        <div className="absolute inset-0" style={{ backgroundColor: strokeColor }} />
                                        <input type="color" value={strokeColor} onChange={(e) => onColorChange(e.target.value)}
                                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-0.5">
                                    <span className="text-[7px] font-bold uppercase text-[#4a5b6a] tracking-wider">Str</span>
                                    <span className="text-[7px] font-bold uppercase text-[#4a5b6a] tracking-wider">Fill</span>
                                </div>
                            </div>

                            {/* Color Grid — 2 rows × 10 cols */}
                            <div className="flex flex-col gap-[2px]">
                                <div className="flex gap-[2px]">
                                    {ROW1_COLORS.map((c) => (
                                        <button key={c} onClick={() => onColorChange(c)} title={c}
                                            className={`w-[14px] h-[14px] rounded-[3px] border transition-all duration-100 hover:scale-[1.3] hover:z-10 ${strokeColor === c ? 'border-[#2dd4bf] ring-1 ring-[#2dd4bf]/50 scale-[1.15]' : 'border-[#1e262d]/80 hover:border-white/40'}`}
                                            style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                                <div className="flex gap-[2px]">
                                    {ROW2_COLORS.map((c) => (
                                        <button key={c} onClick={() => onColorChange(c)} title={c}
                                            className={`w-[14px] h-[14px] rounded-[3px] border transition-all duration-100 hover:scale-[1.3] hover:z-10 ${strokeColor === c ? 'border-[#2dd4bf] ring-1 ring-[#2dd4bf]/50 scale-[1.15]' : 'border-[#1e262d]/80 hover:border-white/40'}`}
                                            style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ToolSection>
                )}

                {/* ═══ WIDTH ═══ */}
                {(isDrawMode || isFillBucket) && (
                    <>
                        <Separator />
                        <ToolSection label="Width">
                            <div className="flex flex-col gap-0.5 w-[72px] mx-0.5">
                                <div className="flex justify-between text-[8px] font-mono text-[#4a5b6a]">
                                    <span>SIZE</span>
                                    <span className="text-[#2dd4bf] font-bold">{brushSize}px</span>
                                </div>
                                <input type="range" min={1} max={20} value={brushSize}
                                    onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                                    className="w-full h-1 bg-[#1e262d] rounded-lg appearance-none cursor-pointer accent-[#2dd4bf]" />
                            </div>
                        </ToolSection>
                    </>
                )}

                {/* ═══ TEXT FORMATTING ═══ */}
                {(isTextMode || activeTool === 'select') && (
                    <>
                        <Separator />
                        <ToolSection label="Text">
                            <div className="flex items-center gap-1.5">
                                <div className="relative">
                                    <select value={fontFamily} onChange={(e) => onFontFamilyChange(e.target.value)}
                                        className="appearance-none bg-[#0d1117] text-[11px] text-white border border-[#1e262d] rounded-md h-7 pl-2 pr-5 focus:border-[#2dd4bf] focus:outline-none cursor-pointer hover:bg-[#1e262d] transition-colors">
                                        <option value="Arial">Arial</option>
                                        <option value="Times New Roman">Times</option>
                                        <option value="Courier New">Courier</option>
                                    </select>
                                    <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#4a5b6a] pointer-events-none" />
                                </div>

                                <div className="flex items-center gap-[2px] bg-[#0d1117] border border-[#1e262d] rounded-md p-[2px]">
                                    {FONT_SIZES.map(({ label, size }) => (
                                        <button key={label} onClick={() => onFontSizeChange(size)}
                                            className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-sm transition-colors ${fontSize === size ? 'bg-[#1e262d] text-white' : 'text-[#5a6d7e] hover:text-white'}`}
                                            title={`${size}px`}>{label}</button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-[1px] bg-[#0d1117] border border-[#1e262d] rounded-md p-[2px]">
                                    <button onClick={() => onBoldChange(!isBold)} className={`p-1 rounded-sm ${isBold ? 'bg-[#1e262d] text-white' : 'text-[#5a6d7e] hover:text-white'}`}><Bold size={12} /></button>
                                    <button onClick={() => onItalicChange(!isItalic)} className={`p-1 rounded-sm ${isItalic ? 'bg-[#1e262d] text-white' : 'text-[#5a6d7e] hover:text-white'}`}><Italic size={12} /></button>
                                    <button onClick={() => onUnderlineChange(!isUnderline)} className={`p-1 rounded-sm ${isUnderline ? 'bg-[#1e262d] text-white' : 'text-[#5a6d7e] hover:text-white'}`}><Underline size={12} /></button>
                                </div>

                                {isTextSelected && (
                                    <div className="flex items-center gap-[1px] bg-[#0d1117] border border-[#1e262d] rounded-md p-[2px]">
                                        <button onClick={() => onTextAlignChange('left')} className={`p-1 rounded-sm ${textAlign === 'left' ? 'bg-[#1e262d] text-white' : 'text-[#5a6d7e] hover:text-white'}`}><AlignLeft size={12} /></button>
                                        <button onClick={() => onTextAlignChange('center')} className={`p-1 rounded-sm ${textAlign === 'center' ? 'bg-[#1e262d] text-white' : 'text-[#5a6d7e] hover:text-white'}`}><AlignCenter size={12} /></button>
                                        <button onClick={() => onTextAlignChange('right')} className={`p-1 rounded-sm ${textAlign === 'right' ? 'bg-[#1e262d] text-white' : 'text-[#5a6d7e] hover:text-white'}`}><AlignRight size={12} /></button>
                                    </div>
                                )}
                            </div>
                        </ToolSection>
                    </>
                )}

                {/* ═══ LAYERS ═══ */}
                {hasSelection && (
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
                )}
            </div>

            {/* Dropdown animation */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-4px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}