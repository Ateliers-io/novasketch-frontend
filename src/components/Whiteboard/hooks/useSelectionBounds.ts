import { useEffect, useState } from 'react';
import { Shape } from '../../../types/shapes';
import { StrokeLine } from '../../../services/sync.service';
import { TextAnnotation } from '../types';
import { getShapeGeometryBoundingBox, BoundingBox } from '../../../utils/boundingBox';

interface UseSelectionBoundsOptions {
    selectedShapeIds: Set<string>;
    selectedLineIds: Set<string>;
    selectedTextIds: Set<string>;
    shapes: Shape[];
    lines: StrokeLine[];
    textAnnotations: TextAnnotation[];
    isDragging?: boolean;
}

/**
 * Computes a combined bounding box for all selected shapes, lines, and text.
 * Returns null when nothing is selected.
 * When isDragging is true, the bounding box is frozen to prevent jitter.
 */
export function useSelectionBounds({
    selectedShapeIds,
    selectedLineIds,
    selectedTextIds,
    shapes,
    lines,
    textAnnotations,
    isDragging = false,
}: UseSelectionBoundsOptions) {
    const [selectionBoundingBox, setSelectionBoundingBox] = useState<BoundingBox | null>(null);

    useEffect(() => {
        // Freeze bounding box during drag to prevent jitter
        if (isDragging) return;

        const hasSelection = selectedShapeIds.size > 0 || selectedLineIds.size > 0 || selectedTextIds.size > 0;

        if (!hasSelection) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectionBoundingBox(null);
            return;
        }

        const getGlobalTransform = (parentId: string | undefined): { x: number, y: number, sx: number, sy: number } => {
            const m = { x: 0, y: 0, sx: 1, sy: 1 };
            let curr = parentId;
            const path: Shape[] = [];
            for (let depth = 0; depth < 5 && curr; depth++) {
                const p = shapes.find(sh => sh.id === curr);
                if (p) {
                    path.unshift(p);
                    curr = p.parentId;
                } else break;
            }
            for (const p of path) {
                m.x += p.position.x * m.sx;
                m.y += p.position.y * m.sy;
                m.sx *= p.transform?.scaleX ?? 1;
                m.sy *= p.transform?.scaleY ?? 1;
            }
            return m;
        };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Include shapes
        const selectedShapes = shapes.filter(s => selectedShapeIds.has(s.id));
        selectedShapes.forEach(shape => {
            const bbox = getShapeGeometryBoundingBox(shape);
            const m = getGlobalTransform(shape.parentId);
            const gMinX = m.x + bbox.minX * m.sx;
            const gMinY = m.y + bbox.minY * m.sy;
            const gMaxX = m.x + bbox.maxX * m.sx;
            const gMaxY = m.y + bbox.maxY * m.sy;

            minX = Math.min(minX, gMinX);
            minY = Math.min(minY, gMinY);
            maxX = Math.max(maxX, gMaxX);
            maxY = Math.max(maxY, gMaxY);
        });

        // Include lines
        const selectedLines = lines.filter(l => selectedLineIds.has(l.id));
        selectedLines.forEach(line => {
            const m = getGlobalTransform(line.parentId);
            for (let i = 0; i < line.points.length; i += 2) {
                const px = m.x + line.points[i] * m.sx;
                const py = m.y + line.points[i + 1] * m.sy;
                minX = Math.min(minX, px);
                minY = Math.min(minY, py);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
            }
        });

        // Include text
        const selectedTexts = textAnnotations.filter(t => selectedTextIds.has(t.id));
        selectedTexts.forEach(text => {
            const m = getGlobalTransform(text.parentId);
            const textWidth = text.text.length * (text.fontSize * 0.6);
            const textHeight = text.fontSize * 1.2;
            const gMinX = m.x + text.x * m.sx;
            const gMinY = m.y + text.y * m.sy;
            const gMaxX = m.x + (text.x + textWidth) * m.sx;
            const gMaxY = m.y + (text.y + textHeight) * m.sy;

            minX = Math.min(minX, gMinX);
            minY = Math.min(minY, gMinY);
            maxX = Math.max(maxX, gMaxX);
            maxY = Math.max(maxY, gMaxY);
        });

        if (minX !== Infinity) {
             
            setSelectionBoundingBox({
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                minX,
                minY,
                maxX,
                maxY,
                centerX: (minX + maxX) / 2,
                centerY: (minY + maxY) / 2,
            });
        }
    }, [selectedShapeIds, selectedLineIds, selectedTextIds, shapes, lines, textAnnotations, isDragging]);

    return selectionBoundingBox;
}
