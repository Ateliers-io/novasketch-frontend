import { db } from "../db";
import type { WhiteboardItem, WhiteboardElement } from "../db/schema";
import { syncService } from "./sync.service";

export async function saveWhiteboardElement(boardId: string, element: WhiteboardElement) {
    const item: WhiteboardItem = {
        id: element.data.id,
        boardId,
        element,
        updatedAt: Date.now()
    };

    // 1. Update local DB
    await db.whiteboard.put(item);

    // 2. Queue for backend sync
    await syncService.queueOperation('whiteboard', 'UPDATE', item);

    return item;
}

export async function getWhiteboardElements(boardId: string): Promise<WhiteboardItem[]> {
    return db.whiteboard.where('boardId').equals(boardId).toArray();
}

export async function deleteWhiteboardElement(boardId: string, elementId: string) {
    // 1. Update local DB
    await db.whiteboard.delete(elementId);

    // 2. Queue for backend sync
    await syncService.queueOperation('whiteboard', 'DELETE', { boardId, elementId });
}

export async function clearWhiteboard(boardId: string) {
    const elements = await getWhiteboardElements(boardId);
    for (const el of elements) {
        await deleteWhiteboardElement(boardId, el.id);
    }
}
