import React from 'react';
import './Toolbar.css';
import { ToolType } from '../../types/shapes';

// Update your ToolType enum in your types file to include 'text' and 'select' if not present,
// or we treat activeTool as a union type here for safety.
export type ActiveTool = ToolType | 'text' | 'select';

interface ToolbarProps {
    // State
    activeTool: ActiveTool;
    onToolChange: (tool: ActiveTool) => void;

    // Draw & Shape Props
    brushSize: number;
    onBrushSizeChange: (size: number) => void;
    strokeColor: string;
    onColorChange: (color: string) => void;
    fillColor: string;
    onFillColorChange: (color: string) => void;

    // Text Formatting Props
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
}

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
}: ToolbarProps) {

    // Helper to determine if we are in a drawing/shape mode
    const isDrawMode = activeTool === ToolType.PEN || activeTool === ToolType.RECTANGLE || activeTool === ToolType.CIRCLE;
    const isTextMode = activeTool === 'text';

    return (
        <div className="toolbar">
            {/* --- Tool Selection --- */}
            <div className="toolbar-group">
                <label>Tools</label>
                <div className="tool-buttons">
                    <button
                        className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
                        onClick={() => onToolChange('select')}
                        title="Select"
                    >
                        ↗
                    </button>
                    <button
                        className={`tool-btn ${activeTool === ToolType.PEN ? 'active' : ''}`}
                        onClick={() => onToolChange(ToolType.PEN)}
                        title="Pen"
                    >
                        ✏️
                    </button>
                    <button
                        className={`tool-btn ${activeTool === ToolType.RECTANGLE ? 'active' : ''}`}
                        onClick={() => onToolChange(ToolType.RECTANGLE)}
                        title="Rectangle"
                    >
                        ▢
                    </button>
                    <button
                        className={`tool-btn ${activeTool === ToolType.CIRCLE ? 'active' : ''}`}
                        onClick={() => onToolChange(ToolType.CIRCLE)}
                        title="Circle"
                    >
                        ○
                    </button>
                    <button
                        className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`}
                        onClick={() => onToolChange('text')}
                        title="Text"
                    >
                        <span style={{ fontWeight: 'bold' }}>T</span>
                    </button>
                </div>
            </div>

            {/* --- General Styling (Color) --- */}
            <div className="toolbar-group">
                <label>Stroke</label>
                <div className="color-input-wrapper">
                    <input
                        type="color"
                        value={strokeColor}
                        onChange={(e) => onColorChange(e.target.value)}
                        className="color-input"
                        title="Stroke Color"
                    />
                    <div
                        className="color-circle"
                        style={{ backgroundColor: strokeColor }}
                    />
                </div>
            </div>

            {/* Show Fill only for Shapes (not Text or Pen usually, but keeping logic flexible) */}
            {!isTextMode && (
                <div className="toolbar-group">
                    <label>Fill</label>
                    <div className="color-input-wrapper">
                        <input
                            type="color"
                            value={fillColor}
                            onChange={(e) => onFillColorChange(e.target.value)}
                            className="color-input"
                            title="Fill Color"
                        />
                        <div
                            className="color-circle"
                            style={{ backgroundColor: fillColor }}
                        />
                    </div>
                </div>
            )}

            {/* --- Drawing Specific Controls --- */}
            {isDrawMode && (
                <div className="toolbar-group">
                    <label htmlFor="brush-size">Size</label>
                    <input
                        id="brush-size"
                        type="range"
                        min={1}
                        max={20}
                        value={brushSize}
                        onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                    />
                    <span className="brush-size-value">{brushSize}px</span>
                </div>
            )}

            {/* --- Text Specific Controls --- */}
            {(isTextMode || activeTool === 'select') && (
                <>
                    <div className="toolbar-separator" />
                    
                    <div className="toolbar-group">
                        <select
                            value={fontFamily}
                            onChange={(e) => onFontFamilyChange(e.target.value)}
                            className="font-select"
                            title="Font Family"
                        >
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times</option>
                            <option value="Courier New">Courier</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Verdana">Verdana</option>
                        </select>
                    </div>

                    <div className="toolbar-group">
                        <input
                            type="number"
                            value={fontSize}
                            onChange={(e) => onFontSizeChange(Number(e.target.value))}
                            className="font-size-input"
                            min="8"
                            max="72"
                            title="Font Size"
                        />
                        <span className="brush-size-value">px</span>
                    </div>

                    <div className="toolbar-group tool-buttons">
                        <button
                            className={`tool-btn ${isBold ? 'active' : ''}`}
                            onClick={() => onBoldChange(!isBold)}
                            title="Bold"
                        >
                            <strong style={{ fontFamily: 'serif' }}>B</strong>
                        </button>
                        <button
                            className={`tool-btn ${isItalic ? 'active' : ''}`}
                            onClick={() => onItalicChange(!isItalic)}
                            title="Italic"
                        >
                            <em style={{ fontFamily: 'serif' }}>I</em>
                        </button>
                        <button
                            className={`tool-btn ${isUnderline ? 'active' : ''}`}
                            onClick={() => onUnderlineChange(!isUnderline)}
                            title="Underline"
                        >
                            <span style={{ textDecoration: 'underline', fontFamily: 'serif' }}>U</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}