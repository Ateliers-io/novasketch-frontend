export enum ShapeType {
    RECTANGLE = 'rectangle',
    CIRCLE = 'circle',
    ELLIPSE = 'ellipse',
    LINE = 'line',
    ARROW = 'arrow',
    TRIANGLE = 'triangle',
}

export enum ToolType {
    PEN = 'pen',
    ERASER = 'eraser',
    RECTANGLE = 'rectangle',
    CIRCLE = 'circle',
    ELLIPSE = 'ellipse',
    LINE = 'line',
    ARROW = 'arrow',
    TRIANGLE = 'triangle',
    TEXT = 'text',
}

export interface BaseCanvasObject {
    id: string;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    zIndex: number;
    isSelected?: boolean;
    isLocked?: boolean;
    opacity: number;
    visible: boolean;
}

export interface Position {
    x: number;
    y: number;
}

export interface Dimensions {
    width: number;
    height: number;
}

export interface ShapeStyle {
    fill: string;
    hasFill: boolean;
    stroke: string;
    strokeWidth: number;
    strokeDashArray?: number[];
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
}

export interface Transform {
    rotation: number;
    scaleX: number;
    scaleY: number;
    skewX?: number;
    skewY?: number;
}

export interface BaseShape extends BaseCanvasObject {
    type: ShapeType;
    position: Position;
    style: ShapeStyle;
    transform: Transform;
}

export interface RectangleShape extends BaseShape {
    type: ShapeType.RECTANGLE;
    width: number;
    height: number;
    cornerRadius?: number;
}

export interface CircleShape extends BaseShape {
    type: ShapeType.CIRCLE;
    radius: number;
}

export interface EllipseShape extends BaseShape {
    type: ShapeType.ELLIPSE;
    radiusX: number;
    radiusY: number;
}

export interface LineShape extends BaseShape {
    type: ShapeType.LINE;
    startPoint: Position;
    endPoint: Position;
}

export interface ArrowShape extends BaseShape {
    type: ShapeType.ARROW;
    startPoint: Position;
    endPoint: Position;
    arrowAtStart: boolean;
    arrowAtEnd: boolean;
    arrowSize: number;
}

export interface TriangleShape extends BaseShape {
    type: ShapeType.TRIANGLE;
    points: [Position, Position, Position];
}

export type Shape =
    | RectangleShape
    | CircleShape
    | EllipseShape
    | LineShape
    | ArrowShape
    | TriangleShape;

export const DEFAULT_SHAPE_STYLE: ShapeStyle = {
    fill: '#3B82F6',
    hasFill: true,
    stroke: '#1E40AF',
    strokeWidth: 2,
    lineCap: 'round',
    lineJoin: 'round',
};

export const DEFAULT_TRANSFORM: Transform = {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
};

export function generateShapeId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `shape-${timestamp}-${randomPart}`;
}

export function getCurrentTimestamp(): string {
    return new Date().toISOString();
}

export function createRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    options?: Partial<RectangleShape>
): RectangleShape {
    const now = getCurrentTimestamp();
    return {
        id: generateShapeId(),
        type: ShapeType.RECTANGLE,
        position: { x, y },
        width,
        height,
        cornerRadius: 0,
        style: { ...DEFAULT_SHAPE_STYLE },
        transform: { ...DEFAULT_TRANSFORM },
        zIndex: 0,
        opacity: 1,
        visible: true,
        createdAt: now,
        updatedAt: now,
        ...options,
    };
}

export function createCircle(
    x: number,
    y: number,
    radius: number,
    options?: Partial<CircleShape>
): CircleShape {
    const now = getCurrentTimestamp();
    return {
        id: generateShapeId(),
        type: ShapeType.CIRCLE,
        position: { x, y },
        radius,
        style: { ...DEFAULT_SHAPE_STYLE },
        transform: { ...DEFAULT_TRANSFORM },
        zIndex: 0,
        opacity: 1,
        visible: true,
        createdAt: now,
        updatedAt: now,
        ...options,
    };
}

export function createEllipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    options?: Partial<EllipseShape>
): EllipseShape {
    const now = getCurrentTimestamp();
    return {
        id: generateShapeId(),
        type: ShapeType.ELLIPSE,
        position: { x, y },
        radiusX,
        radiusY,
        style: { ...DEFAULT_SHAPE_STYLE },
        transform: { ...DEFAULT_TRANSFORM },
        zIndex: 0,
        opacity: 1,
        visible: true,
        createdAt: now,
        updatedAt: now,
        ...options,
    };
}

export function createLine(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options?: Partial<LineShape>
): LineShape {
    const now = getCurrentTimestamp();
    return {
        id: generateShapeId(),
        type: ShapeType.LINE,
        position: { x: startX, y: startY },
        startPoint: { x: startX, y: startY },
        endPoint: { x: endX, y: endY },
        style: { ...DEFAULT_SHAPE_STYLE, hasFill: false },
        transform: { ...DEFAULT_TRANSFORM },
        zIndex: 0,
        opacity: 1,
        visible: true,
        createdAt: now,
        updatedAt: now,
        ...options,
    };
}

export function createArrow(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options?: Partial<ArrowShape>
): ArrowShape {
    const now = getCurrentTimestamp();
    return {
        id: generateShapeId(),
        type: ShapeType.ARROW,
        position: { x: startX, y: startY },
        startPoint: { x: startX, y: startY },
        endPoint: { x: endX, y: endY },
        arrowAtStart: false,
        arrowAtEnd: true,
        arrowSize: 10,
        style: { ...DEFAULT_SHAPE_STYLE, hasFill: false },
        transform: { ...DEFAULT_TRANSFORM },
        zIndex: 0,
        opacity: 1,
        visible: true,
        createdAt: now,
        updatedAt: now,
        ...options,
    };
}

export function isRectangle(shape: Shape): shape is RectangleShape {
    return shape.type === ShapeType.RECTANGLE;
}

export function isCircle(shape: Shape): shape is CircleShape {
    return shape.type === ShapeType.CIRCLE;
}

export function isEllipse(shape: Shape): shape is EllipseShape {
    return shape.type === ShapeType.ELLIPSE;
}

export function isLine(shape: Shape): shape is LineShape {
    return shape.type === ShapeType.LINE;
}

export function isArrow(shape: Shape): shape is ArrowShape {
    return shape.type === ShapeType.ARROW;
}

export function isTriangle(shape: Shape): shape is TriangleShape {
    return shape.type === ShapeType.TRIANGLE;
}
