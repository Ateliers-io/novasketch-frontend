import React, { useMemo } from 'react';
import {
    Shape,
    RectangleShape,
    CircleShape,
    EllipseShape,
    LineShape,
    ArrowShape,
    TriangleShape,
    FrameShape,
    ImageShape,
    isRectangle,
    isCircle,
    isEllipse,
    isLine,
    isArrow,
    isTriangle,
    isFrame,
    isImage,
    ShapeType,
} from '../../types/shapes';
import { AnchorPoint, AnchorType } from '../../utils/connectorUtils';
import './SVGShapeRenderer.css';

// --- PROPS ---
interface SVGShapeRendererProps {
    shapes: Shape[];
    lines?: any[];
    textAnnotations?: any[];
    width: number;
    height: number;
    selectedShapeIds?: Set<string>;
    onShapeClick?: (shapeId: string, e: React.MouseEvent) => void;
    transform?: { x: number; y: number; scale: number };
    /**
     * Smart Connectors: shapes whose anchor points should be rendered
     * as connection dots (shown while drawing a line/arrow near them).
     */
    anchorOverlays?: { shape: Shape; anchors: AnchorPoint[] }[];
    /**
     * Smart Connectors: the single anchor that is currently being snapped to a line/arrow.
     * This anchor should be rendered with a glowing turquoise ring.
     */
    snapTargetAnchor?: { shapeId: string; anchorType: AnchorType } | null;
    /**
     * ID of the frame currently in edit mode (entered via double-click).
     * The active frame gets a visual highlight ring so users can see they are inside it.
     */
    activeFrameId?: string | null;
}

// --- CONSTANTS ---
const NEON_TURQUOISE = '#3B82F6';

// --- HELPER COMPONENTS ---

/**
 * Shape Wrapper
 * Handles Transforms centrally + selection glow.
 */
interface ShapeWrapperProps {
    shape: Shape;
    children: React.ReactNode;
    centerOffset: { x: number; y: number };
    isSelected?: boolean;
    onClick?: (e: React.MouseEvent) => void;
}

const ShapeWrapper: React.FC<ShapeWrapperProps> = ({ shape, children, centerOffset, isSelected, onClick }) => {
    const { position, transform, opacity } = shape;
    const sx = transform.scaleX || 1;
    const sy = transform.scaleY || 1;

    const centerX = position.x + centerOffset.x * sx;
    const centerY = position.y + centerOffset.y * sy;

    return (
        <g
            transform={`translate(${centerX}, ${centerY}) rotate(${transform.rotation}) scale(${sx}, ${sy})`}
            opacity={opacity}
            className="svg-shape-group"
            data-tech-id={shape.id}
            onClick={onClick}
            style={onClick ? { pointerEvents: 'all', cursor: 'pointer' } : undefined}
            filter={isSelected ? 'url(#selection-highlight)' : undefined}
        >
            <g transform={`translate(${-centerOffset.x}, ${-centerOffset.y})`}>
                {children}
            </g>
        </g>
    );
};

// --- PRIMITIVE SHAPES ---

const SVGRectangle = ({ shape, isSelected, onClick }: { shape: RectangleShape; isSelected?: boolean; onClick?: (e: React.MouseEvent) => void }) => (
    <ShapeWrapper
        shape={shape}
        centerOffset={{ x: shape.width / 2, y: shape.height / 2 }}
        isSelected={isSelected}
        onClick={onClick}
    >
        <rect
            width={shape.width}
            height={shape.height}
            rx={shape.cornerRadius || 0}
            fill={shape.style.hasFill ? shape.style.fill : 'none'}
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
            strokeDasharray={shape.style.strokeDashArray?.join(' ')}
            className="svg-primitive"
        />
    </ShapeWrapper>
);

const SVGCircle = ({ shape, isSelected, onClick }: { shape: CircleShape; isSelected?: boolean; onClick?: (e: React.MouseEvent) => void }) => (
    <ShapeWrapper
        shape={shape}
        centerOffset={{ x: 0, y: 0 }}
        isSelected={isSelected}
        onClick={onClick}
    >
        <circle
            cx={0} cy={0}
            r={shape.radius}
            fill={shape.style.hasFill ? shape.style.fill : 'none'}
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
            strokeDasharray={shape.style.strokeDashArray?.join(' ')}
            className="svg-primitive"
        />
    </ShapeWrapper>
);

