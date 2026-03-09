import React, { useState, useMemo, useCallback, useEffect } from 'react';
import SVGShapeRenderer from '../SVGShapeRenderer';

interface TimelineScrubberProps {
    totalSnapshots: number;
    currentIndex: number;
    snapshots: any[];
    engineRef: any; // We use the engine to decode state on hover
    onChange: (index: number) => void;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
    totalSnapshots,
    currentIndex,
    snapshots,
    engineRef,
    onChange
}) => {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [hoverState, setHoverState] = useState<any | null>(null);

    const TUMBNAIL_COUNT = 8; // Number of thumbnails to show across the track
    const thumbnailIndices = useMemo(() => {
        if (totalSnapshots <= 0) return [];
        if (totalSnapshots === 1) return [0, 0, 0, 0, 0, 0, 0, 0]; // Fill track if only 1 frame
        const indices = [];
        for (let i = 0; i < TUMBNAIL_COUNT; i++) {
            const fraction = i / (TUMBNAIL_COUNT - 1);
            indices.push(Math.floor(fraction * (totalSnapshots - 1)));
        }
        return indices;
    }, [totalSnapshots, TUMBNAIL_COUNT]);

    const [thumbnailStates, setThumbnailStates] = useState<any[]>([]);
    useEffect(() => {
        if (totalSnapshots === 0 || !engineRef.current) return;
        try {
            const states = thumbnailIndices.map(idx => (engineRef.current as any).decodeSnapshot(snapshots[idx]));
            setThumbnailStates(states);
        } catch (e) {
            console.error("Failed to decode thumbnails", e);
        }
    }, [thumbnailIndices, snapshots, engineRef]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (totalSnapshots === 0 || !engineRef.current) return;

        const rect = e.currentTarget.getBoundingClientRect();
        // The track has 9px padding on each side for the thumb, so we calculate bounds based on the active area
        const padding = 9;
        const activeWidth = rect.width - padding * 2;
        let x = e.clientX - rect.left - padding;

        // Clamp x
        if (x < 0) x = 0;
        if (x > activeWidth) x = activeWidth;

        const fraction = x / activeWidth;
        const index = Math.round(fraction * (totalSnapshots - 1));

        if (index !== hoverIndex) {
            setHoverIndex(index);

            // Note: Timeline engine might not expose decodeSnapshot publicly.
            // But we can peek into the snapshot list and decode it ourselves here, 
            // or modify engine to expose 'peek(index)'. 
            // We use engine.decodeSnapshot internally (cast to any or use public getter)
            try {
                const state = (engineRef.current as any).decodeSnapshot(snapshots[index]);
                setHoverState(state);
            } catch (err) {
                console.error("Failed to generate preview for timeline", err);
            }
        }
    }, [totalSnapshots, hoverIndex, snapshots, engineRef]);

    const handleMouseLeave = () => {
        setHoverIndex(null);
        setHoverState(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(parseInt(e.target.value, 10));
    };

    return (
        <div className="replay-timeline-container" style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>

            {/* Timestamps row - spaced perfectly above the track */}
            <div className="replay-timeline-timestamps" style={{ position: 'relative', height: '26px', margin: '0 9px' }}>
                {thumbnailStates.length > 0 && Array.from({ length: 5 }).map((_, i) => {
                    const fraction = i / 4;
                    const snapIdx = Math.floor(fraction * (snapshots.length - 1));
                    const snapshot = snapshots[snapIdx];
                    if (!snapshot) return null;
                    const date = new Date(snapshot.timestamp);
                    const isFirst = i === 0;
                    const isLast = i === 4;

                    return (
                        <div key={i} style={{
                            position: 'absolute',
                            left: `${fraction * 100}%`,
                            transform: isFirst ? 'none' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isFirst ? 'flex-start' : isLast ? 'flex-end' : 'center',
                        }}>
                            <span style={{
                                fontSize: '11px',
                                color: '#a0a0a0',
                                fontWeight: 600,
                                marginBottom: '2px',
                                letterSpacing: '0.02em'
                            }}>
                                {date.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                            </span>
                            {/* Vertical Tick Mark */}
                            <div style={{
                                width: '1px',
                                height: '6px',
                                background: '#66FCF1',
                                opacity: 0.6
                            }} />
                        </div>
                    );
                })}
            </div>

            {/* Popover Preview for onHover */}
            {hoverIndex !== null && hoverState && (
                <div
                    className="timeline-hover-preview"
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: `calc(9px + ${(totalSnapshots > 1 ? hoverIndex / (totalSnapshots - 1) : 0) * 100}% * calc(100% - 18px) / 100)`,
                        transform: 'translateX(-50%)',
                        marginBottom: '10px',
                        background: '#1e2029',
                        border: '1px solid #3b3d4f',
                        borderRadius: '6px',
                        padding: '4px',
                        pointerEvents: 'none',
                        zIndex: 100,
                        boxShadow: '0 -4px 15px rgba(0,0,0,0.6)'
                    }}
                >
                    <div style={{
                        width: '160px',
                        height: '90px',
                        background: hoverState.bgColor || '#0B0C10',
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: '4px'
                    }}>
                        <div style={{ transform: 'scale(0.08333)', transformOrigin: 'top left', width: 1920, height: 1080 }}>
                            <SVGShapeRenderer
                                shapes={hoverState.shapes}
                                lines={hoverState.lines}
                                textAnnotations={hoverState.textAnnotations}
                                width={1920}
                                height={1080}
                            />
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#ccc', marginTop: '4px' }}>
                        {new Date(hoverState.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                    </div>
                </div>
            )}

            <div
                className="replay-timeline-track-area"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                    position: 'relative',
                    height: '70px',
                    width: '100%',
                    background: '#0B0C10',
                    borderRadius: '6px',
                    border: '1px solid rgba(102, 252, 241, 0.2)',
                    overflow: 'hidden',
                    display: 'flex',
                    cursor: 'pointer'
                }}
            >
                {/* Visual Thumbnails rendering inside the track */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', opacity: 0.85 }}>
                    {thumbnailStates.map((state, i) => (
                        <div key={i} style={{
                            flex: 1,
                            height: '100%',
                            borderRight: i < thumbnailStates.length - 1 ? '1px solid rgba(102, 252, 241, 0.2)' : 'none',
                            position: 'relative',
                            overflow: 'hidden',
                            background: state.bgColor || '#0B0C10',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <div style={{ width: 1920, height: 1080, position: 'absolute', transform: 'scale(0.065)', transformOrigin: 'center' }}>
                                <SVGShapeRenderer
                                    shapes={state.shapes}
                                    lines={state.lines}
                                    textAnnotations={state.textAnnotations}
                                    width={1920}
                                    height={1080}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <input
                    type="range"
                    className="replay-slider replay-slider-enhanced"
                    min={0}
                    max={Math.max(0, totalSnapshots - 1)}
                    value={currentIndex}
                    onChange={handleChange}
                />

                <div
                    className="replay-playhead"
                    style={{ left: `calc(9px + ${totalSnapshots > 1 ? (currentIndex / (totalSnapshots - 1)) * 100 : 0}% * calc(100% - 18px) / 100)` }}
                />
            </div>
        </div>
    );
};
