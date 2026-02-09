/**
 * Unit Tests for Shape Creation Functions (Task 2.1.1)
 * 
 * These tests verify that shape factory functions create valid
 * shapes with correct properties and default values.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    ShapeType,
    ToolType,
    DEFAULT_SHAPE_STYLE,
    DEFAULT_TRANSFORM,
    generateShapeId,
    getCurrentTimestamp,
    createRectangle,
    createCircle,
    createEllipse,
    RectangleShape,
    CircleShape,
    EllipseShape,
} from './shapes';

describe('ShapeType enum', () => {
    it('should have correct shape types', () => {
        expect(ShapeType.RECTANGLE).toBe('rectangle');
        expect(ShapeType.CIRCLE).toBe('circle');
        expect(ShapeType.ELLIPSE).toBe('ellipse');
        expect(ShapeType.LINE).toBe('line');
        expect(ShapeType.ARROW).toBe('arrow');
        expect(ShapeType.TRIANGLE).toBe('triangle');
    });
});

describe('ToolType enum', () => {
    it('should have correct tool types', () => {
        expect(ToolType.PEN).toBe('pen');
        expect(ToolType.ERASER).toBe('eraser');
        expect(ToolType.RECTANGLE).toBe('rectangle');
        expect(ToolType.CIRCLE).toBe('circle');
        expect(ToolType.TEXT).toBe('text');
    });
});

describe('DEFAULT_SHAPE_STYLE', () => {
    it('should have correct default values', () => {
        expect(DEFAULT_SHAPE_STYLE.fill).toBe('#3B82F6');
        expect(DEFAULT_SHAPE_STYLE.hasFill).toBe(true);
        expect(DEFAULT_SHAPE_STYLE.stroke).toBe('#1E40AF');
        expect(DEFAULT_SHAPE_STYLE.strokeWidth).toBe(2);
        expect(DEFAULT_SHAPE_STYLE.lineCap).toBe('round');
        expect(DEFAULT_SHAPE_STYLE.lineJoin).toBe('round');
    });
});

describe('DEFAULT_TRANSFORM', () => {
    it('should have correct default values', () => {
        expect(DEFAULT_TRANSFORM.rotation).toBe(0);
        expect(DEFAULT_TRANSFORM.scaleX).toBe(1);
        expect(DEFAULT_TRANSFORM.scaleY).toBe(1);
    });
});

describe('generateShapeId', () => {
    it('should generate unique IDs', () => {
        const id1 = generateShapeId();
        const id2 = generateShapeId();

        expect(id1).not.toBe(id2);
    });

    it('should start with "shape-" prefix', () => {
        const id = generateShapeId();
        expect(id.startsWith('shape-')).toBe(true);
    });

    it('should contain timestamp and random parts', () => {
        const id = generateShapeId();
        const parts = id.split('-');

        // Format: shape-{timestamp}-{random}
        expect(parts.length).toBeGreaterThanOrEqual(3);
    });
});

describe('getCurrentTimestamp', () => {
    it('should return ISO format string', () => {
        const timestamp = getCurrentTimestamp();

        // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should return current time', () => {
        const before = new Date().getTime();
        const timestamp = getCurrentTimestamp();
        const after = new Date().getTime();

        const time = new Date(timestamp).getTime();
        expect(time).toBeGreaterThanOrEqual(before);
        expect(time).toBeLessThanOrEqual(after);
    });
});

describe('createRectangle', () => {
    it('should create rectangle with correct type', () => {
        const rect = createRectangle(10, 20, 100, 50);
        expect(rect.type).toBe(ShapeType.RECTANGLE);
    });

    it('should create rectangle with correct position', () => {
        const rect = createRectangle(10, 20, 100, 50);

        expect(rect.position.x).toBe(10);
        expect(rect.position.y).toBe(20);
    });

    it('should create rectangle with correct dimensions', () => {
        const rect = createRectangle(10, 20, 100, 50);

        expect(rect.width).toBe(100);
        expect(rect.height).toBe(50);
    });

    it('should have generated ID', () => {
        const rect = createRectangle(0, 0, 10, 10);
        expect(rect.id).toBeDefined();
        expect(rect.id.startsWith('shape-')).toBe(true);
    });

    it('should have default corner radius of 0', () => {
        const rect = createRectangle(0, 0, 10, 10);
        expect(rect.cornerRadius).toBe(0);
    });

    it('should have default style applied', () => {
        const rect = createRectangle(0, 0, 10, 10);

        expect(rect.style.fill).toBe(DEFAULT_SHAPE_STYLE.fill);
        expect(rect.style.stroke).toBe(DEFAULT_SHAPE_STYLE.stroke);
        expect(rect.style.strokeWidth).toBe(DEFAULT_SHAPE_STYLE.strokeWidth);
    });

    it('should have default transform applied', () => {
        const rect = createRectangle(0, 0, 10, 10);

        expect(rect.transform.rotation).toBe(0);
        expect(rect.transform.scaleX).toBe(1);
        expect(rect.transform.scaleY).toBe(1);
    });

    it('should have default canvas properties', () => {
        const rect = createRectangle(0, 0, 10, 10);

        expect(rect.zIndex).toBe(0);
        expect(rect.opacity).toBe(1);
        expect(rect.visible).toBe(true);
    });

    it('should have created and updated timestamps', () => {
        const rect = createRectangle(0, 0, 10, 10);

        expect(rect.createdAt).toBeDefined();
        expect(rect.updatedAt).toBeDefined();
        expect(rect.createdAt).toBe(rect.updatedAt);
    });

    it('should allow overriding properties with options', () => {
        const rect = createRectangle(0, 0, 10, 10, {
            cornerRadius: 5,
            opacity: 0.5,
            zIndex: 10,
        });

        expect(rect.cornerRadius).toBe(5);
        expect(rect.opacity).toBe(0.5);
        expect(rect.zIndex).toBe(10);
    });

    it('should allow custom style in options', () => {
        const customStyle = {
            fill: '#FF0000',
            hasFill: true,
            stroke: '#00FF00',
            strokeWidth: 5,
        };
        const rect = createRectangle(0, 0, 10, 10, {
            style: customStyle,
        });

        expect(rect.style.fill).toBe('#FF0000');
        expect(rect.style.stroke).toBe('#00FF00');
        expect(rect.style.strokeWidth).toBe(5);
    });
});

describe('createCircle', () => {
    it('should create circle with correct type', () => {
        const circle = createCircle(50, 50, 25);
        expect(circle.type).toBe(ShapeType.CIRCLE);
    });

    it('should create circle with correct center position', () => {
        const circle = createCircle(100, 200, 25);

        expect(circle.position.x).toBe(100);
        expect(circle.position.y).toBe(200);
    });

    it('should create circle with correct radius', () => {
        const circle = createCircle(50, 50, 30);
        expect(circle.radius).toBe(30);
    });

    it('should have generated ID', () => {
        const circle = createCircle(0, 0, 10);
        expect(circle.id).toBeDefined();
        expect(circle.id.startsWith('shape-')).toBe(true);
    });

    it('should have default properties', () => {
        const circle = createCircle(0, 0, 10);

        expect(circle.zIndex).toBe(0);
        expect(circle.opacity).toBe(1);
        expect(circle.visible).toBe(true);
    });

    it('should allow overriding properties with options', () => {
        const circle = createCircle(0, 0, 10, {
            opacity: 0.8,
            zIndex: 5,
        });

        expect(circle.opacity).toBe(0.8);
        expect(circle.zIndex).toBe(5);
    });

    it('should handle zero radius', () => {
        const circle = createCircle(50, 50, 0);
        expect(circle.radius).toBe(0);
    });

    it('should handle large radius', () => {
        const circle = createCircle(0, 0, 1000);
        expect(circle.radius).toBe(1000);
    });
});

describe('createEllipse', () => {
    it('should create ellipse with correct type', () => {
        const ellipse = createEllipse(50, 50, 30, 20);
        expect(ellipse.type).toBe(ShapeType.ELLIPSE);
    });

    it('should create ellipse with correct center position', () => {
        const ellipse = createEllipse(100, 200, 30, 20);

        expect(ellipse.position.x).toBe(100);
        expect(ellipse.position.y).toBe(200);
    });

    it('should create ellipse with correct radii', () => {
        const ellipse = createEllipse(50, 50, 40, 25);

        expect(ellipse.radiusX).toBe(40);
        expect(ellipse.radiusY).toBe(25);
    });

    it('should have generated ID', () => {
        const ellipse = createEllipse(0, 0, 10, 10);
        expect(ellipse.id).toBeDefined();
        expect(ellipse.id.startsWith('shape-')).toBe(true);
    });

    it('should have default properties', () => {
        const ellipse = createEllipse(0, 0, 10, 10);

        expect(ellipse.zIndex).toBe(0);
        expect(ellipse.opacity).toBe(1);
        expect(ellipse.visible).toBe(true);
    });

    it('should allow overriding properties with options', () => {
        const ellipse = createEllipse(0, 0, 10, 10, {
            opacity: 0.7,
        });

        expect(ellipse.opacity).toBe(0.7);
    });

    it('should handle equal radii (effectively a circle)', () => {
        const ellipse = createEllipse(50, 50, 25, 25);

        expect(ellipse.radiusX).toBe(25);
        expect(ellipse.radiusY).toBe(25);
    });
});

describe('Shape uniqueness', () => {
    it('should create shapes with unique IDs', () => {
        const shapes = [
            createRectangle(0, 0, 10, 10),
            createCircle(0, 0, 10),
            createEllipse(0, 0, 10, 10),
            createRectangle(0, 0, 20, 20),
        ];

        const ids = shapes.map(s => s.id);
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(shapes.length);
    });
});