const SVGEllipse = ({ shape, isSelected, onClick }: { shape: EllipseShape; isSelected?: boolean; onClick?: (e: React.MouseEvent) => void }) => (
    <ShapeWrapper
        shape={shape}
        centerOffset={{ x: 0, y: 0 }}
        isSelected={isSelected}
        onClick={onClick}
    >
        <ellipse
            cx={0} cy={0}
            rx={shape.radiusX}
            ry={shape.radiusY}
            fill={shape.style.hasFill ? shape.style.fill : 'none'}
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
            strokeDasharray={shape.style.strokeDashArray?.join(' ')}
            className="svg-primitive"
        />
    </ShapeWrapper>
);

export const generateLinePathData = (shape: LineShape | ArrowShape, midX: number, midY: number) => {
    const dx = shape.endPoint.x - shape.startPoint.x;
    const dy = shape.endPoint.y - shape.startPoint.y;

    const startX = -dx / 2;
    const startY = -dy / 2;
    const endX = dx / 2;
    const endY = dy / 2;

    const lineType = shape.lineType || 'curved'; // Default to curved for flexible bending

    if (lineType === 'straight') {
        return `M ${startX} ${startY} L ${endX} ${endY}`;
    }

    // Default to a straight line if there's no control point explicitly defined
    if (!shape.controlPoint) {
        return `M ${startX} ${startY} L ${endX} ${endY}`;
    }

    const bx = shape.controlPoint.x - midX;
    const by = shape.controlPoint.y - midY;

    if (lineType === 'stepped') {
        // Orthogonal routing directly through the middle handle in both X and Y.
        return `M ${startX} ${startY} L ${bx} ${startY} L ${bx} ${by} L ${endX} ${by} L ${endX} ${endY}`;
    }

    // curved (Quadratic Bezier but computed so the curve natively passes exactly through the bezier parameter t=0.5 handle)
    const cpX = 2 * bx - 0.5 * startX - 0.5 * endX;
    const cpY = 2 * by - 0.5 * startY - 0.5 * endY;

    return `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;
};

const SVGLine = ({ shape, isSelected, onClick }: { shape: LineShape; isSelected?: boolean; onClick?: (e: React.MouseEvent) => void }) => {
    const dx = shape.endPoint.x - shape.startPoint.x;
    const dy = shape.endPoint.y - shape.startPoint.y;
    const midX = shape.startPoint.x + dx / 2;
    const midY = shape.startPoint.y + dy / 2;

    const pathData = generateLinePathData(shape, midX, midY);

    const markerStartId = shape.arrowAtStart ? `arrowhead-start-${shape.id}` : '';
    const markerEndId = shape.arrowAtEnd ? `arrowhead-end-${shape.id}` : '';

    return (
        <g
            transform={`translate(${midX}, ${midY}) rotate(${shape.transform.rotation})`}
            opacity={shape.opacity}
            className="svg-shape-group"
            onClick={onClick}
            style={onClick ? { pointerEvents: 'all', cursor: 'pointer' } : undefined}
            filter={isSelected ? 'url(#selection-highlight)' : undefined}
        >
            <defs>
                {shape.arrowAtStart && (
                    <marker id={markerStartId} markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
                        <polygon points="0 0, 10 3.5, 0 7" fill={shape.style.stroke} />
                    </marker>
                )}
                {shape.arrowAtEnd && (
                    <marker id={markerEndId} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill={shape.style.stroke} />
                    </marker>
                )}
            </defs>
            <path
                d={pathData}
                fill="none"
                stroke={shape.style.stroke}
                strokeWidth={shape.style.strokeWidth}
                strokeLinecap="round"
                strokeDasharray={shape.style.strokeDashArray?.join(' ')}
                markerStart={shape.arrowAtStart ? `url(#${markerStartId})` : undefined}
                markerEnd={shape.arrowAtEnd ? `url(#${markerEndId})` : undefined}
                className="svg-primitive"
            />
            {/* Invisible wider hit area for easier selection */}
            <path
                d={pathData}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(shape.style.strokeWidth + 10, 14)}
                strokeLinecap="round"
            />
        </g>
    );
};

