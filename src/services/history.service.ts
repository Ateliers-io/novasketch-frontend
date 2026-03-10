/**
 * History Service — API client for timeline replay snapshots.
 *
 * Talks to the backend /api/history/:sessionId endpoints.
 */

import api from './api';

export interface HistorySnapshot {
    _id: string;
    update: string;   // base64-encoded Yjs state
    awareness?: any[]; // Snapshot of presence records
    timestamp: string; // ISO date string
}

/**
 * Fetch all timeline snapshots for a session, sorted ascending by time.
 * Throws on failure so callers can surface error details to the user.
 */
export async function getSessionHistory(sessionId: string): Promise<HistorySnapshot[]> {
    const res = await api.get(`/history/${sessionId}`);
    return res.data;
}

/**
 * Delete all timeline snapshots for a session.
 */
export async function clearSessionHistory(sessionId: string): Promise<void> {
    try {
        await api.delete(`/history/${sessionId}`);
    } catch (err) {
        console.error('[HistoryService] Failed to clear history:', err);
    }
}
