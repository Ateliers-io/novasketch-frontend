/**
 * MiniMap component — Task 5.3: Secondary smaller canvas overlay.
 * Shows a bird's-eye view of the entire canvas with a viewport indicator.
 */
import React, { useMemo } from 'react';
import {
    Shape, isRectangle, isCircle, isEllipse, isLine, isArrow, isTriangle,
    RectangleShape, CircleShape, EllipseShape, LineShape, ArrowShape, TriangleShape
} from '../../../types/shapes';
import { getTransformedBoundingBox } from '../../../utils/boundingBox';
import { StrokeLine } from '../../../services/sync.service';
import { TextAnnotation } from '../types';

// --- Constants ---
const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 140;
const MINIMAP_PADDING = 40; // World-space padding around all objects

interface MiniMapProps {
    shapes: Shape[];
    lines: StrokeLine[];
    textAnnotations: TextAnnotation[];
    stagePos: { x: number; y: number };
    stageScale: number;
    dimensions: { width: number; height: number };
    onNavigate: (worldX: number, worldY: number) => void;
}

/**
 * Compute the bounding box that contains ALL objects on the canvas.
 * Returns { minX, minY, maxX, maxY } in world coordinates.
 * If no objects exist, returns a default area around origin.
 */
function computeWorldBounds(
    shapes: Shape[],
    lines: StrokeLine[],
    textAnnotations: TextAnnotation[]
) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasContent = false;

    // Shapes
    shapes.forEach(s => {
        const bbox = getTransformedBoundingBox(s);
        minX = Math.min(minX, bbox.minX);
        minY = Math.min(minY, bbox.minY);
        maxX = Math.max(maxX, bbox.maxX);
        maxY = Math.max(maxY, bbox.maxY);
        hasContent = true;
    });

    // Lines
    lines.forEach(l => {
        for (let i = 0; i < l.points.length; i += 2) {
            minX = Math.min(minX, l.points[i]);
            minY = Math.min(minY, l.points[i + 1]);
            maxX = Math.max(maxX, l.points[i]);
            maxY = Math.max(maxY, l.points[i + 1]);
        }
        if (l.points.length >= 2) hasContent = true;
    });

    // Text
    textAnnotations.forEach(t => {
        const w = t.text.length * (t.fontSize || 18) * 0.6;
        const h = (t.fontSize || 18) * 1.2;
        minX = Math.min(minX, t.x);
        minY = Math.min(minY, t.y);
        maxX = Math.max(maxX, t.x + w);
        maxY = Math.max(maxY, t.y + h);
        hasContent = true;
    });

    if (!hasContent) {
        // Default: show a region around the origin
        return { minX: -500, minY: -350, maxX: 500, maxY: 350 };
    }

    return { minX, minY, maxX, maxY };
}

const MiniMap: React.FC<MiniMapProps> = ({
    shapes,
    lines,
    textAnnotations,
    stagePos,
    stageScale,
    dimensions,
    onNavigate,
}) => {
    // 1. Compute world bounds of all objects (with padding)
    const worldBounds = useMemo(() => {
        const bounds = computeWorldBounds(shapes, lines, textAnnotations);

        // Also include the current viewport so the view box is always visible
        const vpMinX = -stagePos.x / stageScale;
        const vpMinY = -stagePos.y / stageScale;
        const vpMaxX = vpMinX + dimensions.width / stageScale;
        const vpMaxY = vpMinY + dimensions.height / stageScale;

        bounds.minX = Math.min(bounds.minX, vpMinX);
        bounds.minY = Math.min(bounds.minY, vpMinY);
        bounds.maxX = Math.max(bounds.maxX, vpMaxX);
        bounds.maxY = Math.max(bounds.maxY, vpMaxY);

        // Add padding
        bounds.minX -= MINIMAP_PADDING;
        bounds.minY -= MINIMAP_PADDING;
        bounds.maxX += MINIMAP_PADDING;
        bounds.maxY += MINIMAP_PADDING;

        return bounds;
    }, [shapes, lines, textAnnotations, stagePos, stageScale, dimensions]);

    // 2. Calculate the scale factor to fit world bounds into the minimap
    const worldWidth = worldBounds.maxX - worldBounds.minX;
    const worldHeight = worldBounds.maxY - worldBounds.minY;
    const scaleX = MINIMAP_WIDTH / worldWidth;
    const scaleY = MINIMAP_HEIGHT / worldHeight;
    const miniScale = Math.min(scaleX, scaleY);

    // Centering offset (if aspect ratios don't match)
    const renderedWidth = worldWidth * miniScale;
    const renderedHeight = worldHeight * miniScale;
    const offsetX = (MINIMAP_WIDTH - renderedWidth) / 2;
    const offsetY = (MINIMAP_HEIGHT - renderedHeight) / 2;

    // 3. Helper: convert world coords to minimap pixel coords
    const toMiniX = (wx: number) => offsetX + (wx - worldBounds.minX) * miniScale;
    const toMiniY = (wy: number) => offsetY + (wy - worldBounds.minY) * miniScale;

    // 4. Compute the viewport rectangle in minimap coordinates
    const vpWorldX = -stagePos.x / stageScale;
    const vpWorldY = -stagePos.y / stageScale;
    const vpWorldW = dimensions.width / stageScale;
    const vpWorldH = dimensions.height / stageScale;

    const vpMiniX = toMiniX(vpWorldX);
    const vpMiniY = toMiniY(vpWorldY);
    const vpMiniW = vpWorldW * miniScale;
    const vpMiniH = vpWorldH * miniScale;

    // 5. Click handler — navigate to clicked position
    const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Convert minimap coords back to world coords
        const worldX = (clickX - offsetX) / miniScale + worldBounds.minX;
        const worldY = (clickY - offsetY) / miniScale + worldBounds.minY;

        onNavigate(worldX, worldY);
    };

    return (
        <div
            className="fixed bottom-4 right-4 z-50 rounded-lg overflow-hidden border border-white/15 shadow-xl"
            style={{
                width: MINIMAP_WIDTH,
                height: MINIMAP_HEIGHT,
                background: 'rgba(11, 12, 16, 0.85)',
                backdropFilter: 'blur(8px)',
            }}
        >
            {/* Mini-map label */}
            <div className="absolute top-1 left-2 text-[9px] text-white/30 font-medium uppercase tracking-wider select-none pointer-events-none z-10">
                Map
            </div>

            <svg
                width={MINIMAP_WIDTH}
                height={MINIMAP_HEIGHT}
                style={{ cursor: 'pointer' }}
                onClick={handleClick}
            >
                {/* Background */}
                <rect width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} fill="transparent" />

                {/* Simplified object representations will go here (Task 2) */}

                {/* Viewport indicator (View Box) */}
                <rect
                    x={vpMiniX}
                    y={vpMiniY}
                    width={Math.max(vpMiniW, 2)}
                    height={Math.max(vpMiniH, 2)}
                    fill="rgba(102, 252, 241, 0.08)"
                    stroke="#66FCF1"
                    strokeWidth={1.5}
                    rx={1}
                    style={{ pointerEvents: 'none' }}
                />
            </svg>
        </div>
    );
};

export default MiniMap;
