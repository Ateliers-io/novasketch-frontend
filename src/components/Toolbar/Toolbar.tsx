import './Toolbar.css';
import { ToolType } from '../../types/shapes';

interface ToolbarProps {
    activeTool: ToolType;
    onToolChange: (tool: ToolType) => void;
    brushSize: number;
    onBrushSizeChange: (size: number) => void;
    strokeColor: string;
    onColorChange: (color: string) => void;
    fillColor: string;
    onFillColorChange: (color: string) => void;
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
}: ToolbarProps) {
    const tools = [
        { type: ToolType.PEN, label: '✏️', title: 'Pen' },
        { type: ToolType.RECTANGLE, label: '▢', title: 'Rectangle' },
        { type: ToolType.CIRCLE, label: '○', title: 'Circle' },
    ];

    return (
        <div className="toolbar">
            <div className="toolbar-group">
                <label>Tools</label>
                <div className="tool-buttons">
                    {tools.map((tool) => (
                        <button
                            key={tool.type}
                            className={`tool-btn ${activeTool === tool.type ? 'active' : ''}`}
                            onClick={() => onToolChange(tool.type)}
                            title={tool.title}
                        >
                            {tool.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="toolbar-group">
                <label>Stroke</label>
                <div className="color-input-wrapper">
                    <input
                        type="color"
                        value={strokeColor}
                        onChange={(e) => onColorChange(e.target.value)}
                        className="color-input"
                    />
                    <div
                        className="color-circle"
                        style={{ backgroundColor: strokeColor }}
                    />
                </div>
            </div>

            <div className="toolbar-group">
                <label>Fill</label>
                <div className="color-input-wrapper">
                    <input
                        type="color"
                        value={fillColor}
                        onChange={(e) => onFillColorChange(e.target.value)}
                        className="color-input"
                    />
                    <div
                        className="color-circle"
                        style={{ backgroundColor: fillColor }}
                    />
                </div>
            </div>

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
        </div>
    );
}
