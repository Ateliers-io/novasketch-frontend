import { describe, it, expect } from 'vitest';
import { generateLinePathData } from './SVGShapeRenderer';
import { ShapeType, LineShape, ArrowShape } from '../../types/shapes';

describe('SVGShapeRenderer - Arrow and Line Features (Three Point / Bend logic)', () => {

    const createBaseLine = (type: ShapeType) => ({
        id: '1',
        type,
        startPoint: { x: 100, y: 100 },
        endPoint: { x: 300, y: 100 },
        position: { x: 100, y: 100 },
        style: { hasFill: false, fill: '', stroke: '#000', strokeWidth: 2 },
        transform: { rotation: 0, scaleX: 1, scaleY: 1 },
        opacity: 1,
        zIndex: 0,
        visible: true,
        createdAt: '',
        updatedAt: ''
    });

    it('should generate a straight line path when no control point is provided', () => {
        const shape = createBaseLine(ShapeType.LINE) as LineShape;
        // midX = 200, midY = 100
        // startX = -100, startY = 0
        // endX = 100, endY = 0
        const pathData = generateLinePathData(shape, 200, 100);
        expect(pathData).toBe('M -100 0 L 100 0');
    });

    it('should generate a straight line path when lineType is explicitly "straight"', () => {
        const shape = {
            ...createBaseLine(ShapeType.ARROW),
            lineType: 'straight',
            controlPoint: { x: 200, y: 200 } // Should be ignored
        } as ArrowShape;

        const pathData = generateLinePathData(shape, 200, 100);
        expect(pathData).toBe('M -100 0 L 100 0');
    });

    it('should generate a stepped orthogonal path when lineType is "stepped" with a bend point', () => {
        const shape = {
            ...createBaseLine(ShapeType.LINE),
            lineType: 'stepped',
            // Moving the bend point down by 50px
            controlPoint: { x: 200, y: 150 }
        } as LineShape;

        // midX = 200, midY = 100
        // startX = -100, startY = 0, bx = 0, by = 50, endX = 100, endY = 0
        const pathData = generateLinePathData(shape, 200, 100);
        // Path should route straight to the bend point (X then Y or viceversa, according to logic)
        expect(pathData).toBe('M -100 0 L 0 0 L 0 50 L 100 50 L 100 0');
    });

    it('should generate a curved bezier path (three-point curve) by default when a control bend point is present', () => {
        const shape = {
            ...createBaseLine(ShapeType.ARROW),
            lineType: 'curved',
            // Pull the arrow bend point completely down (forming a bow shape)
            controlPoint: { x: 200, y: 200 },
            arrowAtEnd: true
        } as ArrowShape;

        // midX = 200, midY = 100
        // startX = -100, startY = 0
        // endX = 100, endY = 0
        // bx = 0, by = 100
        // Computed Quadratic bezier CP:
        // cpX = 2 * 0 - 0.5 * (-100) - 0.5 * 100 = 0
        // cpY = 2 * 100 - 0.5 * 0 - 0.5 * 0 = 200
        const pathData = generateLinePathData(shape, 200, 100);

        // This validates the quadratic math that ensures the curve physically intersects the handle
        expect(pathData).toBe('M -100 0 Q 0 200 100 0');
    });
});
