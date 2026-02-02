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
    Trash2
} from 'lucide-react';
import { ToolType } from '../../types/shapes';

/* --- TYPES --- */
export type ActiveTool = ToolType | 'text' | 'select' | 'eraser';
export type EraserMode = 'partial' | 'stroke';

interface ToolbarProps {
    // State
    activeTool: ActiveTool;
    onToolChange: (tool: ActiveTool) => void;

    // Draw Props
    brushSize: number;
    onBrushSizeChange: (size: number) => void;
    strokeColor: string;
    onColorChange: (color: string) => void;
    fillColor: string;
    onFillColorChange: (color: string) => void;

    // Text Props
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

    // Eraser Props
    eraserMode: EraserMode;
    onEraserModeChange: (mode: EraserMode) => void;
    eraserSize: number;
    onEraserSizeChange: (size: number) => void;
}

/* --- COMPONENTS --- */

// 1. Tool Button Component (Clean & Reusable)
const ToolButton = ({
    isActive,
    onClick,
    icon: Icon,
    label,
    hasDropdown = false
}: {
    isActive: boolean;
    onClick: () => void;
    icon: any;
    label: string;
    hasDropdown?: boolean;
}) => (
    <button
        onClick={onClick}
        title={label}
        className={`
      relative group flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200
      ${isActive
                ? 'bg-[#2dd4bf]/10 text-[#2dd4bf] ring-1 ring-[#2dd4bf]/50 shadow-[0_0_10px_rgba(45,212,191,0.2)]'
                : 'text-[#aab6bf] hover:bg-[#262e35] hover:text-white'
            }
    `}
    >
        <Icon size={18} />
        {hasDropdown && (
            <div className="absolute bottom-1 right-1">
                <div className="w-1 h-1 rounded-full bg-current opacity-70" />
            </div>
        )}
    </button>
);

// 2. Color Picker (Custom UI wrapping native input)
const ColorPicker = ({ color, onChange, label }: { color: string; onChange: (c: string) => void; label: string }) => (
    <div className="flex flex-col gap-1">
        <label className="text-[10px] font-mono uppercase text-[#607383] tracking-wider">{label}</label>
        <div className="relative w-8 h-8 rounded-full border border-[#3c4853] overflow-hidden cursor-pointer hover:border-[#2dd4bf] transition-colors group">
            <div
                className="absolute inset-0"
                style={{ backgroundColor: color }}
            />
            {/* Invisible native input covers the div */}
            <input
                type="color"
                value={color}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
        </div>
    </div>
);

// 3. Separator
const Separator = () => <div className="w-px h-8 bg-[#262e35] mx-2" />;

