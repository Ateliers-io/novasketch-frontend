import Dexie, { Table } from "dexie";
import type { User, CacheEntry, Session, SyncOperation } from "./schema";

export class AppDB extends Dexie {
  users!: Table<User, string>;
  cache!: Table<CacheEntry, string>;
  session!: Table<Session, string>;
  syncQueue!: Table<SyncOperation, number>;

  constructor() {
    super("NovaSketchDB");

    this.version(2).stores({
      users: "id, name, email",
      cache: "key, updatedAt",
      session: "id",
      syncQueue: "++id, collection, status"
    });
  }
}

export const db = new AppDB();