const SVGArrow = ({ shape, isSelected, onClick }: { shape: ArrowShape; isSelected?: boolean; onClick?: (e: React.MouseEvent) => void }) => {
    const dx = shape.endPoint.x - shape.startPoint.x;
    const dy = shape.endPoint.y - shape.startPoint.y;
    const midX = shape.startPoint.x + dx / 2;
    const midY = shape.startPoint.y + dy / 2;

    const markerStartId = shape.arrowAtStart ? `arrowhead-start-${shape.id}` : '';
    const markerEndId = shape.arrowAtEnd ? `arrowhead-end-${shape.id}` : '';

    const pathData = generateLinePathData(shape, midX, midY);

    return (
        <g
            transform={`translate(${midX}, ${midY}) rotate(${shape.transform.rotation})`}
            opacity={shape.opacity}
            className="svg-shape-group"
            onClick={onClick}
            style={onClick ? { pointerEvents: 'all', cursor: 'pointer' } : undefined}
            filter={isSelected ? 'url(#selection-highlight)' : undefined}
        >
            <defs>
                {shape.arrowAtStart && (
                    <marker id={markerStartId} markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
                        <polygon points="0 0, 10 3.5, 0 7" fill={shape.style.stroke} />
                    </marker>
                )}
                {shape.arrowAtEnd && (
                    <marker id={markerEndId} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill={shape.style.stroke} />
                    </marker>
                )}
            </defs>
            <path
                d={pathData}
                fill="none"
                stroke={shape.style.stroke}
                strokeWidth={shape.style.strokeWidth}
                strokeLinecap="round"
                strokeDasharray={shape.style.strokeDashArray?.join(' ')}
                markerStart={shape.arrowAtStart ? `url(#${markerStartId})` : undefined}
                markerEnd={shape.arrowAtEnd ? `url(#${markerEndId})` : undefined}
                className="svg-primitive"
            />
            {/* Invisible wider hit area */}
            <path
                d={pathData}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(shape.style.strokeWidth + 10, 14)}
                strokeLinecap="round"
            />
        </g>
    );
};

const SVGTriangle = ({ shape, isSelected, onClick }: { shape: TriangleShape; isSelected?: boolean; onClick?: (e: React.MouseEvent) => void }) => {
    const xCoords = shape.points.map(p => p.x);
    const yCoords = shape.points.map(p => p.y);
    const cx = (Math.min(...xCoords) + Math.max(...xCoords)) / 2;
    const cy = (Math.min(...yCoords) + Math.max(...yCoords)) / 2;

    const relPoints = shape.points.map(p => `${p.x - cx},${p.y - cy}`).join(' ');

    return (
        <g
            transform={`translate(${cx}, ${cy}) rotate(${shape.transform.rotation}) scale(${shape.transform.scaleX}, ${shape.transform.scaleY})`}
            opacity={shape.opacity}
            className="svg-shape-group"
            onClick={onClick}
            style={onClick ? { pointerEvents: 'all', cursor: 'pointer' } : undefined}
            filter={isSelected ? 'url(#selection-highlight)' : undefined}
        >
            <polygon
                points={relPoints}
                fill={shape.style.hasFill ? shape.style.fill : 'none'}
                stroke={shape.style.stroke}
                strokeWidth={shape.style.strokeWidth}
                strokeDasharray={shape.style.strokeDashArray?.join(' ')}
                className="svg-primitive"
            />
        </g>
    );
};

const SVGFrame = ({
    shape,
    isSelected,
    isActiveEditFrame,
    onClick,
    children
}: {
    shape: FrameShape;
    isSelected?: boolean;
    isActiveEditFrame?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    children?: React.ReactNode;
}) => (
    <ShapeWrapper
        shape={shape}
        centerOffset={{ x: shape.width / 2, y: shape.height / 2 }}
        isSelected={isSelected}
        onClick={onClick}
    >
        {shape.backgroundVisible && (
            <rect
                width={shape.width}
                height={shape.height}
                fill={shape.style.fill}
                stroke={shape.style.stroke}
                strokeWidth={shape.style.strokeWidth}
                strokeDasharray="5,5"
                className="svg-primitive svg-frame-bg"
            />
        )}
        <g transform="translate(5, -12)">
            {/* Small background for label to prevent overlap bleed */}
            <rect
                x={-2} y={-10}
                width={(shape.name || 'FRAME').length * 6 + 4}
                height={12}
                className="svg-label-bg"
                fill="#0B0C10"
                opacity={0.8}
                rx={2}
            />
            <text
                fill={shape.style.stroke}
                fontSize="9"
                fontWeight="bold"
                className="svg-frame-label"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
                {shape.name || 'FRAME'}
            </text>
        </g>
        {/* Edit-mode highlight ring shown when this frame is actively entered */}
        {isActiveEditFrame && (
            <rect
                width={shape.width}
                height={shape.height}
                fill="none"
                stroke={NEON_TURQUOISE}
                strokeWidth={2}
                strokeDasharray="6,3"
                opacity={0.75}
                className="svg-frame-active-ring"
                style={{ pointerEvents: 'none' }}
            />
        )}
        <g className="frame-children">
            {children}
        </g>
    </ShapeWrapper>
);