export default function Toolbar({
    activeTool,
    onToolChange,
    brushSize,
    onBrushSizeChange,
    strokeColor,
    onColorChange,
    fillColor,
    onFillColorChange,
    fontFamily,
    onFontFamilyChange,
    fontSize,
    onFontSizeChange,
    isBold,
    onBoldChange,
    isItalic,
    onItalicChange,
    isUnderline,
    onUnderlineChange,
    eraserMode,
    onEraserModeChange,
    eraserSize,
    onEraserSizeChange,
}: ToolbarProps) {
    const [showEraserMenu, setShowEraserMenu] = useState(false);
    const eraserMenuRef = useRef<HTMLDivElement>(null);

    // Close eraser menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (eraserMenuRef.current && !eraserMenuRef.current.contains(event.target as Node)) {
                setShowEraserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Derived States
    const isDrawMode = [ToolType.PEN, ToolType.RECTANGLE, ToolType.CIRCLE].includes(activeTool as ToolType);
    const isTextMode = activeTool === 'text';
    const isEraserMode = activeTool === 'eraser';

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#1a2026]/90 backdrop-blur-xl border border-[#262e35] rounded-xl shadow-2xl shadow-black/50 text-[#eceef0]">

                {/* --- SELECTION & TOOLS --- */}
                <div className="flex items-center gap-1">
                    <ToolButton
                        icon={MousePointer2}
                        label="Select (V)"
                        isActive={activeTool === 'select'}
                        onClick={() => onToolChange('select')}
                    />
                    <ToolButton
                        icon={Pencil}
                        label="Pen (P)"
                        isActive={activeTool === ToolType.PEN}
                        onClick={() => onToolChange(ToolType.PEN)}
                    />

                    {/* Eraser Group (Relative for Dropdown) */}
                    <div className="relative" ref={eraserMenuRef}>
                        <ToolButton
                            icon={Eraser}
                            label="Eraser (E)"
                            isActive={isEraserMode}
                            hasDropdown
                            onClick={() => {
                                onToolChange('eraser');
                                setShowEraserMenu(!showEraserMenu);
                            }}
                        />

                        {/* Floating Eraser Menu */}
                        {showEraserMenu && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 p-3 bg-[#1a2026] border border-[#262e35] rounded-lg shadow-xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex gap-2 p-1 bg-[#0f1316] rounded-md">
                                    <button
                                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded ${eraserMode === 'partial' ? 'bg-[#262e35] text-white shadow-sm' : 'text-[#7e909e] hover:text-white'}`}
                                        onClick={() => onEraserModeChange('partial')}
                                    >
                                        <Minus size={14} /> Partial
                                    </button>
                                    <button
                                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded ${eraserMode === 'stroke' ? 'bg-[#262e35] text-white shadow-sm' : 'text-[#7e909e] hover:text-white'}`}
                                        onClick={() => onEraserModeChange('stroke')}
                                    >
                                        <Trash2 size={14} /> Stroke
                                    </button>
                                </div>

                                {eraserMode === 'partial' && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] uppercase text-[#607383] font-bold">
                                            <span>Size</span>
                                            <span>{eraserSize}px</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={5}
                                            max={50}
                                            value={eraserSize}
                                            onChange={(e) => onEraserSizeChange(Number(e.target.value))}
                                            className="w-full h-1 bg-[#262e35] rounded-lg appearance-none cursor-pointer accent-[#2dd4bf]"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <Separator />

                {/* --- SHAPES --- */}
                <div className="flex items-center gap-1">
                    <ToolButton
                        icon={Square}
                        label="Rectangle (R)"
                        isActive={activeTool === ToolType.RECTANGLE}
                        onClick={() => onToolChange(ToolType.RECTANGLE)}
                    />
                    <ToolButton
                        icon={Circle}
                        label="Circle (C)"
                        isActive={activeTool === ToolType.CIRCLE}
                        onClick={() => onToolChange(ToolType.CIRCLE)}
                    />
                    <ToolButton
                        icon={Type}
                        label="Text (T)"
                        isActive={activeTool === 'text'}
                        onClick={() => onToolChange('text')}
                    />
                </div>

                <Separator />

                {/* --- CONTEXTUAL CONTROLS --- */}

                {/* 1. Colors (For Shapes/Pen/Text) */}
                {!isEraserMode && (
                    <div className="flex items-center gap-3 mx-2">
                        <ColorPicker label={isTextMode ? "Text" : "Stroke"} color={strokeColor} onChange={onColorChange} />
                        {/* Only show Fill for Shapes */}
                        {(activeTool === ToolType.RECTANGLE || activeTool === ToolType.CIRCLE) && (
                            <ColorPicker label="Fill" color={fillColor} onChange={onFillColorChange} />
                        )}
                    </div>
                )}

                {/* 2. Brush Size (Draw Mode) */}
                {isDrawMode && (
                    <div className="flex flex-col gap-1 w-24 mx-2">
                        <div className="flex justify-between text-[10px] font-mono text-[#607383]">
                            <span>WIDTH</span>
                            <span>{brushSize}PX</span>
                        </div>
                        <input
                            type="range"
                            min={1}
                            max={20}
                            value={brushSize}
                            onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                            className="w-full h-1 bg-[#262e35] rounded-lg appearance-none cursor-pointer accent-[#2dd4bf]"
                        />
                    </div>
                )}

                {/* 3. Text Formatting (Text/Select Mode) */}
                {(isTextMode || activeTool === 'select') && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                        {/* Font Family */}
                        <div className="relative group">
                            <select
                                value={fontFamily}
                                onChange={(e) => onFontFamilyChange(e.target.value)}
                                className="appearance-none bg-[#0f1316] text-xs text-white border border-[#262e35] rounded h-8 pl-3 pr-8 focus:border-[#2dd4bf] focus:outline-none cursor-pointer hover:bg-[#262e35] transition-colors"
                            >
                                <option value="Inter">Inter</option>
                                <option value="Arial">Arial</option>
                                <option value="Times New Roman">Times</option>
                                <option value="Courier New">Mono</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#607383] pointer-events-none" />
                        </div>

                        {/* Font Size */}
                        <div className="flex items-center gap-1 bg-[#0f1316] border border-[#262e35] rounded h-8 px-1">
                            <input
                                type="number"
                                value={fontSize}
                                onChange={(e) => onFontSizeChange(Number(e.target.value))}
                                className="w-8 bg-transparent text-xs text-center text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-[10px] text-[#607383] pr-1">px</span>
                        </div>

                        {/* Style Toggles */}
                        <div className="flex items-center gap-0.5 bg-[#0f1316] border border-[#262e35] rounded p-0.5">
                            <button
                                onClick={() => onBoldChange(!isBold)}
                                className={`p-1.5 rounded ${isBold ? 'bg-[#262e35] text-white' : 'text-[#7e909e] hover:text-white'}`}
                            >
                                <Bold size={14} />
                            </button>
                            <button
                                onClick={() => onItalicChange(!isItalic)}
                                className={`p-1.5 rounded ${isItalic ? 'bg-[#262e35] text-white' : 'text-[#7e909e] hover:text-white'}`}
                            >
                                <Italic size={14} />
                            </button>
                            <button
                                onClick={() => onUnderlineChange(!isUnderline)}
                                className={`p-1.5 rounded ${isUnderline ? 'bg-[#262e35] text-white' : 'text-[#7e909e] hover:text-white'}`}
                            >
                                <Underline size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}