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

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Include shapes
        const selectedShapes = shapes.filter(s => selectedShapeIds.has(s.id));
        selectedShapes.forEach(shape => {
            const bbox = getShapeGeometryBoundingBox(shape);
            minX = Math.min(minX, bbox.minX);
            minY = Math.min(minY, bbox.minY);
            maxX = Math.max(maxX, bbox.maxX);
            maxY = Math.max(maxY, bbox.maxY);
        });

        // Include lines
        const selectedLines = lines.filter(l => selectedLineIds.has(l.id));
        selectedLines.forEach(line => {
            for (let i = 0; i < line.points.length; i += 2) {
                minX = Math.min(minX, line.points[i]);
                minY = Math.min(minY, line.points[i + 1]);
                maxX = Math.max(maxX, line.points[i]);
                maxY = Math.max(maxY, line.points[i + 1]);
            }
        });

        // Include text
        const selectedTexts = textAnnotations.filter(t => selectedTextIds.has(t.id));
        selectedTexts.forEach(text => {
            const textWidth = text.text.length * (text.fontSize * 0.6);
            const textHeight = text.fontSize * 1.2;
            minX = Math.min(minX, text.x);
            minY = Math.min(minY, text.y);
            maxX = Math.max(maxX, text.x + textWidth);
            maxY = Math.max(maxY, text.y + textHeight);
        });

        if (minX !== Infinity) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
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
