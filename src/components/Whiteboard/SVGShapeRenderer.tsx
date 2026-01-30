import React from 'react';
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

interface SVGShapeRendererProps {
    shapes: Shape[];
    width: number;
    height: number;
    onShapeClick?: (shape: Shape) => void;
    selectedShapeId?: string | null;
}

interface SVGShapeProps {
    shape: Shape;
    isSelected?: boolean;
    onClick?: (shape: Shape) => void;
}

const SVGRectangle: React.FC<{ shape: RectangleShape; isSelected?: boolean }> = ({
    shape,
    isSelected,
}) => {
    const { position, width, height, cornerRadius, style, transform, opacity } = shape;

    return (
        <rect
            x={position.x}
            y={position.y}
            width={width}
            height={height}
            rx={cornerRadius || 0}
            ry={cornerRadius || 0}
            fill={style.hasFill ? style.fill : 'none'}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            strokeLinecap={style.lineCap || 'round'}
            strokeLinejoin={style.lineJoin || 'round'}
            strokeDasharray={style.strokeDashArray?.join(',') || undefined}
            opacity={opacity}
            transform={`rotate(${transform.rotation} ${position.x + width / 2} ${position.y + height / 2}) scale(${transform.scaleX}, ${transform.scaleY})`}
            className={`svg-shape svg-rectangle ${isSelected ? 'svg-shape--selected' : ''}`}
            data-shape-id={shape.id}
        />
    );
};

const SVGCircle: React.FC<{ shape: CircleShape; isSelected?: boolean }> = ({
    shape,
    isSelected,
}) => {
    const { position, radius, style, transform, opacity } = shape;

    return (
        <circle
            cx={position.x}
            cy={position.y}
            r={radius}
            fill={style.hasFill ? style.fill : 'none'}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            strokeLinecap={style.lineCap || 'round'}
            strokeLinejoin={style.lineJoin || 'round'}
            strokeDasharray={style.strokeDashArray?.join(',') || undefined}
            opacity={opacity}
            transform={`rotate(${transform.rotation} ${position.x} ${position.y}) scale(${transform.scaleX}, ${transform.scaleY})`}
            className={`svg-shape svg-circle ${isSelected ? 'svg-shape--selected' : ''}`}
            data-shape-id={shape.id}
        />
    );
};

const SVGEllipse: React.FC<{ shape: EllipseShape; isSelected?: boolean }> = ({
    shape,
    isSelected,
}) => {
    const { position, radiusX, radiusY, style, transform, opacity } = shape;

    return (
        <ellipse
            cx={position.x}
            cy={position.y}
            rx={radiusX}
            ry={radiusY}
            fill={style.hasFill ? style.fill : 'none'}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            strokeLinecap={style.lineCap || 'round'}
            strokeLinejoin={style.lineJoin || 'round'}
            strokeDasharray={style.strokeDashArray?.join(',') || undefined}
            opacity={opacity}
            transform={`rotate(${transform.rotation} ${position.x} ${position.y}) scale(${transform.scaleX}, ${transform.scaleY})`}
            className={`svg-shape svg-ellipse ${isSelected ? 'svg-shape--selected' : ''}`}
            data-shape-id={shape.id}
        />
    );
};

const SVGLine: React.FC<{ shape: LineShape; isSelected?: boolean }> = ({
    shape,
    isSelected,
}) => {
    const { startPoint, endPoint, style, transform, opacity } = shape;
    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerY = (startPoint.y + endPoint.y) / 2;

    return (
        <line
            x1={startPoint.x}
            y1={startPoint.y}
            x2={endPoint.x}
            y2={endPoint.y}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            strokeLinecap={style.lineCap || 'round'}
            strokeLinejoin={style.lineJoin || 'round'}
            strokeDasharray={style.strokeDashArray?.join(',') || undefined}
            opacity={opacity}
            transform={`rotate(${transform.rotation} ${centerX} ${centerY})`}
            className={`svg-shape svg-line ${isSelected ? 'svg-shape--selected' : ''}`}
            data-shape-id={shape.id}
        />
    );
};

