import React, { useMemo } from 'react';
import {
    Shape,
    RectangleShape,
    CircleShape,
    EllipseShape,
    LineShape,
    ArrowShape,
    TriangleShape,
    isRectangle,
    isCircle,
    isEllipse,
    isLine,
    isArrow,
    isTriangle,
} from '../../types/shapes';
import './SVGShapeRenderer.css';

// --- PROPS ---
interface SVGShapeRendererProps {
    shapes: Shape[];
    width: number;
    height: number;
}

// --- CONSTANTS ---
const NEON_TURQUOISE = '#66FCF1';

// --- HELPER COMPONENTS ---

/**
 * Shape Wrapper
 * Handles Transforms centrally.
 */
interface ShapeWrapperProps {
    shape: Shape;
    children: React.ReactNode;
    dimensions: { width: number; height: number };
    centerOffset: { x: number; y: number };
}

const ShapeWrapper: React.FC<ShapeWrapperProps> = ({ shape, children, dimensions, centerOffset }) => {
    const { position, transform, opacity } = shape;

    const centerX = position.x + centerOffset.x;
    const centerY = position.y + centerOffset.y;

    return (
        <g
            transform={`translate(${centerX}, ${centerY}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})`}
            opacity={opacity}
            className="svg-shape-group"
            data-tech-id={shape.id}
        >
            <g transform={`translate(${-centerOffset.x}, ${-centerOffset.y})`}>
                {children}
            </g>
        </g>
    );
};

// --- PRIMITIVE SHAPES ---

const SVGRectangle = ({ shape }: { shape: RectangleShape }) => (
    <ShapeWrapper
        shape={shape}
        dimensions={{ width: shape.width, height: shape.height }}
        centerOffset={{ x: shape.width / 2, y: shape.height / 2 }}
    >
        <rect
            width={shape.width}
            height={shape.height}
            rx={shape.cornerRadius || 0}
            fill={shape.style.hasFill ? shape.style.fill : 'none'}
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
            className="svg-primitive"
        />
    </ShapeWrapper>
);

const SVGCircle = ({ shape }: { shape: CircleShape }) => (
    <ShapeWrapper
        shape={shape}
        dimensions={{ width: shape.radius * 2, height: shape.radius * 2 }}
        centerOffset={{ x: 0, y: 0 }}
    >
        <circle
            cx={0} cy={0}
            r={shape.radius}
            fill={shape.style.hasFill ? shape.style.fill : 'none'}
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
            className="svg-primitive"
        />
    </ShapeWrapper>
);

const SVGEllipse = ({ shape }: { shape: EllipseShape }) => (
    <ShapeWrapper
        shape={shape}
        dimensions={{ width: shape.radiusX * 2, height: shape.radiusY * 2 }}
        centerOffset={{ x: 0, y: 0 }}
    >
        <ellipse
            cx={0} cy={0}
            rx={shape.radiusX}
            ry={shape.radiusY}
            fill={shape.style.hasFill ? shape.style.fill : 'none'}
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
            className="svg-primitive"
        />
    </ShapeWrapper>
);

const SVGLine = ({ shape }: { shape: LineShape }) => {
    const dx = shape.endPoint.x - shape.startPoint.x;
    const dy = shape.endPoint.y - shape.startPoint.y;
    const midX = shape.startPoint.x + dx / 2;
    const midY = shape.startPoint.y + dy / 2;

    return (
        <g
            transform={`translate(${midX}, ${midY}) rotate(${shape.transform.rotation})`}
            opacity={shape.opacity}
            className="svg-shape-group"
        >
            <line
                x1={-dx / 2} y1={-dy / 2}
                x2={dx / 2} y2={dy / 2}
                stroke={shape.style.stroke}
                strokeWidth={shape.style.strokeWidth}
                strokeLinecap="round"
                className="svg-primitive"
            />
        </g>
    );
};

const SVGArrow = ({ shape }: { shape: ArrowShape }) => {
    const dx = shape.endPoint.x - shape.startPoint.x;
    const dy = shape.endPoint.y - shape.startPoint.y;
    const midX = shape.startPoint.x + dx / 2;
    const midY = shape.startPoint.y + dy / 2;

    return (
        <g
            transform={`translate(${midX}, ${midY}) rotate(${shape.transform.rotation})`}
            opacity={shape.opacity}
            className="svg-shape-group"
        >
            <line
                x1={-dx / 2} y1={-dy / 2}
                x2={dx / 2} y2={dy / 2}
                stroke={shape.style.stroke}
                strokeWidth={shape.style.strokeWidth}
                strokeLinecap="round"
                markerEnd="url(#arrowhead)"
                className="svg-primitive"
            />
        </g>
    );
};

const SVGTriangle = ({ shape }: { shape: TriangleShape }) => {
    const cx = (shape.points[0].x + shape.points[1].x + shape.points[2].x) / 3;
    const cy = (shape.points[0].y + shape.points[1].y + shape.points[2].y) / 3;

    const relPoints = shape.points.map(p => `${p.x - cx},${p.y - cy}`).join(' ');

    return (
        <g
            transform={`translate(${cx}, ${cy}) rotate(${shape.transform.rotation}) scale(${shape.transform.scaleX}, ${shape.transform.scaleY})`}
            opacity={shape.opacity}
            className="svg-shape-group"
        >
            <polygon
                points={relPoints}
                fill={shape.style.hasFill ? shape.style.fill : 'none'}
                stroke={shape.style.stroke}
                strokeWidth={shape.style.strokeWidth}
                className="svg-primitive"
            />
        </g>
    );
};

// --- MAIN RENDERER ---

export const SVGShapeRenderer: React.FC<SVGShapeRendererProps> = ({
    shapes,
    width,
    height,
}) => {
    const sortedShapes = useMemo(() =>
        [...shapes].sort((a, b) => a.zIndex - b.zIndex),
        [shapes]);

    return (
        <svg
            className="svg-renderer-layer"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
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
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={NEON_TURQUOISE} />
                </marker>
            </defs>

            {sortedShapes
                .filter((shape) => shape.visible)
                .map((shape) => {
                    if (isRectangle(shape)) return <SVGRectangle key={shape.id} shape={shape} />;
                    if (isCircle(shape)) return <SVGCircle key={shape.id} shape={shape} />;
                    if (isEllipse(shape)) return <SVGEllipse key={shape.id} shape={shape} />;
                    if (isLine(shape)) return <SVGLine key={shape.id} shape={shape} />;
                    if (isArrow(shape)) return <SVGArrow key={shape.id} shape={shape} />;
                    if (isTriangle(shape)) return <SVGTriangle key={shape.id} shape={shape} />;

                    return null;
                })}
        </svg>
    );
};

export default SVGShapeRenderer;