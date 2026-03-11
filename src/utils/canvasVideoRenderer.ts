/**
 * Canvas 2D frame renderer for video export.
 *
 * Renders a ReplayState directly onto a CanvasRenderingContext2D
 * instead of serialising the DOM SVG (which breaks due to
 * cross-origin image taint and missing external CSS).
 */

import type { ReplayState } from '../services/replayEngine';

/** Same auto-fit logic used by TimelinePlayer.computeFitTransform */
function computeFitTransform(
    shapes: any[], lines: any[], textAnnotations: any[],
    viewW: number, viewH: number,
): { x: number; y: number; scale: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasContent = false;

    for (const s of shapes) {
        const x = s.position?.x ?? 0;
        const y = s.position?.y ?? 0;
        const w = Math.abs(s.width ?? (s.radius != null ? s.radius * 2 : null) ?? (s.radiusX != null ? s.radiusX * 2 : 0));
        const h = Math.abs(s.height ?? (s.radius != null ? s.radius * 2 : null) ?? (s.radiusY != null ? s.radiusY * 2 : 0));
        minX = Math.min(minX, x - w / 2); minY = Math.min(minY, y - h / 2);
        maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
        hasContent = true;
    }
    for (const l of lines) {
        const pts = l.points ?? [];
        for (let i = 0; i < pts.length; i += 2) {
            const px = pts[i] ?? 0;
            const py = pts[i + 1] ?? 0;
            minX = Math.min(minX, px); minY = Math.min(minY, py);
            maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
            hasContent = true;
        }
    }
    for (const t of textAnnotations) {
        const tx = t.position?.x ?? t.x ?? 0;
        const ty = t.position?.y ?? t.y ?? 0;
        minX = Math.min(minX, tx); minY = Math.min(minY, ty);
        maxX = Math.max(maxX, tx + 200); maxY = Math.max(maxY, ty + 50);
        hasContent = true;
    }

    if (!hasContent) return { x: 0, y: 0, scale: 1 };

    const PADDING = 80;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const scale = Math.min(
        (viewW - PADDING * 2) / Math.max(contentW, 1),
        (viewH - PADDING * 2) / Math.max(contentH, 1),
        1,
    );
    return {
        x: (viewW - contentW * scale) / 2 - minX * scale,
        y: (viewH - contentH * scale) / 2 - minY * scale,
        scale,
    };
}

// ---- Individual shape painters ----

function setStrokeDash(ctx: CanvasRenderingContext2D, dashArray?: number[]) {
    ctx.setLineDash(dashArray && dashArray.length > 0 ? dashArray : []);
}

function drawRectangle(ctx: CanvasRenderingContext2D, s: any) {
    const { position, style, transform, width, height, cornerRadius = 0 } = s;
    const sx = transform?.scaleX ?? 1;
    const sy = transform?.scaleY ?? 1;
    const cx = position.x + (width / 2) * sx;
    const cy = position.y + (height / 2) * sy;

    ctx.save();
    ctx.globalAlpha = s.opacity ?? 1;
    ctx.translate(cx, cy);
    ctx.rotate(((transform?.rotation ?? 0) * Math.PI) / 180);
    ctx.scale(sx, sy);

    const w = width;
    const h = height;
    const r = Math.min(cornerRadius, w / 2, h / 2);

    ctx.beginPath();
    if (r > 0) {
        ctx.moveTo(-w / 2 + r, -h / 2);
        ctx.lineTo(w / 2 - r, -h / 2);
        ctx.arcTo(w / 2, -h / 2, w / 2, -h / 2 + r, r);
        ctx.lineTo(w / 2, h / 2 - r);
        ctx.arcTo(w / 2, h / 2, w / 2 - r, h / 2, r);
        ctx.lineTo(-w / 2 + r, h / 2);
        ctx.arcTo(-w / 2, h / 2, -w / 2, h / 2 - r, r);
        ctx.lineTo(-w / 2, -h / 2 + r);
        ctx.arcTo(-w / 2, -h / 2, -w / 2 + r, -h / 2, r);
    } else {
        ctx.rect(-w / 2, -h / 2, w, h);
    }
    ctx.closePath();

    if (style.hasFill) { ctx.fillStyle = style.fill; ctx.fill(); }
    setStrokeDash(ctx, style.strokeDashArray);
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth;
    ctx.stroke();
    ctx.restore();
}

