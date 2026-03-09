import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { generateLinePathData, SVGShapeRenderer } from './SVGShapeRenderer';
import { ShapeType, LineShape, ArrowShape, createRectangle } from '../../types/shapes';
import { AnchorPoint } from '../../utils/connectorUtils';

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

// --- Smart Connector anchor overlay tests ---

describe('SVGShapeRenderer - Smart Connector anchor overlays', () => {
    const rect = createRectangle(100, 100, 200, 100);
    const anchors: AnchorPoint[] = [
        { type: 'top',    position: { x: 200, y: 100 } },
        { type: 'center', position: { x: 200, y: 150 } },
        { type: 'bottom', position: { x: 200, y: 200 } },
    ];

    it('renders no anchor dots when anchorOverlays is empty', () => {
        const { container } = render(
            <SVGShapeRenderer
                shapes={[rect]}
                width={800}
                height={600}
                anchorOverlays={[]}
            />
        );
        const dots = container.querySelectorAll('.connector-anchor-dot');
        expect(dots).toHaveLength(0);
    });

    it('renders one dot per anchor in anchorOverlays', () => {
        const { container } = render(
            <SVGShapeRenderer
                shapes={[rect]}
                width={800}
                height={600}
                anchorOverlays={[{ shape: rect, anchors }]}
            />
        );
        const dots = container.querySelectorAll('.connector-anchor-dot');
        expect(dots).toHaveLength(anchors.length);
    });

    it('renders no snap ring when snapTargetAnchor is null', () => {
        const { container } = render(
            <SVGShapeRenderer
                shapes={[rect]}
                width={800}
                height={600}
                anchorOverlays={[{ shape: rect, anchors }]}
                snapTargetAnchor={null}
            />
        );
        const rings = container.querySelectorAll('.connector-snap-ring');
        expect(rings).toHaveLength(0);
    });

    it('renders snap ring for the matching shapeId + anchorType', () => {
        const { container } = render(
            <SVGShapeRenderer
                shapes={[rect]}
                width={800}
                height={600}
                anchorOverlays={[{ shape: rect, anchors }]}
                snapTargetAnchor={{ shapeId: rect.id, anchorType: 'top' }}
            />
        );
        const rings = container.querySelectorAll('.connector-snap-ring');
        expect(rings).toHaveLength(1);
    });

    it('renders snap dot (filled circle) alongside the snap ring', () => {
        const { container } = render(
            <SVGShapeRenderer
                shapes={[rect]}
                width={800}
                height={600}
                anchorOverlays={[{ shape: rect, anchors }]}
                snapTargetAnchor={{ shapeId: rect.id, anchorType: 'center' }}
            />
        );
        const snapDots = container.querySelectorAll('.connector-snap-dot');
        expect(snapDots).toHaveLength(1);
    });

    it('connector-anchors group has pointer-events:none so it does not block clicks', () => {
        const { container } = render(
            <SVGShapeRenderer
                shapes={[rect]}
                width={800}
                height={600}
                anchorOverlays={[{ shape: rect, anchors }]}
            />
        );
        const anchorsGroup = container.querySelector('.connector-anchors') as SVGGElement | null;
        expect(anchorsGroup).not.toBeNull();
        expect(anchorsGroup?.style.pointerEvents).toBe('none');
    });
});
