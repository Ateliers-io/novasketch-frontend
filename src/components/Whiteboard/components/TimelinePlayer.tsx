import React, { useRef, useState, useEffect, useMemo } from 'react';
import SVGShapeRenderer from '../SVGShapeRenderer';
import RemoteCursors from './RemoteCursors';
import Toolbar from '../../Toolbar/Toolbar';
import { ToolType, BrushType, StrokeStyle } from '../../../types/shapes';
import { DEFAULT_GRID_CONFIG } from '../../../types/grid';

/**
 * Computes a viewport transform so all content (shapes, lines, annotations)
 * fits within the fixed export canvas regardless of where on the board it was drawn.
 */
function computeFitTransform(
    shapes: any[], lines: any[], textAnnotations: any[],
    viewW: number, viewH: number
): { x: number; y: number; scale: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasContent = false;

    for (const s of shapes) {
        const x = s.position?.x ?? 0;
        const y = s.position?.y ?? 0;
        const w = Math.abs(s.width ?? 0);
        const h = Math.abs(s.height ?? 0);
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
        hasContent = true;
    }
    for (const l of lines) {
        for (const p of (l.points ?? [])) {
            const px = p.x ?? p[0] ?? 0;
            const py = p.y ?? p[1] ?? 0;
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
        1
    );
    return {
        x: (viewW - contentW * scale) / 2 - minX * scale,
        y: (viewH - contentH * scale) / 2 - minY * scale,
        scale,
    };
}

interface TimelinePlayerProps {
    state: any;
    width?: number;
    height?: number;
}

export const TimelinePlayer: React.FC<TimelinePlayerProps> = ({ state, width = 1920, height = 1080 }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.5);

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                const { width: cw, height: ch } = entries[0].contentRect;
                // Allow a slight internal margin (e.g. 0.98) so shadow isn't abruptly cut off by parent bounds
                const scaleX = cw / width;
                const scaleY = ch / height;
                setScale(Math.min(scaleX, scaleY) * 0.98);
            }
        });
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [width, height]);

    const fitTransform = useMemo(
        () => computeFitTransform(state?.shapes ?? [], state?.lines ?? [], state?.textAnnotations ?? [], width, height),
        [state?.shapes, state?.lines, state?.textAnnotations, width, height]
    );

    if (!state) return null;

    // Transform raw awareness states into the format expected by RemoteCursors
    // Yjs awareness state format: { user: { name, color }, cursor: { x, y } }
    const users = state.awareness.map((a: any) => ({
        name: a.user?.name || 'Anonymous',
        color: a.user?.color || '#ccc',
        cursor: a.cursor
    }));

    return (
        <div ref={containerRef} className="timeline-replay-frame" style={{
            width: '100%',
            height: '100%', // Take up max allotted vertical/horizontal space from flex parent
            maxWidth: '1800px', // Allow extreme sizing up to almost native 1080p width
            margin: '0 auto',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent'
        }}>
            {/* Outline the canvas to make it pop inside the frame */}
            <div className="condensed-workspace" style={{
                position: 'relative',
                width: `${width}px`,
                height: `${height}px`,
                transform: `scale(${scale})`, // Dynamic scale computation!
                transformOrigin: 'center center',
                background: state.bgColor || '#0B0C10',
                boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                borderRadius: '12px',
                overflow: 'hidden'
            }}>
                <div style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 }}>
                    <Toolbar
                        activeTool={ToolType.PEN}
                        onToolChange={() => { }}
                        isToolLocked={false}
                        onToolLockChange={() => { }}
                        brushSize={5}
                        onBrushSizeChange={() => { }}
                        strokeColor="#66FCF1"
                        onColorChange={() => { }}
                        fillColor="transparent"
                        onFillColorChange={() => { }}
                        brushType={BrushType.BRUSH}
                        onBrushTypeChange={() => { }}
                        strokeStyle="solid"
                        onStrokeStyleChange={() => { }}
                        fontFamily="Arial"
                        onFontFamilyChange={() => { }}
                        fontSize={18}
                        onFontSizeChange={() => { }}
                        isBold={false}
                        onBoldChange={() => { }}
                        isItalic={false}
                        onItalicChange={() => { }}
                        isUnderline={false}
                        onUnderlineChange={() => { }}
                        textAlign="left"
                        onTextAlignChange={() => { }}
                        isTextSelected={false}
                        eraserMode="stroke"
                        onEraserModeChange={() => { }}
                        eraserSize={20}
                        onEraserSizeChange={() => { }}
                        hasSelection={false}
                        onBringForward={() => { }}
                        onSendBackward={() => { }}
                        gridConfig={DEFAULT_GRID_CONFIG}
                        onGridConfigChange={() => { }}
                        isSessionLocked={true}
                    />
                </div>

                <SVGShapeRenderer
                    shapes={state.shapes}
                    lines={state.lines}
                    textAnnotations={state.textAnnotations}
                    width={width}
                    height={height}
                    transform={fitTransform}
                />

                {/* Render the cursors on top of the shapes */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    <RemoteCursors
                        users={users}
                        stagePos={{ x: 0, y: 0 }}
                        stageScale={1}
                    />
                </div>
            </div>
        </div>
    );
};
