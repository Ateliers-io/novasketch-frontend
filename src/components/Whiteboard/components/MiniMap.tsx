/**
 * MiniMap component — Task 5.3: Secondary smaller canvas overlay.
 * Shows a bird's-eye view of the entire canvas with a viewport indicator.
 */
import React, { useMemo, useRef, useCallback } from 'react';
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
    // Task 3.1.3: Remote user cursors to render on the minimap
    users?: { name: string; color: string; cursor?: { x: number; y: number } }[];
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
    users = [],
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

    // 5. Drag state for the View Box (using refs to avoid re-render lag)
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 }); // offset from click to viewport rect top-left
    const didDragRef = useRef(false); // prevents click-to-navigate after drag

    // Convert minimap pixel position to world coordinates
    const miniToWorldX = useCallback((mx: number) => (mx - offsetX) / miniScale + worldBounds.minX, [offsetX, miniScale, worldBounds.minX]);
    const miniToWorldY = useCallback((my: number) => (my - offsetY) / miniScale + worldBounds.minY, [offsetY, miniScale, worldBounds.minY]);

    // Start dragging the View Box
    const handleViewBoxMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        isDraggingRef.current = true;
        didDragRef.current = false;

        // Store offset between mouse position and the viewport rect's top-left
        const svgRect = (e.currentTarget as Element).closest('svg')?.getBoundingClientRect();
        if (svgRect) {
            const mouseX = e.clientX - svgRect.left;
            const mouseY = e.clientY - svgRect.top;
            dragOffsetRef.current = {
                x: mouseX - vpMiniX,
                y: mouseY - vpMiniY,
            };
        }
    }, [vpMiniX, vpMiniY]);

    // Handle mouse move on the SVG (drag or hover)
    const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!isDraggingRef.current) return;
        didDragRef.current = true;

        const svgRect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - svgRect.left;
        const mouseY = e.clientY - svgRect.top;

        // New top-left of viewport rect in minimap coords
        const newMiniX = mouseX - dragOffsetRef.current.x;
        const newMiniY = mouseY - dragOffsetRef.current.y;

        // Convert to world coords (top-left corner of viewport)
        const worldX = miniToWorldX(newMiniX);
        const worldY = miniToWorldY(newMiniY);

        // Navigate: onNavigate expects the CENTER of the viewport
        onNavigate(worldX + vpWorldW / 2, worldY + vpWorldH / 2);
    }, [miniToWorldX, miniToWorldY, onNavigate, vpWorldW, vpWorldH]);

    // Handle mouse up — stop dragging
    const handleSvgMouseUp = useCallback(() => {
        isDraggingRef.current = false;
    }, []);

    // Handle mouse leave — stop dragging if cursor leaves minimap
    const handleSvgMouseLeave = useCallback(() => {
        isDraggingRef.current = false;
    }, []);

    // Click handler — navigate to clicked position (only if not dragging)
    const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (didDragRef.current) {
            didDragRef.current = false;
            return; // Don't navigate after a drag
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const worldX = miniToWorldX(clickX);
        const worldY = miniToWorldY(clickY);

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


            <svg
                width={MINIMAP_WIDTH}
                height={MINIMAP_HEIGHT}
                style={{ cursor: isDraggingRef.current ? 'grabbing' : 'pointer' }}
                onClick={handleClick}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
                onMouseLeave={handleSvgMouseLeave}
            >
                {/* Background */}
                <rect width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} fill="transparent" />

                {/* Task 5.3.2: Simplified object representations */}

                {/* Shapes — rendered as small colored rectangles using their bounding boxes */}
                {shapes.map(s => {
                    const bbox = getTransformedBoundingBox(s);
                    const mx = toMiniX(bbox.minX);
                    const my = toMiniY(bbox.minY);
                    const mw = Math.max((bbox.maxX - bbox.minX) * miniScale, 1.5);
                    const mh = Math.max((bbox.maxY - bbox.minY) * miniScale, 1.5);
                    const color = s.style.stroke || '#66FCF1';
                    const fill = s.style.hasFill ? s.style.fill : 'none';

                    // Use actual shape primitives for circles/ellipses
                    if (isCircle(s)) {
                        const cx = toMiniX(s.position.x);
                        const cy = toMiniY(s.position.y);
                        const r = Math.max((s as CircleShape).radius * miniScale, 1);
                        return <circle key={s.id} cx={cx} cy={cy} r={r} fill={fill} stroke={color} strokeWidth={0.8} opacity={0.8} />;
                    }
                    if (isEllipse(s)) {
                        const cx = toMiniX(s.position.x);
                        const cy = toMiniY(s.position.y);
                        const rx = Math.max((s as EllipseShape).radiusX * miniScale, 1);
                        const ry = Math.max((s as EllipseShape).radiusY * miniScale, 1);
                        return <ellipse key={s.id} cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} stroke={color} strokeWidth={0.8} opacity={0.8} />;
                    }
                    if (isTriangle(s)) {
                        const pts = (s as TriangleShape).points.map(p => `${toMiniX(p.x)},${toMiniY(p.y)}`).join(' ');
                        return <polygon key={s.id} points={pts} fill={fill} stroke={color} strokeWidth={0.8} opacity={0.8} />;
                    }
                    if (isLine(s) || isArrow(s)) {
                        const ls = s as LineShape;
                        return <line key={s.id} x1={toMiniX(ls.startPoint.x)} y1={toMiniY(ls.startPoint.y)} x2={toMiniX(ls.endPoint.x)} y2={toMiniY(ls.endPoint.y)} stroke={color} strokeWidth={0.8} opacity={0.8} />;
                    }
                    // Rectangle and fallback
                    return <rect key={s.id} x={mx} y={my} width={mw} height={mh} fill={fill} stroke={color} strokeWidth={0.8} rx={0.5} opacity={0.8} />;
                })}

                {/* Lines (freehand strokes) — simplified polylines, sampling every 4th point */}
                {lines.map(l => {
                    if (l.points.length < 4) return null;
                    // Sample points for performance: take every 4th point
                    const step = Math.max(2, Math.floor(l.points.length / 50) * 2); // max ~50 points per line
                    let pathData = '';
                    for (let i = 0; i < l.points.length; i += step) {
                        const px = toMiniX(l.points[i]);
                        const py = toMiniY(l.points[i + 1]);
                        pathData += (i === 0 ? `M${px},${py}` : ` L${px},${py}`);
                    }
                    // Always include the last point
                    const lastI = l.points.length - 2;
                    if (lastI > 0) {
                        pathData += ` L${toMiniX(l.points[lastI])},${toMiniY(l.points[lastI + 1])}`;
                    }
                    return (
                        <path
                            key={l.id}
                            d={pathData}
                            stroke={l.color || '#66FCF1'}
                            strokeWidth={Math.max(l.strokeWidth * miniScale, 0.5)}
                            fill="none"
                            opacity={0.7}
                            strokeLinecap="round"
                        />
                    );
                })}

                {/* Text — rendered as small colored bars representing text blocks */}
                {textAnnotations.map(t => {
                    const mx = toMiniX(t.x);
                    const my = toMiniY(t.y);
                    const mw = Math.max(t.text.length * (t.fontSize || 18) * 0.6 * miniScale, 3);
                    const mh = Math.max((t.fontSize || 18) * 1.2 * miniScale, 1.5);
                    return (
                        <rect
                            key={t.id}
                            x={mx}
                            y={my}
                            width={mw}
                            height={mh}
                            fill={t.color || '#C5C6C7'}
                            rx={0.5}
                            opacity={0.6}
                        />
                    );
                })}

                {/* Task 5.3.3: Draggable Viewport indicator (View Box) */}
                <rect
                    x={vpMiniX}
                    y={vpMiniY}
                    width={Math.max(vpMiniW, 2)}
                    height={Math.max(vpMiniH, 2)}
                    fill="rgba(102, 252, 241, 0.08)"
                    stroke="#66FCF1"
                    strokeWidth={1.5}
                    rx={1}
                    style={{ pointerEvents: 'auto', cursor: 'grab' }}
                    onMouseDown={handleViewBoxMouseDown}
                />

                {/* Task 3.1.3: Remote user cursors */}
                {users
                    .filter(u => u.cursor)
                    .map(u => {
                        const cx = toMiniX(u.cursor!.x);
                        const cy = toMiniY(u.cursor!.y);
                        return (
                            <g key={`cursor-${u.name}`}>
                                {/* Cursor dot */}
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={3.5}
                                    fill={u.color}
                                    stroke="rgba(0,0,0,0.5)"
                                    strokeWidth={0.8}
                                    style={{ filter: `drop-shadow(0 0 2px ${u.color})` }}
                                />
                                {/* Name label */}
                                <text
                                    x={cx + 5}
                                    y={cy + 1}
                                    fontSize={7}
                                    fontWeight="bold"
                                    fill={u.color}
                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    {u.name}
                                </text>
                            </g>
                        );
                    })}
            </svg>
        </div>
    );
};

export default MiniMap;
