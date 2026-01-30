import './Toolbar.css';

interface ToolbarProps {
    tool: 'draw' | 'text' | 'select';
    onToolChange: (tool: 'draw' | 'text' | 'select') => void;
    brushSize: number;
    onBrushSizeChange: (size: number) => void;
    strokeColor: string;
    onColorChange: (color: string) => void;
    // Text formatting props
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

// Floating toolbar for drawing controls
export default function Toolbar({
    tool,
    onToolChange,
    brushSize,
    onBrushSizeChange,
    strokeColor,
    onColorChange,
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
    return (
        <div className="toolbar">
            {/* Tool selection */}
            <div className="toolbar-group">
                <button
                    className={`tool-button ${tool === 'draw' ? 'active' : ''}`}
                    onClick={() => onToolChange('draw')}
                    title="Draw Mode"
                >
                    <span style={{ fontSize: '20px' }}>✎</span>
                </button>
                <button
                    className={`tool-button ${tool === 'text' ? 'active' : ''}`}
                    onClick={() => onToolChange('text')}
                    title="Text Mode"
                >
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>T</span>
                </button>
                <button
                    className={`tool-button ${tool === 'select' ? 'active' : ''}`}
                    onClick={() => onToolChange('select')}
                    title="Select Mode"
                >
                    <span style={{ fontSize: '20px' }}>↗</span>
                </button>
            </div>

            {/* Color picker - native input for color wheel */}
            {/* Color picker - native input for color wheel */}
            <div className="toolbar-group">
                <label>Color</label>
                <div className="color-input-wrapper">
                    {/* Updates context state with selected hex code */}
                    <input
                        type="color"
                        value={strokeColor}
                        onChange={(e) => onColorChange(e.target.value)}
                        className="color-input"
                    />
                    {/* Circle overlay showing current color */}
                    <div
                        className="color-circle"
                        style={{ backgroundColor: strokeColor }}
                    />
                </div>
            </div>

            {/* Text Styling Controls (Visible in Text or Select Mode) */}
            {(tool === 'text' || tool === 'select') && (
                <>
                    <div className="toolbar-group">
                        <select
                            value={fontFamily}
                            onChange={(e) => onFontFamilyChange(e.target.value)}
                            className="font-select"
                            title="Font Family"
                        >
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Courier New">Courier New</option>
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

                    <div className="toolbar-group">
                        <button
                            className={`tool-button ${isBold ? 'active' : ''}`}
                            onClick={() => onBoldChange(!isBold)}
                            title="Bold"
                        >
                            <span style={{ fontWeight: 'bold' }}>B</span>
                        </button>
                        <button
                            className={`tool-button ${isItalic ? 'active' : ''}`}
                            onClick={() => onItalicChange(!isItalic)}
                            title="Italic"
                        >
                            <span style={{ fontStyle: 'italic' }}>I</span>
                        </button>
                        <button
                            className={`tool-button ${isUnderline ? 'active' : ''}`}
                            onClick={() => onUnderlineChange(!isUnderline)}
                            title="Underline"
                        >
                            <span style={{ textDecoration: 'underline' }}>U</span>
                        </button>
                    </div>
                </>
            )}

            {/* Brush size control */}
            {/* Brush size control (Hidden in Text/Select Mode) */}
            {tool === 'draw' && (
                <div className="toolbar-group">
                    <label htmlFor="brush-size">Brush</label>
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
        </div>
    );
}

