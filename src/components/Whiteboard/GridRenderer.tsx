import React, { useMemo, useEffect } from 'react';
import { Layer, Rect } from 'react-konva';
import { GridConfig } from '../../types/grid';

interface GridRendererProps {
    config: GridConfig;
    width: number;
    height: number;
    stageScale: number;
    stagePos: { x: number; y: number };
}

export default function GridRenderer({
    config,
    width,
    height,
    stageScale,
    stagePos,
}: GridRendererProps) {
    const patternCanvas = useMemo(() => {
        // Only return null if explicitly disabled/hidden, otherwise we might fail to render
        if (!config.snapEnabled && config.appearance === 'none' as any) {
            return null;
        }

        const size = config.size || 20;
        const color = config.color || '#ddd';
        const thickness = config.thickness || 1;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Clear (transparent)
        ctx.clearRect(0, 0, size, size);

        ctx.fillStyle = color;

        switch (config.appearance) {
            case 'dots':
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, thickness, 0, 2 * Math.PI);
                ctx.fill();
                break;
            case 'lines':
                // Draw top edge
                ctx.fillRect(0, 0, size, thickness);
                // Draw left edge
                ctx.fillRect(0, 0, thickness, size);
                break;
            case 'horizontal_lines':
                ctx.fillRect(0, 0, size, thickness);
                break;
            case 'vertical_lines':
                ctx.fillRect(0, 0, thickness, size);
                break;
            case 'crosses':
                const arm = Math.min(size / 4, 10);
                const cx = size / 2;
                const cy = size / 2;
                const halfThick = thickness / 2;
                // Horizontal arm
                ctx.fillRect(cx - arm, cy - halfThick, arm * 2, thickness);
                // Vertical arm
                ctx.fillRect(cx - halfThick, cy - arm, thickness, arm * 2);
                break;
        }

        return canvas;
    }, [config.appearance, config.size, config.color, config.thickness]);

    if (!patternCanvas) return null;

    // Calculate the Visible Bounds in World Coordinates (Inverse Transform)
    // This ensures the Grid Rect always covers the screen regardless of Pan/Zoom.
    const invScale = 1 / stageScale;
    const worldX = -stagePos.x * invScale;
    const worldY = -stagePos.y * invScale;
    const worldWidth = width * invScale;
    const worldHeight = height * invScale;

    return (
        <Rect
            key={`${config.appearance}-${config.size}-${config.color}`}
            x={worldX}
            y={worldY}
            width={worldWidth}
            height={worldHeight}
            fillPatternImage={patternCanvas as any}
            fillPatternOffset={{
                x: worldX,
                y: worldY
            }}
            fillPatternScale={{
                x: 1,
                y: 1
            }}
            fillPatternRepeat="repeat"
            listening={false} // Optimization: Don't capture events
        />
    );
}
