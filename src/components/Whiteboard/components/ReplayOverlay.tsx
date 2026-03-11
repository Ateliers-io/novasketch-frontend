/**
 * ReplayOverlay: Full-screen timeline replay UI.
 *
 * Shows a read-only canvas view with a timeline slider to scrub
 * through historical board snapshots. Supports play/pause, speed
 * control, video export (WebM), and "Apply to Live" to overwrite
 * the current board state with a historical snapshot.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TimelinePlayer } from './TimelinePlayer';
import { TimelineScrubber } from './TimelineScrubber';
import { ReplayEngine, ReplayState } from '../../../services/replayEngine';
import { getSessionHistory } from '../../../services/history.service';
import { preloadImages, renderFrameToCanvas } from '../../../utils/canvasVideoRenderer';
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
    const [error, setError] = useState<string | null>(null);
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
            try {
                const loadedSnapshots = await getSessionHistory(sessionId);
                setSnapshots(loadedSnapshots);
                engine.loadSnapshots(loadedSnapshots);
                setTotalSnapshots(loadedSnapshots.length);
            } catch (err: any) {
                console.error('[ReplayOverlay] Failed to load history:', err);
                setError(err?.response?.data?.error || err?.message || 'Failed to load timeline history');
            } finally {
                setLoading(false);
            }
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

    // --- Controls ---
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

    // --- Video Export ---
    const handleExportVideo = useCallback(async () => {
        const engine = engineRef.current;
        if (!engine || totalSnapshots === 0) return;

        setIsRecording(true);

        // Collect all snapshot states for image pre-loading
        const allStates: ReplayState[] = [];
        for (let i = 0; i < totalSnapshots; i++) {
            const s = engine.seekTo(i);
            if (s) allStates.push(s);
        }
        // Reset view back to first frame
        const firstState = allStates[0];
        setReplayState(firstState);
        setCurrentIndex(0);

        // Pre-load images used by any snapshot
        const imageCache = await preloadImages(allStates);

        // Offscreen canvas — pure Canvas 2D, no DOM/SVG involved
        const offscreen = document.createElement('canvas');
        offscreen.width = 1920;
        offscreen.height = 1080;
        const ctx = offscreen.getContext('2d');
        if (!ctx) { setIsRecording(false); return; }

        // Render first frame so recorder starts with real content
        renderFrameToCanvas(ctx, firstState, 1920, 1080, imageCache);

        const stream = offscreen.captureStream(30);

        // Try MP4 first, fall back to WebM
        let mimeType = 'video/webm;codecs=vp9';
        let extension = 'webm';
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
            extension = 'mp4';
        }

        const recorder = new MediaRecorder(stream, { mimeType });

        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `novasketch-replay-${sessionId}.${extension}`;
            a.click();
            URL.revokeObjectURL(url);
            setIsRecording(false);
        };

        mediaRecorderRef.current = recorder;
        recorder.start();

        // Hold first frame so recorder captures it
        await new Promise(r => setTimeout(r, 500));

        // Render remaining snapshots directly to canvas
        for (let i = 1; i < allStates.length; i++) {
            const state = allStates[i];
            renderFrameToCanvas(ctx, state, 1920, 1080, imageCache);
            setReplayState(state);
            setCurrentIndex(i);

            // Hold frame for captureStream (~15 frames at 30fps = 500ms)
            await new Promise(r => setTimeout(r, 500));
        }

        // Allow final frame to be fully captured before stopping
        await new Promise(r => setTimeout(r, 500));
        if (recorder.state === 'recording') {
            recorder.stop();
        }
    }, [totalSnapshots, sessionId]);

    // --- Timestamp formatting ---
    const replayTimestamp = replayState?.timestamp;
    const formattedTimestamp = useMemo(() => {
        if (!replayTimestamp) return '--:--';
        const d = new Date(replayTimestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, [replayTimestamp]);

    // --- Render ---
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
                {error ? (
                    <div className="replay-empty-state">
                        <span>⚠️</span>
                        <span>Failed to load timeline history</span>
                        <span style={{ fontSize: 13, opacity: 0.6 }}>{error}</span>
                        <button
                            className="replay-btn replay-btn-primary"
                            style={{ marginTop: 12 }}
                            onClick={() => {
                                setError(null);
                                setLoading(true);
                                const engine = engineRef.current;
                                if (engine) {
                                    getSessionHistory(sessionId)
                                        .then(loaded => {
                                            setSnapshots(loaded);
                                            engine.loadSnapshots(loaded);
                                            setTotalSnapshots(loaded.length);
                                        })
                                        .catch((err: any) => {
                                            setError(err?.response?.data?.error || err?.message || 'Failed to load timeline history');
                                        })
                                        .finally(() => setLoading(false));
                                }
                            }}
                        >
                            Retry
                        </button>
                    </div>
                ) : totalSnapshots === 0 ? (
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