function drawCircle(ctx: CanvasRenderingContext2D, s: any) {
    const { position, style, transform, radius } = s;
    ctx.save();
    ctx.globalAlpha = s.opacity ?? 1;
    ctx.translate(position.x, position.y);
    ctx.rotate(((transform?.rotation ?? 0) * Math.PI) / 180);
    ctx.scale(transform?.scaleX ?? 1, transform?.scaleY ?? 1);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);

    if (style.hasFill) { ctx.fillStyle = style.fill; ctx.fill(); }
    setStrokeDash(ctx, style.strokeDashArray);
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth;
    ctx.stroke();
    ctx.restore();
}

function drawEllipse(ctx: CanvasRenderingContext2D, s: any) {
    const { position, style, transform, radiusX, radiusY } = s;
    ctx.save();
    ctx.globalAlpha = s.opacity ?? 1;
    ctx.translate(position.x, position.y);
    ctx.rotate(((transform?.rotation ?? 0) * Math.PI) / 180);
    ctx.scale(transform?.scaleX ?? 1, transform?.scaleY ?? 1);

    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);

    if (style.hasFill) { ctx.fillStyle = style.fill; ctx.fill(); }
    setStrokeDash(ctx, style.strokeDashArray);
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth;
    ctx.stroke();
    ctx.restore();
}

