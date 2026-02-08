import Dexie, { Table } from "dexie";
import type { User, CacheEntry, Session, SyncOperation, WhiteboardItem } from "./schema";

export class AppDB extends Dexie {
  users!: Table<User, string>;
  cache!: Table<CacheEntry, string>;
  session!: Table<Session, string>;
  syncQueue!: Table<SyncOperation, number>;
  whiteboard!: Table<WhiteboardItem, string>;

  constructor() {
    super("NovaSketchDB");

    this.version(4).stores({
      users: "id, name, email",
      cache: "key, updatedAt",
      session: "id",
      syncQueue: "++id, collection, status, action",
      whiteboard: "id, boardId, updatedAt"
    });
  }
}

export const db = new AppDB();