const SVGImage = ({ shape, isSelected, onClick }: { shape: ImageShape; isSelected?: boolean; onClick?: (e: React.MouseEvent) => void }) => {
    return (
        <ShapeWrapper
            shape={shape}
            centerOffset={{ x: shape.width / 2, y: shape.height / 2 }}
            isSelected={isSelected}
            onClick={onClick}
        >
            <image
                href={shape.src}
                x={0}
                y={0}
                width={shape.width}
                height={shape.height}
                preserveAspectRatio="none"
                style={{ pointerEvents: 'none' }}
                className="svg-primitive"
            />
        </ShapeWrapper>
    );
};

// --- SMART CONNECTOR ANCHOR OVERLAY ---

/**
 * Renders connection-point dots for each shape in anchorOverlays, and a
 * glowing snap-target ring for the currently-snapped anchor.
 * Rendered on top of all shapes so the dots are always visible.
 */
const ConnectorAnchors: React.FC<{
    anchorOverlays: { shape: Shape; anchors: AnchorPoint[] }[];
    snapTargetAnchor?: { shapeId: string; anchorType: AnchorType } | null;
}> = ({ anchorOverlays, snapTargetAnchor }) => {
    if (!anchorOverlays || anchorOverlays.length === 0) return null;

    return (
        <g className="connector-anchors" style={{ pointerEvents: 'none' }}>
            {anchorOverlays.map(({ shape, anchors }) =>
                anchors.map((anchor) => {
                    const isSnapTarget =
                        snapTargetAnchor?.shapeId === shape.id &&
                        snapTargetAnchor?.anchorType === anchor.type;

                    const { x, y } = anchor.position;

                    return (
                        <g key={`${shape.id}-${anchor.type}`}>
                            {/* Background dot for all anchor points */}
                            <circle
                                cx={x}
                                cy={y}
                                r={4}
                                fill="rgba(200, 200, 200, 0.75)"
                                stroke="#ffffff"
                                strokeWidth={1}
                                className="connector-anchor-dot"
                            />
                            {/* Glowing snap-target ring */}
                            {isSnapTarget && (
                                <>
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={9}
                                        fill="none"
                                        stroke={NEON_TURQUOISE}
                                        strokeWidth={2}
                                        className="connector-snap-ring"
                                        filter="url(#neon-bloom)"
                                    />
                                    {/* Solid inner fill for the active snap target */}
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={4}
                                        fill={NEON_TURQUOISE}
                                        stroke="none"
                                        className="connector-snap-dot"
                                    />
                                </>
                            )}
                        </g>
                    );
                })
            )}
        </g>
    );
};

// --- FREEHAND LINES AND TEXTS ---

