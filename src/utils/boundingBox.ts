/**
 * Bounding Box Calculation Utilities
 * Task 4.1.1: Implement a "bounding box" calculation for selected items
 * 
 * This module provides functions to calculate the minimum enclosing rectangle
 * (bounding box) for any shape or group of shapes on the canvas.
 */

import {
    Shape,
    ShapeType,
    RectangleShape,
    CircleShape,
    EllipseShape,
    LineShape,
    ArrowShape,
    TriangleShape,
    Position,
} from '../types/shapes';

/**
 * Represents a bounding box with position and dimensions
 */
export interface BoundingBox {
    x: number;      // Left edge
    y: number;      // Top edge
    width: number;  // Width of the box
    height: number; // Height of the box
    // Derived properties for convenience
    minX: number;   // Left edge (same as x)
    minY: number;   // Top edge (same as y)
    maxX: number;   // Right edge (x + width)
    maxY: number;   // Bottom edge (y + height)
    centerX: number; // Center X coordinate
    centerY: number; // Center Y coordinate
}

/**
 * Creates a BoundingBox object from min/max coordinates
 */
function createBoundingBox(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
    const width = maxX - minX;
    const height = maxY - minY;
    return {
        x: minX,
        y: minY,
        width,
        height,
        minX,
        minY,
        maxX,
        maxY,
        centerX: minX + width / 2,
        centerY: minY + height / 2,
    };
}

/**
 * Calculates the bounding box for a Rectangle shape
 */
function getRectangleBoundingBox(shape: RectangleShape): BoundingBox {
    const { position, width, height } = shape;
    return createBoundingBox(
        position.x,
        position.y,
        position.x + width,
        position.y + height
    );
}

/**
 * Calculates the bounding box for a Circle shape
 */
function getCircleBoundingBox(shape: CircleShape): BoundingBox {
    const { position, radius } = shape;
    // Position is the center for circles
    return createBoundingBox(
        position.x - radius,
        position.y - radius,
        position.x + radius,
        position.y + radius
    );
}

/**
 * Calculates the bounding box for an Ellipse shape
 */
function getEllipseBoundingBox(shape: EllipseShape): BoundingBox {
    const { position, radiusX, radiusY } = shape;
    // Position is the center for ellipses
    return createBoundingBox(
        position.x - radiusX,
        position.y - radiusY,
        position.x + radiusX,
        position.y + radiusY
    );
}

/**
 * Calculates the bounding box for a Line shape
 */
function getLineBoundingBox(shape: LineShape): BoundingBox {
    const { startPoint, endPoint } = shape;
    return createBoundingBox(
        Math.min(startPoint.x, endPoint.x),
        Math.min(startPoint.y, endPoint.y),
        Math.max(startPoint.x, endPoint.x),
        Math.max(startPoint.y, endPoint.y)
    );
}

/**
 * Calculates the bounding box for an Arrow shape
 */
function getArrowBoundingBox(shape: ArrowShape): BoundingBox {
    const { startPoint, endPoint, arrowSize } = shape;
    // Include arrow head size in the bounding box calculation
    const padding = arrowSize || 10;
    return createBoundingBox(
        Math.min(startPoint.x, endPoint.x) - padding,
        Math.min(startPoint.y, endPoint.y) - padding,
        Math.max(startPoint.x, endPoint.x) + padding,
        Math.max(startPoint.y, endPoint.y) + padding
    );
}

/**
 * Calculates the bounding box for a Triangle shape
 */
function getTriangleBoundingBox(shape: TriangleShape): BoundingBox {
    const { points } = shape;
    const xCoords = points.map(p => p.x);
    const yCoords = points.map(p => p.y);
    return createBoundingBox(
        Math.min(...xCoords),
        Math.min(...yCoords),
        Math.max(...xCoords),
        Math.max(...yCoords)
    );
}

/**
 * Calculates the bounding box for any single shape
 * @param shape - The shape to calculate the bounding box for
 * @returns The bounding box of the shape
 */
export function getShapeBoundingBox(shape: Shape): BoundingBox {
    switch (shape.type) {
        case ShapeType.RECTANGLE:
            return getRectangleBoundingBox(shape as RectangleShape);
        case ShapeType.CIRCLE:
            return getCircleBoundingBox(shape as CircleShape);
        case ShapeType.ELLIPSE:
            return getEllipseBoundingBox(shape as EllipseShape);
        case ShapeType.LINE:
            return getLineBoundingBox(shape as LineShape);
        case ShapeType.ARROW:
            return getArrowBoundingBox(shape as ArrowShape);
        case ShapeType.TRIANGLE:
            return getTriangleBoundingBox(shape as TriangleShape);
        default:
            // Fallback for unknown shapes - use position as origin
            const unknownShape = shape as Shape;
            return createBoundingBox(
                unknownShape.position.x,
                unknownShape.position.y,
                unknownShape.position.x + 100,
                unknownShape.position.y + 100
            );
    }
}

