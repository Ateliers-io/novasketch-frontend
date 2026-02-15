/**
 * EraserCursor component - renders the custom eraser circle cursor.
 * Extracted from Whiteboard.tsx (lines 2528-2538).
 */
import React from 'react';

interface EraserCursorProps {
    cursorPos: { x: number; y: number };
    eraserSize: number;
}

const EraserCursor: React.FC<EraserCursorProps> = ({ cursorPos, eraserSize }) => {
    return (
        <div
            className="absolute z-[100] rounded-full border border-white bg-white/20 pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            style={{
                width: eraserSize,
                height: eraserSize,
                left: cursorPos.x - eraserSize / 2,
                top: cursorPos.y - eraserSize / 2,
            }}
        />
    );
};

export default EraserCursor;