const SVGFreehandLine = ({ line }: { line: any }) => {
    if (!line.points || line.points.length < 2) return null;
    let d = `M ${line.points[0]} ${line.points[1]}`;
    for (let i = 2; i < line.points.length; i += 2) {
        d += ` L ${line.points[i]} ${line.points[i + 1]}`;
    }
    return (
        <path
            d={d}
            stroke={line.color}
            strokeWidth={line.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="svg-primitive"
        />
    );
};

const SVGTextAnnotation = ({ text }: { text: any }) => {
    let anchor: 'start' | 'middle' | 'end' = 'start';
    if (text.textAlign === 'center') anchor = 'middle';
    else if (text.textAlign === 'right') anchor = 'end';

    return (
        <text
            x={text.x}
            y={text.y}
            transform={`rotate(${text.rotation || 0}, ${text.x}, ${text.y})`}
            fontFamily={text.fontFamily || 'Arial'}
            fontSize={text.fontSize || 18}
            fill={text.color || '#ffffff'}
            fontWeight={text.fontWeight || 'normal'}
            fontStyle={text.fontStyle || 'normal'}
            textDecoration={text.textDecoration || 'none'}
            dominantBaseline="hanging"
            textAnchor={anchor}
            className="svg-primitive svg-text"
        >
            {text.text}
        </text>
    );
};

// --- MAIN RENDERER ---

export const SVGShapeRenderer: React.FC<SVGShapeRendererProps> = ({
    shapes,
    lines = [],
    textAnnotations = [],
    width,
    height,
    selectedShapeIds,
    onShapeClick,
    transform = { x: 0, y: 0, scale: 1 },
    anchorOverlays = [],
    snapTargetAnchor,
    activeFrameId,
}) => {
    const sortedShapes = useMemo(() =>
        [...shapes].sort((a, b) => a.zIndex - b.zIndex),
        [shapes]);

    const handleClick = (shapeId: string) => (e: React.MouseEvent) => {
        if (onShapeClick) {
            e.stopPropagation();
            onShapeClick(shapeId, e);
        }
    };

    return (
        <svg
            className="svg-renderer-layer"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ overflow: 'visible' }}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <filter id="neon-bloom" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.4 0 0 0 0 0.99 0 0 0 0 0.95 0 0 0 0.5 0" />
                    <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <pattern id="tech-grid" width="8" height="8" patternUnits="userSpaceOnUse">
                    <path d="M 8 0 L 0 0 0 8" fill="none" stroke={NEON_TURQUOISE} strokeWidth="0.5" opacity="0.3" />
                    <rect width="8" height="8" fill={NEON_TURQUOISE} opacity="0.1" />
                </pattern>
                {/* Default arrowhead (fallback) */}
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={NEON_TURQUOISE} />
                </marker>
                {/* Selection highlight glow */}
                <filter id="selection-highlight" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.18 0 0 0 0 0.83 0 0 0 0 0.75 0 0 0 0.6 0" result="glow" />
                    <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Viewport transform: pan + zoom applied to all shapes */}
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                {/* 1. Freehand Lines */}
                {lines.map((line) => (
                    <SVGFreehandLine key={line.id} line={line} />
                ))}

                {/* 2. Shapes */}
                {(() => {
                    const renderShape = (shape: Shape): React.ReactNode => {
                        const isSelected = selectedShapeIds?.has(shape.id) || false;
                        const clickHandler = onShapeClick ? handleClick(shape.id) : undefined;

                        if (isRectangle(shape)) return <SVGRectangle key={shape.id} shape={shape} isSelected={isSelected} onClick={clickHandler} />;
                        if (isCircle(shape)) return <SVGCircle key={shape.id} shape={shape} isSelected={isSelected} onClick={clickHandler} />;
                        if (isEllipse(shape)) return <SVGEllipse key={shape.id} shape={shape} isSelected={isSelected} onClick={clickHandler} />;
                        if (isLine(shape)) return <SVGLine key={shape.id} shape={shape} isSelected={isSelected} onClick={clickHandler} />;
                        if (isArrow(shape)) return <SVGArrow key={shape.id} shape={shape} isSelected={isSelected} onClick={clickHandler} />;
                        if (isTriangle(shape)) return <SVGTriangle key={shape.id} shape={shape} isSelected={isSelected} onClick={clickHandler} />;
                        if (isImage(shape)) return <SVGImage key={shape.id} shape={shape} isSelected={isSelected} onClick={clickHandler} />;

                        if (isFrame(shape)) {
                            const children = sortedShapes.filter(s => s.parentId === shape.id);
                            return (
                                <SVGFrame
                                    key={shape.id}
                                    shape={shape}
                                    isSelected={isSelected}
                                    isActiveEditFrame={activeFrameId === shape.id}
                                    onClick={clickHandler}
                                >
                                    {children.map(child => renderShape(child))}
                                </SVGFrame>
                            );
                        }

                        return null;
                    };

                    // Only start rendering from root-level shapes (no parent)
                    return sortedShapes
                        .filter(s => !s.parentId && s.visible !== false)
                        .map(s => renderShape(s));
                })()}

                {/* 3. Text Annotations */}
                {textAnnotations.map((text) => (
                    <SVGTextAnnotation key={text.id} text={text} />
                ))}

                {/* 4. Smart Connector anchor overlays (always on top) */}
                <ConnectorAnchors
                    anchorOverlays={anchorOverlays}
                    snapTargetAnchor={snapTargetAnchor}
                />
            </g>
        </svg>
    );
};

export default SVGShapeRenderer;
