/**
 * Eraser-related collision detection and stroke splitting logic.
 * Extracted from Whiteboard.tsx (lines 108-176).
 */
import {
    Shape,
    isRectangle,
    isCircle,
    isEllipse,
    isLine,
    isArrow,
    isTriangle,
    RectangleShape,
    CircleShape,
    EllipseShape,
    LineShape,
    TriangleShape,
} from '../../../types/shapes';
import { StrokeLine } from '../../../services/sync.service';
import { distSq, getSegmentCircleIntersections } from './mathUtils';

export function eraseAtPosition(x: number, y: number, strokes: StrokeLine[], eraserRadius: number): StrokeLine[] {
    const result: StrokeLine[] = [];
    for (const stroke of strokes) {
        const points = stroke.points;
        let currentLinePoints: number[] = [];
        let segmentCount = 0;

        const finishLine = () => {
            if (currentLinePoints.length >= 4) {
                // generating unique ID for split segments to avoid react key collisions.
                result.push({ ...stroke, id: `${stroke.id}-${Math.floor(Math.random() * 1000000)}`, points: [...currentLinePoints] });
            }
            currentLinePoints = [];
        };

        if (points.length < 4) { result.push(stroke); continue; }

        let px = points[0];
        let py = points[1];

        if (distSq({ x: px, y: py }, { x, y }) >= eraserRadius ** 2) {
            currentLinePoints.push(px, py);
        }

        for (let i = 2; i < points.length; i += 2) {
            const cx = points[i];
            const cy = points[i + 1];
            const p1 = { x: px, y: py };
            const p2 = { x: cx, y: cy };

            const intersections = getSegmentCircleIntersections(p1, p2, { x, y }, eraserRadius);

            if (intersections.length > 0) {
                intersections.sort((a, b) => distSq(p1, a) - distSq(p1, b));
                if (distSq(p1, { x, y }) >= eraserRadius ** 2) {
                    currentLinePoints.push(intersections[0].x, intersections[0].y);
                    finishLine();
                }
                if (intersections.length === 2) {
                    currentLinePoints.push(intersections[1].x, intersections[1].y);
                }
            }

            if (distSq(p2, { x, y }) >= eraserRadius ** 2) {
                currentLinePoints.push(cx, cy);
            } else {
                if (currentLinePoints.length > 0) {
                    finishLine();
                }
            }

            px = cx;
            py = cy;
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

// Helper to check if eraser hits a shape
export function isPointInShape(shape: Shape, x: number, y: number, radius: number): boolean {
    if (isRectangle(shape)) {
        const s = shape as RectangleShape;
        return x >= s.position.x - radius &&
            x <= s.position.x + s.width + radius &&
            y >= s.position.y - radius &&
            y <= s.position.y + s.height + radius;
    }
    if (isCircle(shape)) {
        const s = shape as CircleShape;
        const dist = Math.sqrt((s.position.x - x) ** 2 + (s.position.y - y) ** 2);
        return dist <= s.radius + radius;
    }
    if (isEllipse(shape)) {
        const s = shape as EllipseShape;
        const dx = (x - s.position.x) / (s.radiusX + radius);
        const dy = (y - s.position.y) / (s.radiusY + radius);
        return dx * dx + dy * dy <= 1;
    }
    if (isLine(shape) || isArrow(shape)) {
        const s = shape as LineShape;
        // Point-to-line-segment distance
        const dx = s.endPoint.x - s.startPoint.x;
        const dy = s.endPoint.y - s.startPoint.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.sqrt((s.startPoint.x - x) ** 2 + (s.startPoint.y - y) ** 2) <= radius + 5;
        let t = ((x - s.startPoint.x) * dx + (y - s.startPoint.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const closestX = s.startPoint.x + t * dx;
        const closestY = s.startPoint.y + t * dy;
        const dist = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
        return dist <= radius + s.style.strokeWidth / 2 + 5;
    }
    if (isTriangle(shape)) {
        const s = shape as TriangleShape;
        // Bounding box check
        const xs = s.points.map(p => p.x);
        const ys = s.points.map(p => p.y);
        const minX = Math.min(...xs) - radius;
        const maxX = Math.max(...xs) + radius;
        const minY = Math.min(...ys) - radius;
        const maxY = Math.max(...ys) + radius;
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }
    return false;
}
