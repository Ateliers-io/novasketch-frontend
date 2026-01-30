import './Toolbar.css';

interface ToolbarProps {
    tool: 'draw' | 'text';
    onToolChange: (tool: 'draw' | 'text') => void;
    brushSize: number;
    onBrushSizeChange: (size: number) => void;
    strokeColor: string;
    onColorChange: (color: string) => void;
}

// Floating toolbar for drawing controls
export default function Toolbar({
    tool,
    onToolChange,
    brushSize,
    onBrushSizeChange,
    strokeColor,
    onColorChange,
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
                    ✏️
                </button>
                <button
                    className={`tool-button ${tool === 'text' ? 'active' : ''}`}
                    onClick={() => onToolChange('text')}
                    title="Text Mode"
                >
                    T
                </button>
            </div>

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

            {/* Brush size control */}
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
        </div>
    );
}