const SVGArrow: React.FC<{ shape: ArrowShape; isSelected?: boolean }> = ({
    shape,
    isSelected,
}) => {
    const {
        startPoint,
        endPoint,
        arrowAtStart,
        arrowAtEnd,
        arrowSize,
        style,
        transform,
        opacity,
        id,
    } = shape;

    const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
    const arrowAngle = Math.PI / 6;
    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerY = (startPoint.y + endPoint.y) / 2;

    const endArrowPoints = arrowAtEnd
        ? [
            endPoint.x - arrowSize * Math.cos(angle - arrowAngle),
            endPoint.y - arrowSize * Math.sin(angle - arrowAngle),
            endPoint.x,
            endPoint.y,
            endPoint.x - arrowSize * Math.cos(angle + arrowAngle),
            endPoint.y - arrowSize * Math.sin(angle + arrowAngle),
        ]
        : [];

    const startArrowPoints = arrowAtStart
        ? [
            startPoint.x + arrowSize * Math.cos(angle - arrowAngle),
            startPoint.y + arrowSize * Math.sin(angle - arrowAngle),
            startPoint.x,
            startPoint.y,
            startPoint.x + arrowSize * Math.cos(angle + arrowAngle),
            startPoint.y + arrowSize * Math.sin(angle + arrowAngle),
        ]
        : [];

    return (
        <g
            className={`svg-shape svg-arrow ${isSelected ? 'svg-shape--selected' : ''}`}
            data-shape-id={id}
            transform={`rotate(${transform.rotation} ${centerX} ${centerY})`}
            opacity={opacity}
        >
            <line
                x1={startPoint.x}
                y1={startPoint.y}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeLinecap={style.lineCap || 'round'}
                strokeDasharray={style.strokeDashArray?.join(',') || undefined}
            />
            {arrowAtEnd && (
                <polyline
                    points={endArrowPoints.join(',')}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth}
                    strokeLinecap={style.lineCap || 'round'}
                    strokeLinejoin={style.lineJoin || 'round'}
                />
            )}
            {arrowAtStart && (
                <polyline
                    points={startArrowPoints.join(',')}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth}
                    strokeLinecap={style.lineCap || 'round'}
                    strokeLinejoin={style.lineJoin || 'round'}
                />
            )}
        </g>
    );
};

const SVGTriangle: React.FC<{ shape: TriangleShape; isSelected?: boolean }> = ({
    shape,
    isSelected,
}) => {
    const { points, style, transform, opacity } = shape;
    const centroidX = (points[0].x + points[1].x + points[2].x) / 3;
    const centroidY = (points[0].y + points[1].y + points[2].y) / 3;
    const pointsString = points.map((p) => `${p.x},${p.y}`).join(' ');

    return (
        <polygon
            points={pointsString}
            fill={style.hasFill ? style.fill : 'none'}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            strokeLinecap={style.lineCap || 'round'}
            strokeLinejoin={style.lineJoin || 'round'}
            strokeDasharray={style.strokeDashArray?.join(',') || undefined}
            opacity={opacity}
            transform={`rotate(${transform.rotation} ${centroidX} ${centroidY}) scale(${transform.scaleX}, ${transform.scaleY})`}
            className={`svg-shape svg-triangle ${isSelected ? 'svg-shape--selected' : ''}`}
            data-shape-id={shape.id}
        />
    );
};

const SVGShape: React.FC<SVGShapeProps> = ({ shape, isSelected, onClick }) => {
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClick?.(shape);
    };

    const wrapperProps = {
        onClick: handleClick,
        style: { cursor: onClick ? 'pointer' : 'default' },
    };

    if (isRectangle(shape)) {
        return (
            <g {...wrapperProps}>
                <SVGRectangle shape={shape} isSelected={isSelected} />
            </g>
        );
    }

    if (isCircle(shape)) {
        return (
            <g {...wrapperProps}>
                <SVGCircle shape={shape} isSelected={isSelected} />
            </g>
        );
    }

    if (isEllipse(shape)) {
        return (
            <g {...wrapperProps}>
                <SVGEllipse shape={shape} isSelected={isSelected} />
            </g>
        );
    }

    if (isLine(shape)) {
        return (
            <g {...wrapperProps}>
                <SVGLine shape={shape} isSelected={isSelected} />
            </g>
        );
    }

    if (isArrow(shape)) {
        return (
            <g {...wrapperProps}>
                <SVGArrow shape={shape} isSelected={isSelected} />
            </g>
        );
    }

    if (isTriangle(shape)) {
        return (
            <g {...wrapperProps}>
                <SVGTriangle shape={shape} isSelected={isSelected} />
            </g>
        );
    }

    console.warn(`Unknown shape type: ${(shape as any).type}`);
    return null;
};

export const SVGShapeRenderer: React.FC<SVGShapeRendererProps> = ({
    shapes,
    width,
    height,
    onShapeClick,
    selectedShapeId,
}) => {
    const sortedShapes = [...shapes].sort((a, b) => a.zIndex - b.zIndex);

    return (
        <svg
            className="svg-shape-renderer"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <filter id="selection-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feFlood floodColor="#3B82F6" floodOpacity="0.6" />
                    <feComposite in2="blur" operator="in" />
                    <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {sortedShapes
                .filter((shape) => shape.visible)
                .map((shape) => (
                    <SVGShape
                        key={shape.id}
                        shape={shape}
                        isSelected={selectedShapeId === shape.id}
                        onClick={onShapeClick}
                    />
                ))}
        </svg>
    );
};

export default SVGShapeRenderer;
