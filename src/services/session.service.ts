/**
 * Session Service
 *
 * Handles session creation and retrieval for whiteboard boards.
 *
 * Strategy:
 *   - Tries the backend API first (POST /api/session).
 *   - If the backend is unavailable (not yet deployed / teammate hasn't finished 1.1.1),
 *     falls back to generating a UUID on the client side so the frontend
 *     continues to work independently.
 */

import api from './api';

export interface SessionInfo {
    sessionId: string;
    name: string;
    createdBy: string;
    createdAt: string;
    url: string;
    is_locked?: boolean;
}

/**
 * Generate a UUID v4 on the client side.
 * Used as a fallback when the backend session API is not available.
 */
function generateClientUUID(): string {
    // Use crypto.randomUUID if available (modern browsers), otherwise fallback
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Create a new whiteboard session.
 *
 * Attempts to call POST /api/session on the backend.
 * If the backend is not available, generates a client-side UUID and returns
 * a session object so the app still works.
 *
 * @param name   Optional board name (defaults to "Untitled Board")
 * @returns      Session info including sessionId and navigable URL
 */
export async function createSession(name?: string): Promise<{ sessionId: string; url: string }> {
    try {
        const response = await api.post('/session', { name: name || 'Untitled Board' });
        const { sessionId, url } = response.data;

        // Track ownership locally since backend assigns 'anonymous' globally across all unprotected routes
        const owned = JSON.parse(localStorage.getItem('novasketch_owned_boards') || '[]');
        if (!owned.includes(sessionId)) {
            owned.push(sessionId);
            localStorage.setItem('novasketch_owned_boards', JSON.stringify(owned));
        }

        return { sessionId, url: url || `/board/${sessionId}` };
    } catch (error) {
        // Backend not available — fall back to client-generated UUID.
        // This ensures the frontend works even before 1.1.1 is deployed.
        console.warn('[SessionService] Backend unavailable, using client-generated session ID.');
        const sessionId = generateClientUUID();

        // Track ownership locally for fallback client generated rooms
        const owned = JSON.parse(localStorage.getItem('novasketch_owned_boards') || '[]');
        if (!owned.includes(sessionId)) {
            owned.push(sessionId);
            localStorage.setItem('novasketch_owned_boards', JSON.stringify(owned));
        }

        return { sessionId, url: `/board/${sessionId}` };
    }
}

/**
 * Retrieve session metadata by ID.
 *
 * Returns null if the session is not found or the backend is not available.
 *
 * @param id  The session/room UUID
 * @returns   Session metadata or null
 */
export async function getSession(id: string): Promise<SessionInfo | null> {
    try {
        const response = await api.get(`/session/${id}`);
        return response.data as SessionInfo;
    } catch (error) {
        // Session not found or backend unavailable
        console.warn(`[SessionService] Could not fetch session ${id}.`);
        return null;
    }
}

/**
 * Toggle the read-only lock state of a session.
 * 
 * Takes the session ID and the desired boolean locked state.
 * Returns the updated boolean locked state from the server.
 * 
 * @param id The session/room UUID
 * @param is_locked The desired locked state
 * @returns boolean true if successfully updated and is now locked, false otherwise
 */
export async function toggleSessionLock(id: string, is_locked: boolean): Promise<boolean> {
    try {
        const response = await api.patch(`/session/${id}/lock`, { is_locked });
        return response.data.is_locked;
    } catch (error) {
        console.error(`[SessionService] Could not toggle lock for session ${id}.`, error);
        throw error;
    }
}