/**
 * Calculates a combined bounding box for multiple shapes (multi-selection)
 * @param shapes - Array of shapes to calculate the combined bounding box for
 * @returns The combined bounding box enclosing all shapes, or null if empty
 */
export function getCombinedBoundingBox(shapes: Shape[]): BoundingBox | null {
    if (shapes.length === 0) {
        return null;
    }

    if (shapes.length === 1) {
        return getShapeBoundingBox(shapes[0]);
    }

    // Get bounding boxes for all shapes
    const boundingBoxes = shapes.map(shape => getShapeBoundingBox(shape));

    // Find the extremes across all bounding boxes
    const minX = Math.min(...boundingBoxes.map(bb => bb.minX));
    const minY = Math.min(...boundingBoxes.map(bb => bb.minY));
    const maxX = Math.max(...boundingBoxes.map(bb => bb.maxX));
    const maxY = Math.max(...boundingBoxes.map(bb => bb.maxY));

    return createBoundingBox(minX, minY, maxX, maxY);
}

/**
 * Checks if a point is inside a bounding box
 * @param point - The point to check
 * @param boundingBox - The bounding box to check against
 * @param padding - Optional padding to expand the hit area
 * @returns True if the point is inside the bounding box
 */
export function isPointInBoundingBox(
    point: Position,
    boundingBox: BoundingBox,
    padding: number = 0
): boolean {
    return (
        point.x >= boundingBox.minX - padding &&
        point.x <= boundingBox.maxX + padding &&
        point.y >= boundingBox.minY - padding &&
        point.y <= boundingBox.maxY + padding
    );
}

/**
 * Checks if two bounding boxes intersect
 * @param box1 - First bounding box
 * @param box2 - Second bounding box
 * @returns True if the bounding boxes intersect
 */
export function doBoundingBoxesIntersect(box1: BoundingBox, box2: BoundingBox): boolean {
    return !(
        box1.maxX < box2.minX ||
        box1.minX > box2.maxX ||
        box1.maxY < box2.minY ||
        box1.minY > box2.maxY
    );
}

/**
 * Expands a bounding box by a given padding amount
 * @param boundingBox - The original bounding box
 * @param padding - The amount to expand by
 * @returns A new expanded bounding box
 */
export function expandBoundingBox(boundingBox: BoundingBox, padding: number): BoundingBox {
    return createBoundingBox(
        boundingBox.minX - padding,
        boundingBox.minY - padding,
        boundingBox.maxX + padding,
        boundingBox.maxY + padding
    );
}

/**
 * Gets the corner positions of a bounding box (for selection handles)
 * @param boundingBox - The bounding box
 * @returns Array of 8 handle positions (4 corners + 4 midpoints)
 */
export function getBoundingBoxHandles(boundingBox: BoundingBox): Position[] {
    const { minX, minY, maxX, maxY, centerX, centerY } = boundingBox;

    return [
        // Corners
        { x: minX, y: minY },     // Top-left
        { x: maxX, y: minY },     // Top-right
        { x: maxX, y: maxY },     // Bottom-right
        { x: minX, y: maxY },     // Bottom-left
        // Midpoints
        { x: centerX, y: minY },  // Top-center
        { x: maxX, y: centerY },  // Right-center
        { x: centerX, y: maxY },  // Bottom-center
        { x: minX, y: centerY },  // Left-center
    ];
}

/**
 * Calculates the bounding box of a shape after applying its rotation transformation.
 * This is crucial for accurate culling of rotated shapes.
 * @param shape - The shape to transform
 * @returns The AABB of the rotated shape in world coordinates
 */
export function getTransformedBoundingBox(shape: Shape): BoundingBox {
    const localBox = getShapeBoundingBox(shape);
    const rotation = shape.transform.rotation || 0;

    if (rotation === 0) {
        return localBox;
    }

    const { minX, minY, maxX, maxY, centerX, centerY } = localBox;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Rotate the 4 corners around the center
    const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
    ];

    let newMinX = Infinity, newMinY = Infinity, newMaxX = -Infinity, newMaxY = -Infinity;

    corners.forEach(p => {
        // Translate to origin (center)
        const dx = p.x - centerX;
        const dy = p.y - centerY;

        // Rotate
        const rotatedX = dx * cos - dy * sin;
        const rotatedY = dx * sin + dy * cos;

        // Translate back
        const finalX = rotatedX + centerX;
        const finalY = rotatedY + centerY;

        newMinX = Math.min(newMinX, finalX);
        newMinY = Math.min(newMinY, finalY);
        newMaxX = Math.max(newMaxX, finalX);
        newMaxY = Math.max(newMaxY, finalY);
    });

    return createBoundingBox(newMinX, newMinY, newMaxX, newMaxY);
}

export default {
    getShapeBoundingBox,
    getTransformedBoundingBox,
    getCombinedBoundingBox,
    isPointInBoundingBox,
    doBoundingBoxesIntersect,
    expandBoundingBox,
    getBoundingBoxHandles,
};
