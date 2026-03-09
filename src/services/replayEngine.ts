/**
 * Replay Engine — Core timeline replay logic.
 *
 * Creates a "shadow" Y.Doc separate from the live document.
 * Given an array of historical snapshots, it can seek to any
 * point in time and extract the board state at that moment.
 *
 * Each snapshot is a full Yjs state update (Y.encodeStateAsUpdate)
 * so seeking is done by applying the snapshot at the target index
 * onto a fresh Y.Doc.
 */

import * as Y from 'yjs';
import type { HistorySnapshot } from './history.service';

export interface ReplayState {
    lines: any[];
    shapes: any[];
    textAnnotations: any[];
    awareness: any[];
    bgColor: string;
    timestamp: string;
}

export class ReplayEngine {
    private snapshots: HistorySnapshot[] = [];
    private currentIndex = 0;
    private playTimer: ReturnType<typeof setInterval> | null = null;
    private speed = 1; // 1x, 2x, 4x
    private onStateChange: ((state: ReplayState) => void) | null = null;
    private onIndexChange: ((index: number, total: number) => void) | null = null;
    private onPlayStateChange: ((playing: boolean) => void) | null = null;

    /**
     * Load snapshots fetched from the history API.
     */
    loadSnapshots(snapshots: HistorySnapshot[]): void {
        this.snapshots = snapshots;
        this.currentIndex = 0;
        if (snapshots.length > 0) {
            this.seekTo(0);
        }
    }

    /**
     * Register callbacks for state changes during playback.
     */
    onUpdate(handlers: {
        onStateChange: (state: ReplayState) => void;
        onIndexChange: (index: number, total: number) => void;
        onPlayStateChange: (playing: boolean) => void;
    }): void {
        this.onStateChange = handlers.onStateChange;
        this.onIndexChange = handlers.onIndexChange;
        this.onPlayStateChange = handlers.onPlayStateChange;
    }

    /**
     * Seek to a specific snapshot index.
     * Creates a fresh shadow Y.Doc and applies the snapshot at that index.
     */
    seekTo(index: number): ReplayState | null {
        if (index < 0 || index >= this.snapshots.length) return null;
        this.currentIndex = index;

        const snapshot = this.snapshots[index];
        const state = this.decodeSnapshot(snapshot);

        this.onStateChange?.(state);
        this.onIndexChange?.(index, this.snapshots.length);

        return state;
    }

    /**
     * Decode a single snapshot into board state using a temporary Y.Doc.
     */
    private decodeSnapshot(snapshot: HistorySnapshot): ReplayState {
        const doc = new Y.Doc();
        const binaryStr = atob(snapshot.update);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        Y.applyUpdate(doc, bytes);

        const lines = doc.getArray('lines').toArray();
        const shapes = doc.getArray('shapes').toArray();
        const textAnnotations = doc.getArray('texts').toArray();
        const meta = doc.getMap('meta');
        const bgColor = (meta.get('bgColor') as string) || '#0B0C10';

        doc.destroy();

        return {
            lines,
            shapes,
            textAnnotations,
            awareness: snapshot.awareness || [],
            bgColor,
            timestamp: snapshot.timestamp,
        };
    }

    /**
     * Get the full Yjs binary update at the current index (for "Apply to Live").
     */
    getCurrentUpdate(): Uint8Array | null {
        if (this.currentIndex < 0 || this.currentIndex >= this.snapshots.length) return null;
        const snapshot = this.snapshots[this.currentIndex];
        const binaryStr = atob(snapshot.update);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Start auto-playing through snapshots.
     */
    play(): void {
        if (this.playTimer) return;
        if (this.snapshots.length === 0) return;

        // If at the end, restart from beginning immediately
        if (this.currentIndex >= this.snapshots.length - 1) {
            this.seekTo(0);
        } else {
            this.seekTo(this.currentIndex);
        }

        this.onPlayStateChange?.(true);

        const baseInterval = 500; // ms between frames at 1x
        this.playTimer = setInterval(() => {
            if (this.currentIndex < this.snapshots.length - 1) {
                this.seekTo(this.currentIndex + 1);
            } else {
                this.pause();
            }
        }, baseInterval / this.speed);
    }

    /**
     * Pause playback.
     */
    pause(): void {
        if (this.playTimer) {
            clearInterval(this.playTimer);
            this.playTimer = null;
        }
        this.onPlayStateChange?.(false);
    }

    /**
     * Set playback speed (1, 2, or 4).
     */
    setSpeed(speed: number): void {
        this.speed = speed;
        // If currently playing, restart with new speed
        if (this.playTimer) {
            this.pause();
            this.play();
        }
    }

    /**
     * Check if currently playing.
     */
    isPlaying(): boolean {
        return this.playTimer !== null;
    }

    getSnapshotCount(): number {
        return this.snapshots.length;
    }

    getCurrentIndex(): number {
        return this.currentIndex;
    }

    getSpeed(): number {
        return this.speed;
    }

    /**
     * Clean up timers.
     */
    destroy(): void {
        this.pause();
        this.snapshots = [];
        this.onStateChange = null;
        this.onIndexChange = null;
        this.onPlayStateChange = null;
    }
}
