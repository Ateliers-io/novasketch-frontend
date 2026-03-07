// Vector erasure implementation using collision detection.
// Algorithm complexity is roughly O(N*M) where N is strokes and M is segments.
// Considerations for future optimization: Implementing a spatial index (QuadTree) if performance degrades on large canvases.
import {
    Shape,
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
} from '../../../types/shapes';
import { StrokeLine } from '../../../services/sync.service';
import { distSq, getSegmentCircleIntersections } from './mathUtils';
type Point = {
    x: number;
    y: number;
};

type Eraser = {
    center: Point;
    radius: number;
};

type StrokeContext = {
    currentLinePoints: number[];
    finishLine: () => void;
};
function processStrokeSegment(
    previous: Point,
    current: Point,
    eraser: Eraser,
    ctx: StrokeContext
): Point {

    const intersections =
        getSegmentCircleIntersections(
            previous,
            current,
            eraser.center,
            eraser.radius
        );

    if (intersections.length > 0) {
        intersections.sort(
            (a, b) => distSq(previous, a) - distSq(previous, b)
        );

        const p1Outside =
            distSq(previous, eraser.center) >= eraser.radius ** 2;

        if (p1Outside) {
            ctx.currentLinePoints.push(
                intersections[0].x,
                intersections[0].y
            );

            ctx.finishLine();

            if (intersections.length === 2) {
                ctx.currentLinePoints.push(
                    intersections[1].x,
                    intersections[1].y
                );
            }
        } else {
            ctx.currentLinePoints.push(
                intersections[0].x,
                intersections[0].y
            );
        }
    }

    if (
        distSq(current, eraser.center) >=
        eraser.radius ** 2
    ) {
        ctx.currentLinePoints.push(current.x, current.y);
    } else if (ctx.currentLinePoints.length > 0) {
        ctx.finishLine();
    }

    return current;
}

export function eraseAtPosition(x: number, y: number, strokes: StrokeLine[], eraserRadius: number): StrokeLine[] {
    const result: StrokeLine[] = [];
    for (const stroke of strokes) {
        const points = stroke.points;
        const currentLinePoints: number[] = [];

        const finishLine = () => {
            if (currentLinePoints.length >= 4) {
                result.push({ ...stroke, id: `${stroke.id}-${Math.floor(Math.random() * 1000000)}`, points: [...currentLinePoints] });
            }
            currentLinePoints.length = 0; // Clear in-place to preserve reference in ctx
        };

        if (points.length < 4) { result.push(stroke); continue; }

        let px = points[0];
        let py = points[1];

        if (distSq({ x: px, y: py }, { x, y }) >= eraserRadius ** 2) {
            currentLinePoints.push(px, py);
        }
        const previous: Point = { x: 0, y: 0 };
        const current: Point = { x: 0, y: 0 };

        const eraser: Eraser = {
            center: { x, y },
            radius: eraserRadius,
        };

        const ctx: StrokeContext = {
            currentLinePoints,
            finishLine,
        };

        for (let i = 2; i < points.length; i += 2) {

            previous.x = px;
            previous.y = py;

            current.x = points[i];
            current.y = points[i + 1];

            const nextPoint = processStrokeSegment(
                previous,
                current,
                eraser,
                ctx
            );

            px = nextPoint.x;
            py = nextPoint.y;
        }
        finishLine();
    }
    return result;
}

export function removeStrokesAt(x: number, y: number, strokes: StrokeLine[], radius: number): StrokeLine[] {
    return strokes.filter(line => {
        for (let i = 0; i < line.points.length; i += 2) {
            if (distSq({ x: line.points[i], y: line.points[i + 1] }, { x, y }) < radius ** 2) {
                return false;
            }
        }
        return true;
    });
}

// Helper to determine if the eraser area overlaps with a shape.
// Utilizes bounding box or geometric distance checks depending on shape type.
export function isPointInShape(shape: Shape, x: number, y: number, radius: number): boolean {
    const rotation = shape.transform?.rotation || 0;
    let tx = x;
    let ty = y;

    // Bounding dimensions (with scale)
    const s = shape as any;
    const w = (s.width || (isCircle(shape) ? s.radius * 2 : 0) || (isEllipse(shape) ? s.radiusX * 2 : 0)) * (shape.transform?.scaleX || 1);
    const h = (s.height || (isCircle(shape) ? s.radius * 2 : 0) || (isEllipse(shape) ? s.radiusY * 2 : 0)) * (shape.transform?.scaleY || 1);

    if (rotation !== 0) {
        // Rotate point into local space around shape center
        const centerX = shape.position.x + w / 2;
        const centerY = shape.position.y + h / 2;
        const rad = (-rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = x - centerX;
        const dy = y - centerY;
        tx = dx * cos - dy * sin + centerX;
        ty = dx * sin + dy * cos + centerY;
    }

    if (isRectangle(shape) || shape.type === 'frame') {
        return tx >= shape.position.x - radius &&
            tx <= shape.position.x + w + radius &&
            ty >= shape.position.y - radius &&
            ty <= shape.position.y + h + radius;
    } else if (isCircle(shape)) {
        const dist = Math.hypot(shape.position.x - tx, shape.position.y - ty);
        const r = (shape as CircleShape).radius * Math.max(shape.transform?.scaleX || 1, shape.transform?.scaleY || 1);
        return dist <= r + radius;
    } else if (isEllipse(shape)) {
        const es = shape as EllipseShape;
        const rx = es.radiusX * (shape.transform?.scaleX || 1) + radius;
        const ry = es.radiusY * (shape.transform?.scaleY || 1) + radius;
        const dx = (tx - shape.position.x) / rx;
        const dy = (ty - shape.position.y) / ry;
        return dx * dx + dy * dy <= 1;
    } else if (isLine(shape) || isArrow(shape)) {
        // Point-to-line-segment distance
        const dx = shape.endPoint.x - shape.startPoint.x;
        const dy = shape.endPoint.y - shape.startPoint.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(shape.startPoint.x - x, shape.startPoint.y - y) <= radius + 5;
        let t = ((x - shape.startPoint.x) * dx + (y - shape.startPoint.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const closestX = shape.startPoint.x + t * dx;
        const closestY = shape.startPoint.y + t * dy;
        const dist = Math.hypot(x - closestX, y - closestY);
        return dist <= radius + shape.style.strokeWidth / 2 + 5;
    } else if (isTriangle(shape)) {
        // Bounding box check
        const xs = shape.points.map(p => p.x);
        const ys = shape.points.map(p => p.y);
        const minX = Math.min(...xs) - radius;
        const maxX = Math.max(...xs) + radius;
        const minY = Math.min(...ys) - radius;
        const maxY = Math.max(...ys) + radius;
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }
    return false;
}
