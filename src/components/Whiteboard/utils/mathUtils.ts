/**
 * Pure math / geometry helpers used by the Whiteboard.
 * Extracted from Whiteboard.tsx (lines 82-208).
 */
import { Position } from '../../../types/shapes';

// collision detection for eraser. expensive but necessary.
export function distSq(p1: { x: number; y: number }, p2: { x: number; y: number }) {
    return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
}

export function getSegmentCircleIntersections(p1: Position, p2: Position, c: Position, r: number) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - c.x;
    const fy = p1.y - c.y;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const C = fx * fx + fy * fy - r * r;
    let discriminant = b * b - 4 * a * C;
    const intersections: Position[] = [];

    if (discriminant >= 0 && a !== 0) {
        const sqrtDisc = Math.sqrt(discriminant);
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);
        if (t1 >= 0 && t1 <= 1) intersections.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy });
        if (t2 >= 0 && t2 <= 1) intersections.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy });
    }
    return intersections;
}

// z-index manipulation (bring forward). naive array swap.
export function moveForward<T extends { id: string }>(items: T[], selectedIds: Set<string>): T[] {
    const newItems = [...items];
    for (let i = newItems.length - 2; i >= 0; i--) {
        if (selectedIds.has(newItems[i].id) && !selectedIds.has(newItems[i + 1].id)) {
            [newItems[i], newItems[i + 1]] = [newItems[i + 1], newItems[i]];
        }
    }
    return newItems;
}

// z-index manipulation (send backward).
export function moveBackward<T extends { id: string }>(items: T[], selectedIds: Set<string>): T[] {
    const newItems = [...items];
    for (let i = 1; i < newItems.length; i++) {
        if (selectedIds.has(newItems[i].id) && !selectedIds.has(newItems[i - 1].id)) {
            [newItems[i], newItems[i - 1]] = [newItems[i - 1], newItems[i]];
        }
    }
    return newItems;
}

// Font family mapping with proper fallbacks (system fonts only)
export function getFontFamilyWithFallback(fontFamily: string): string {
    const fontMap: Record<string, string> = {
        'Arial': 'Arial, sans-serif',
        'Times New Roman': '"Times New Roman", serif',
        'Courier New': '"Courier New", monospace'
    };
    return fontMap[fontFamily] || 'Arial, sans-serif';
}
