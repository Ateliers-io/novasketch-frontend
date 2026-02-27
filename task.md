# Read-Only Mode (Permissions) - Frontend Tasks

This document outlines the frontend-only tasks for implementing "Read-Only" mode (Epic 1.5). The backend already supports the `is_locked` flag in the database and API routes, and rejects WebSocket writes when locked.

## 1.5.1: State Management & Service Updates (✅ IMPLEMENTED)
**Objective:** Fetch, store, and sync the `isLocked` state within the React application.

*   **Initial Load:** Update the session fetching logic (e.g., in `Whiteboard.tsx` or related hooks) to read the `is_locked` boolean from the `GET /api/sessions/:id` response and store it in React state.
*   **WebSocket Sync:** Update `sync.service.ts`/`useSync.ts` to listen for the `"session_locked"` event from the server (message type 4). Surface this state to the React layer so the board locks in real-time.
*   **API Toggle:** Create a frontend API utility to make an authenticated `PATCH /api/sessions/:id/lock` request with `{ is_locked: boolean }` so the session owner can toggle the state.

## 1.5.2: UI Updates (✅ IMPLEMENTED)
**Objective:** Visually communicate the locked state and disable interactive UI elements, while providing a toggle for the session owner.

*   **Toolbar Disabling:** Update `Toolbar.tsx` to conditionally disable drawing, shape, erase, and text tools when `isLocked` is true. Ensure they appear visually non-interactive (e.g., greyed out).
*   **Read-Only Indicator:** Add a prominent "Read-Only" badge in the header or toolbar area for guests.
*   **Lock/Unlock Control:** Add a "Lock Session" toggle/button in the UI (e.g., in the header) that is only visible and functional for the session owner.

## 1.5.3: Canvas & Interaction Restrictions (✅ IMPLEMENTED)
**Objective:** Prevent write actions on the Konva canvas and keyboard shortcuts.

*   **Canvas Interaction Blocking:** In `Whiteboard.tsx`, add top-level guard clauses to `handlePointerDown`, `handlePointerMove`, and `handlePointerUp` to prevent any drawing, selecting, or moving if `isLocked` is true (allow only the `Hand` tool panning/zooming).
*   **Transform/Select Blocking:** Prevent users from clicking on shapes to select them, and ensure the bounding box `SelectionOverlay` is completely disabled.
*   **Text/Shortcut Blocking:** Disable text editing double-clicks (`handleDoubleClick`) and keyboard shortcuts for undo, redo, delete, and tool switching when the session is locked.

---

**Note:** Tests for each of these tasks must be updated or written simultaneously during implementation. Do not change existing tests for unrelated components. *Implement only when explicitly instructed.*
