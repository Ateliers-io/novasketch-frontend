/**
 * ReplayOverlay — Full-screen timeline replay UI.
 *
 * Shows a read-only canvas view with a timeline slider to scrub
 * through historical board snapshots. Supports play/pause, speed
 * control, video export (WebM), and "Apply to Live" to overwrite
 * the current board state with a historical snapshot.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TimelinePlayer } from './TimelinePlayer';
import { TimelineScrubber } from './TimelineScrubber';
import { SVGShapeRenderer } from '../SVGShapeRenderer';
import { ReplayEngine, ReplayState } from '../../../services/replayEngine';
import { getSessionHistory } from '../../../services/history.service';
import { History, Play, Pause, FastForward, Download, X, RotateCcw } from 'lucide-react';
import './ReplayOverlay.css';

interface ReplayOverlayProps {
    sessionId: string;
    onClose: () => void;
    /** Called when user clicks "Apply to Live" with the Yjs binary update */
    onApplyToLive?: (update: Uint8Array) => void;
}

const SPEEDS = [1, 2, 4];

const ReplayOverlay: React.FC<ReplayOverlayProps> = ({
    sessionId,
    onClose,
    onApplyToLive,
}) => {
    const [loading, setLoading] = useState(true);
    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [replayState, setReplayState] = useState<ReplayState | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [totalSnapshots, setTotalSnapshots] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [isRecording, setIsRecording] = useState(false);

    const engineRef = useRef<ReplayEngine | null>(null);
    const canvasAreaRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    // Initialize engine and load snapshots
    useEffect(() => {
        const engine = new ReplayEngine();
        engineRef.current = engine;

        engine.onUpdate({
            onStateChange: setReplayState,
            onIndexChange: (idx, total) => {
                setCurrentIndex(idx);
                setTotalSnapshots(total);
            },
            onPlayStateChange: (playing) => {
                setIsPlaying(playing);
                // If playback finished while recording, stop recording
                if (!playing && mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            },
        });

        (async () => {
            const loadedSnapshots = await getSessionHistory(sessionId);
            setSnapshots(loadedSnapshots);
            engine.loadSnapshots(loadedSnapshots);
            setTotalSnapshots(loadedSnapshots.length);
            setLoading(false);
        })();

        return () => {
            engine.destroy();
        };
    }, [sessionId]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // ─── Controls ───
    const handlePlayPause = useCallback(() => {
        const engine = engineRef.current;
        if (!engine) return;
        if (engine.isPlaying()) {
            engine.pause();
        } else {
            engine.play();
        }
    }, []);

    const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const engine = engineRef.current;
        if (!engine) return;
        engine.pause();
        engine.seekTo(parseInt(e.target.value, 10));
    }, []);

    const handleSpeedCycle = useCallback(() => {
        const engine = engineRef.current;
        if (!engine) return;
        const currentSpeed = engine.getSpeed();
        const nextIdx = (SPEEDS.indexOf(currentSpeed) + 1) % SPEEDS.length;
        const newSpeed = SPEEDS[nextIdx];
        engine.setSpeed(newSpeed);
        setSpeed(newSpeed);
    }, []);

    const handleApplyToLive = useCallback(() => {
        const engine = engineRef.current;
        if (!engine || !onApplyToLive) return;
        const update = engine.getCurrentUpdate();
        if (update) {
            onApplyToLive(update);
            onClose();
        }
    }, [onApplyToLive, onClose]);

    // ─── Video Export ───
    const handleExportVideo = useCallback(() => {
        const engine = engineRef.current;
        const area = canvasAreaRef.current;
        if (!engine || !area || totalSnapshots === 0) return;

        // Find the SVG element rendered inside the canvas area
        const svgEl = area.querySelector('svg');
        if (!svgEl) return;

        // Create an offscreen canvas to render SVG frames into
        const offscreen = document.createElement('canvas');
        offscreen.width = 1920;
        offscreen.height = 1080;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return;

        const stream = offscreen.captureStream(30);
        const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
        });

        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `novasketch-replay-${sessionId}.webm`;
            a.click();
            URL.revokeObjectURL(url);
            setIsRecording(false);
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);

        // Render each frame by serializing the SVG to the offscreen canvas
        engine.seekTo(0);

        const renderFrame = () => {
            const svgData = new XMLSerializer().serializeToString(svgEl);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const imgUrl = URL.createObjectURL(svgBlob);
            const img = new Image();
            img.onload = () => {
                ctx.fillStyle = replayState?.bgColor || '#0B0C10';
                ctx.fillRect(0, 0, offscreen.width, offscreen.height);
                ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
                URL.revokeObjectURL(imgUrl);
            };
            img.src = imgUrl;
        };

        // Override state change to also render to offscreen canvas
        const origOnState = engine['onStateChange'];
        engine['onStateChange'] = (state: ReplayState) => {
            setReplayState(state);
            setTimeout(renderFrame, 50);
        };

        engine.play();

        // Restore original handler when done
        const checkDone = setInterval(() => {
            if (!engine.isPlaying()) {
                engine['onStateChange'] = origOnState;
                clearInterval(checkDone);
                if (recorder.state === 'recording') {
                    setTimeout(() => recorder.stop(), 200);
                }
            }
        }, 200);
    }, [totalSnapshots, sessionId, replayState?.bgColor]);

    // ─── Timestamp formatting ───
    const formattedTimestamp = useMemo(() => {
        if (!replayState?.timestamp) return '--:--';
        const d = new Date(replayState.timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, [replayState?.timestamp]);

    // ─── Render ───
    if (loading) {
        return (
            <div className="replay-overlay">
                <div className="replay-loading">
                    <div className="replay-spinner" />
                    <span>Loading timeline history…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="replay-overlay">
            {/* Top bar */}
            <div className="replay-topbar">
                <div className="replay-topbar-title">
                    <History size={18} />
                    <span>Timeline Replay</span>
                </div>
                <div className="replay-topbar-actions">
                    {onApplyToLive && totalSnapshots > 0 && (
                        <div className="replay-apply-wrapper" title="Restores the whiteboard state to this exact moment in history, overwriting the live board.">
                            <button className="replay-btn replay-btn-primary" onClick={handleApplyToLive}>
                                <RotateCcw size={14} />
                                Apply to Live
                            </button>
                        </div>
                    )}
                    <button className="replay-btn replay-btn-danger replay-btn-close" onClick={onClose} title="Close replay">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Canvas area */}
            <div className="replay-canvas-area" ref={canvasAreaRef}>
                {totalSnapshots === 0 ? (
                    <div className="replay-empty-state">
                        <span>⏳</span>
                        <span>No timeline history available yet.</span>
                        <span style={{ fontSize: 13, opacity: 0.6 }}>Draw on the board to start recording history.</span>
                    </div>
                ) : replayState ? (
                    <TimelinePlayer state={replayState} width={1920} height={1080} />
                ) : null}
            </div>

            {/* Bottom controls */}
            {totalSnapshots > 0 && (
                <div className="replay-controls">
                    {/* Multi-track Timeline slider with thumbnails */}
                    <TimelineScrubber
                        totalSnapshots={totalSnapshots}
                        currentIndex={currentIndex}
                        snapshots={snapshots}
                        engineRef={engineRef}
                        onChange={(idx) => {
                            const engine = engineRef.current;
                            if (engine) {
                                engine.pause();
                                engine.seekTo(idx);
                            }
                        }}
                    />

                    {/* Buttons */}
                    <div className="replay-buttons" style={{ display: 'flex', alignItems: 'center', marginTop: '12px' }}>
                        {/* LEFT: Export */}
                        <div className="replay-buttons-group" style={{ flex: 1, justifyContent: 'flex-start' }}>
                            <button
                                className="replay-btn"
                                onClick={handleExportVideo}
                                disabled={isRecording}
                                title={isRecording ? 'Recording…' : 'Export as video'}
                            >
                                <Download size={14} />
                                {isRecording ? 'Recording…' : 'Export Video'}
                            </button>
                        </div>

                        {/* CENTER: Play Controls & Counter */}
                        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div className="replay-buttons-group" style={{ justifyContent: 'center' }}>
                                <button
                                    className="replay-btn replay-btn-play"
                                    onClick={handlePlayPause}
                                    title={isPlaying ? 'Pause' : 'Play'}
                                >
                                    {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
                                </button>
                                <button className="replay-btn replay-btn-icon" onClick={handleSpeedCycle} title={`Speed: ${speed}x`}>
                                    <FastForward size={16} />
                                </button>
                                <span className="replay-speed-badge">{speed}x</span>
                            </div>
                            <div className="replay-counter" style={{ fontSize: '11px', color: '#8b9dad', width: 'auto', textAlign: 'center' }}>
                                Frame {currentIndex + 1} of {totalSnapshots} &nbsp;&bull;&nbsp; {formattedTimestamp}
                            </div>
                        </div>

                        {/* RIGHT: Empty to balance the center */}
                        <div className="replay-buttons-group" style={{ flex: 1, justifyContent: 'flex-end' }}>
                            {/* Intentionally left blank for symmetry */}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReplayOverlay;
