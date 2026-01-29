import './Toolbar.css';

interface ToolbarProps {
    brushSize: number;
    onBrushSizeChange: (size: number) => void;
}

// Floating toolbar for drawing controls
export default function Toolbar({ brushSize, onBrushSizeChange }: ToolbarProps) {
    return (
        <div className="toolbar">
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

