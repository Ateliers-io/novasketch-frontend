/**
 * Session Service
 *
 * Handles session creation and retrieval for whiteboard boards.
 *
 * Strategy:
 *   - Tries the backend API first (POST /api/canvas).
 *   - If the backend is unavailable, falls back to generating a UUID
 *     on the client side so the frontend continues to work independently.
 *   - All created boards are ALSO tracked in localStorage so the
 *     Dashboard always shows them, even if the backend is unreachable.
 */

import api from './api';

// ─── Types ───────────────────────────────────────────────────────────

export interface SessionInfo {
    sessionId: string;
    name: string;
    createdBy: string;
    createdAt: string;
    url: string;
    is_locked?: boolean;
    isCollab?: boolean;
    lastEditedAt?: string;
    lastAccessedAt?: string;
    role?: string;
    users?: number;
}

// ─── localStorage Keys ──────────────────────────────────────────────

const LOCAL_BOARDS_KEY = 'novasketch_boards';
const LOCAL_OWNED_KEY = 'novasketch_owned_boards';

// ─── Local Board Registry ──────────────────────────────────────────
// Keeps a list of boards in localStorage so they persist across
// page reloads and browser sessions, even without a backend.

function getLocalBoards(): SessionInfo[] {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_BOARDS_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveLocalBoards(boards: SessionInfo[]): void {
    localStorage.setItem(LOCAL_BOARDS_KEY, JSON.stringify(boards));
}

/** Add or update a board in the local registry */
export function upsertLocalBoard(board: SessionInfo): void {
    const boards = getLocalBoards();
    const idx = boards.findIndex(b => b.sessionId === board.sessionId);
    if (idx >= 0) {
        boards[idx] = { ...boards[idx], ...board };
    } else {
        boards.push(board);
    }
    saveLocalBoards(boards);
}

/** Update lastEditedAt for a board (called when user works on it) */
export function touchLocalBoard(sessionId: string): void {
    const boards = getLocalBoards();
    const board = boards.find(b => b.sessionId === sessionId);
    if (board) {
        board.lastEditedAt = new Date().toISOString();
        board.lastAccessedAt = new Date().toISOString();
        saveLocalBoards(boards);
    }
}

// ─── UUID Generator ────────────────────────────────────────────────

function generateClientUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ─── Create Session ────────────────────────────────────────────────

/**
 * Create a new whiteboard session.
 *
 * @param name     Optional board name (defaults to "Untitled Board")
 * @param isCollab Whether this is a collaborative board
 * @returns        Session info including sessionId and navigable URL
 */
export async function createSession(
    name?: string,
    isCollab: boolean = false
): Promise<{ sessionId: string; url: string }> {
    const boardName = name || 'Untitled Board';
    let sessionId: string;
    let url: string;

    try {
        const response = await api.post('/canvas', { name: boardName });
        sessionId = response.data.canvasId || response.data.sessionId;
        url = response.data.url || `/board/${sessionId}`;
    } catch {
        // Backend not available — fall back to client-generated UUID.
        console.warn('[SessionService] Backend unavailable, using client-generated session ID.');
        sessionId = generateClientUUID();
        url = `/board/${sessionId}`;
    }

    // Track ownership locally
    const owned = JSON.parse(localStorage.getItem(LOCAL_OWNED_KEY) || '[]');
    if (!owned.includes(sessionId)) {
        owned.push(sessionId);
        localStorage.setItem(LOCAL_OWNED_KEY, JSON.stringify(owned));
    }

    // Save to local board registry so Dashboard always shows it
    const now = new Date().toISOString();
    upsertLocalBoard({
        sessionId,
        name: boardName,
        createdBy: 'You',
        createdAt: now,
        url,
        isCollab,
        lastEditedAt: now,
        lastAccessedAt: now,
        role: 'owner',
    });

    return { sessionId, url };
}

// ─── Get Session ───────────────────────────────────────────────────

export async function getSession(id: string): Promise<SessionInfo | null> {
    try {
        const response = await api.get(`/canvas/${id}`);
        const data = response.data;
        return {
            sessionId: data.canvasId || data.sessionId || id,
            name: data.name || 'Untitled Board',
            createdBy: data.owner?.displayName || data.createdBy || 'unknown',
            createdAt: data.createdAt || new Date().toISOString(),
            url: `/board/${data.canvasId || data.sessionId || id}`,
            is_locked: data.is_locked,
        } as SessionInfo;
    } catch {
        console.warn(`[SessionService] Could not fetch session ${id}.`);
        return null;
    }
}

// ─── Toggle Lock ───────────────────────────────────────────────────

export async function toggleSessionLock(id: string, is_locked: boolean): Promise<boolean> {
    try {
        const response = await api.patch(`/canvas/${id}/lock`, { is_locked });
        return response.data.is_locked;
    } catch (error) {
        console.error(`[SessionService] Could not toggle lock for session ${id}.`, error);
        throw error;
    }
}

// ─── Update Name ───────────────────────────────────────────────────

export async function updateSessionName(id: string, name: string): Promise<void> {
    try {
        await api.patch(`/canvas/${id}/name`, { name });
        // Update local board registry too
        const boards = getLocalBoards();
        const board = boards.find(b => b.sessionId === id);
        if (board) {
            board.name = name;
            saveLocalBoards(boards);
        }
    } catch (err) {
        console.warn(`[SessionService] Could not update session name for ${id}.`, err);
        // Fallback to local
        const boards = getLocalBoards();
        const board = boards.find(b => b.sessionId === id);
        if (board) {
            board.name = name;
            saveLocalBoards(boards);
        }
    }
}

// ─── Get All User Sessions ─────────────────────────────────────────

/**
 * Retrieve all canvases/sessions for the current user.
 *
 * Merges API-fetched boards with locally tracked boards so the
 * Dashboard always shows created boards even if the backend is
 * unreachable or the user is not authenticated.
 */
export async function getUserSessions(): Promise<SessionInfo[]> {
    let apiBoards: SessionInfo[] = [];

    try {
        const response = await api.get('/canvas/mine');
        const canvases = response.data.canvases || [];
        apiBoards = canvases.map((canvas: any) => ({
            sessionId: canvas.canvasId,
            name: canvas.name,
            createdBy: canvas.owner?.displayName || 'Unknown',
            createdAt: canvas.createdAt,
            url: `/board/${canvas.canvasId}`,
            is_locked: canvas.is_locked,
            isCollab: canvas.isCollab,
            lastEditedAt: canvas.lastEditedAt,
            lastAccessedAt: canvas.lastAccessedAt,
            role: canvas.role,
        }));
    } catch {
        console.warn('[SessionService] Could not fetch user sessions from API, using local data.');
    }

    // Merge with local boards (local data fills in gaps)
    const localBoards = getLocalBoards();

    // Build a map keyed by sessionId. API data takes priority.
    const boardMap = new Map<string, SessionInfo>();

    // Add local boards first
    for (const board of localBoards) {
        boardMap.set(board.sessionId, board);
    }

    // Overwrite with API boards (they have the latest server state)
    for (const board of apiBoards) {
        const existing = boardMap.get(board.sessionId);
        boardMap.set(board.sessionId, { ...existing, ...board });
    }

    // Also update local storage with API data for future offline use
    const merged = Array.from(boardMap.values());
    saveLocalBoards(merged);

    return merged;
}

// ─── Join Session ──────────────────────────────────────────────────

export async function joinSession(id: string): Promise<void> {
    try {
        await api.post(`/canvas/${id}/join`);
    } catch {
        console.warn(`[SessionService] Could not auto-join canvas ${id}.`);
    }
}
// ─── Delete Session ──────────────────────────────────────────────────

export async function deleteSession(id: string): Promise<void> {
    try {
        await api.delete(`/api/canvas/${id}`);
    } catch (error) {
        console.warn('Backend delete failed, might be local only or offline:', error);
    }

    // Always delete locally inside localStorage
    try {
        const boards = getLocalBoards();
        const updatedBoards = boards.filter(b => b.sessionId !== id);
        saveLocalBoards(updatedBoards);

        // clean up owned boards
        const owned = JSON.parse(localStorage.getItem('novasketch_owned_boards') || '[]');
        localStorage.setItem('novasketch_owned_boards', JSON.stringify(owned.filter((bId: string) => bId !== id)));
    } catch (e) {
        // ignore
    }
}