function drawTriangle(ctx: CanvasRenderingContext2D, s: any) {
    const { style, transform, points } = s;
    if (!points || points.length < 3) return;

    const xs = points.map((p: any) => p.x);
    const ys = points.map((p: any) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

    ctx.save();
    ctx.globalAlpha = s.opacity ?? 1;
    ctx.translate(cx, cy);
    ctx.rotate(((transform?.rotation ?? 0) * Math.PI) / 180);
    ctx.scale(transform?.scaleX ?? 1, transform?.scaleY ?? 1);

    ctx.beginPath();
    ctx.moveTo(points[0].x - cx, points[0].y - cy);
    ctx.lineTo(points[1].x - cx, points[1].y - cy);
    ctx.lineTo(points[2].x - cx, points[2].y - cy);
    ctx.closePath();

    if (style.hasFill) { ctx.fillStyle = style.fill; ctx.fill(); }
    setStrokeDash(ctx, style.strokeDashArray);
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth;
    ctx.stroke();
    ctx.restore();
}

function drawLineOrArrow(ctx: CanvasRenderingContext2D, s: any) {
    const { style, transform, startPoint, endPoint, controlPoint, lineType } = s;
    if (!startPoint || !endPoint) return;

    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const midX = startPoint.x + dx / 2;
    const midY = startPoint.y + dy / 2;

    ctx.save();
    ctx.globalAlpha = s.opacity ?? 1;
    ctx.translate(midX, midY);
    ctx.rotate(((transform?.rotation ?? 0) * Math.PI) / 180);

    const sX = -dx / 2, sY = -dy / 2;
    const eX = dx / 2, eY = dy / 2;

    ctx.beginPath();

    const type = lineType || 'curved';
    if (type === 'straight' || !controlPoint) {
        ctx.moveTo(sX, sY);
        ctx.lineTo(eX, eY);
    } else if (type === 'stepped') {
        const bx = controlPoint.x - midX;
        const by = controlPoint.y - midY;
        ctx.moveTo(sX, sY);
        ctx.lineTo(bx, sY);
        ctx.lineTo(bx, by);
        ctx.lineTo(eX, by);
        ctx.lineTo(eX, eY);
    } else {
        // curved — quadratic bezier adjusted to pass through control point
        const bx = controlPoint.x - midX;
        const by = controlPoint.y - midY;
        const cpX = 2 * bx - 0.5 * sX - 0.5 * eX;
        const cpY = 2 * by - 0.5 * sY - 0.5 * eY;
        ctx.moveTo(sX, sY);
        ctx.quadraticCurveTo(cpX, cpY, eX, eY);
    }

    setStrokeDash(ctx, style.strokeDashArray);
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arrowheads
    const drawArrowhead = (tipX: number, tipY: number, angle: number) => {
        const size = s.arrowSize || 10;
        ctx.save();
        ctx.translate(tipX, tipY);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, -size * 0.35);
        ctx.lineTo(-size, size * 0.35);
        ctx.closePath();
        ctx.fillStyle = style.stroke;
        ctx.fill();
        ctx.restore();
    };

    if (s.arrowAtEnd) {
        let angle: number;
        if (type !== 'straight' && controlPoint && type !== 'stepped') {
            const bx = controlPoint.x - midX;
            const by = controlPoint.y - midY;
            const cpX = 2 * bx - 0.5 * sX - 0.5 * eX;
            const cpY = 2 * by - 0.5 * sY - 0.5 * eY;
            // tangent at t=1 for quadratic: 2*(P2-CP)
            angle = Math.atan2(eY - cpY, eX - cpX);
        } else {
            angle = Math.atan2(eY - sY, eX - sX);
        }
        drawArrowhead(eX, eY, angle);
    }
    if (s.arrowAtStart) {
        let angle: number;
        if (type !== 'straight' && controlPoint && type !== 'stepped') {
            const bx = controlPoint.x - midX;
            const by = controlPoint.y - midY;
            const cpX = 2 * bx - 0.5 * sX - 0.5 * eX;
            const cpY = 2 * by - 0.5 * sY - 0.5 * eY;
            angle = Math.atan2(sY - cpY, sX - cpX);
        } else {
            angle = Math.atan2(sY - eY, sX - eX);
        }
        drawArrowhead(sX, sY, angle);
    }

    ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, s: any) {
    const { position, style, transform, width, height, backgroundVisible, name } = s;
    const sx = transform?.scaleX ?? 1;
    const sy = transform?.scaleY ?? 1;
    const cx = position.x + (width / 2) * sx;
    const cy = position.y + (height / 2) * sy;

    ctx.save();
    ctx.globalAlpha = s.opacity ?? 1;
    ctx.translate(cx, cy);
    ctx.rotate(((transform?.rotation ?? 0) * Math.PI) / 180);
    ctx.scale(sx, sy);

    if (backgroundVisible) {
        ctx.setLineDash([5, 5]);
        ctx.fillStyle = style.fill;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.strokeWidth;
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        ctx.setLineDash([]);
    }

    // Label
    ctx.fillStyle = style.stroke;
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.fillText(name || 'FRAME', -width / 2 + 5, -height / 2 - 4);

    ctx.restore();
}

function drawImage(ctx: CanvasRenderingContext2D, s: any, imageCache: Map<string, HTMLImageElement>) {
    const { position, transform, width, height, src } = s;
    if (!src) return;

    const cached = imageCache.get(src);
    if (!cached) return; // image not yet loaded — skip

    const sx = transform?.scaleX ?? 1;
    const sy = transform?.scaleY ?? 1;
    const cx = position.x + (width / 2) * sx;
    const cy = position.y + (height / 2) * sy;

    ctx.save();
    ctx.globalAlpha = s.opacity ?? 1;
    ctx.translate(cx, cy);
    ctx.rotate(((transform?.rotation ?? 0) * Math.PI) / 180);
    ctx.scale(sx, sy);
    ctx.drawImage(cached, -width / 2, -height / 2, width, height);
    ctx.restore();
}

function drawFreehandLine(ctx: CanvasRenderingContext2D, line: any) {
    const pts = line.points;
    if (!pts || pts.length < 4) return;

    ctx.save();
    ctx.globalAlpha = line.opacity ?? 1;
    ctx.strokeStyle = line.color || '#ffffff';
    ctx.lineWidth = line.strokeWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) {
        ctx.lineTo(pts[i], pts[i + 1]);
    }
    ctx.stroke();
    ctx.restore();
}

function drawTextAnnotation(ctx: CanvasRenderingContext2D, t: any) {
    const x = t.position?.x ?? t.x ?? 0;
    const y = t.position?.y ?? t.y ?? 0;

    ctx.save();
    ctx.globalAlpha = t.opacity ?? 1;

    if (t.rotation) {
        ctx.translate(x, y);
        ctx.rotate((t.rotation * Math.PI) / 180);
        ctx.translate(-x, -y);
    }

    const weight = t.fontWeight || 'normal';
    const style = t.fontStyle || 'normal';
    const size = t.fontSize || 18;
    const family = t.fontFamily || 'Arial';
    ctx.font = `${style} ${weight} ${size}px ${family}`;
    ctx.fillStyle = t.color || '#ffffff';

    const align = t.textAlign || 'left';
    ctx.textAlign = align as CanvasTextAlign;
    ctx.textBaseline = 'top';

    if (t.textDecoration === 'underline') {
        const metrics = ctx.measureText(t.text || '');
        const ux = align === 'center' ? x - metrics.width / 2
            : align === 'right' ? x - metrics.width
                : x;
        ctx.fillRect(ux, y + size + 1, metrics.width, 1);
    }

    ctx.fillText(t.text || '', x, y);
    ctx.restore();
}

// ---- Public API ----

/**
 * Pre-load all image shapes' src URLs so they're ready when we draw.
 * Returns a Map<src, HTMLImageElement>.
 */
export async function preloadImages(states: ReplayState[]): Promise<Map<string, HTMLImageElement>> {
    const urls = new Set<string>();
    for (const st of states) {
        for (const s of st.shapes) {
            if ((s as any).type === 'image' && (s as any).src) {
                urls.add((s as any).src);
            }
        }
    }

    const cache = new Map<string, HTMLImageElement>();
    const promises = Array.from(urls).map(async (src) => {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = src;
            await img.decode();
            cache.set(src, img);
        } catch {
            // skip broken images
        }
    });
    await Promise.all(promises);
    return cache;
}

/**
 * Render one ReplayState frame onto a Canvas 2D context.
 * This is a pure-canvas painter — no DOM/SVG involved.
 */
export function renderFrameToCanvas(
    ctx: CanvasRenderingContext2D,
    state: ReplayState,
    width: number,
    height: number,
    imageCache: Map<string, HTMLImageElement>,
) {
    // Background
    ctx.fillStyle = state.bgColor || '#0B0C10';
    ctx.fillRect(0, 0, width, height);

    const { shapes, lines, textAnnotations } = state;
    const transform = computeFitTransform(shapes, lines, textAnnotations, width, height);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // 1. Freehand lines
    for (const line of lines) {
        drawFreehandLine(ctx, line);
    }

    // 2. Shapes (sorted by zIndex)
    const sorted = [...shapes].sort((a: any, b: any) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    for (const s of sorted) {
        if (s.visible === false) continue;
        const type = (s as any).type;
        switch (type) {
            case 'rectangle': drawRectangle(ctx, s); break;
            case 'circle': drawCircle(ctx, s); break;
            case 'ellipse': drawEllipse(ctx, s); break;
            case 'line': drawLineOrArrow(ctx, s); break;
            case 'arrow': drawLineOrArrow(ctx, s); break;
            case 'triangle': drawTriangle(ctx, s); break;
            case 'frame': drawFrame(ctx, s); break;
            case 'image': drawImage(ctx, s, imageCache); break;
        }
    }

    // 3. Text annotations
    for (const t of textAnnotations) {
        drawTextAnnotation(ctx, t);
    }

    ctx.restore();
}
