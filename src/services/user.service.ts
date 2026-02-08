import { db } from "../db";
import type { User } from "../db/schema";
import { syncService } from "./sync.service";

export async function addUser(user: User) {
  // 1. Update local database immediately
  await db.users.add(user);

  // 2. Queue for backend sync
  await syncService.queueOperation('users', 'CREATE', user);

  return user;
}

export async function getUsers(): Promise<User[]> {
  return db.users.toArray();
}

export async function updateUser(
  id: string,
  data: Partial<User>
) {
  // 1. Update local database
  await db.users.update(id, data);

  // 2. Queue for backend sync
  await syncService.queueOperation('users', 'UPDATE', { id, ...data });
}

export async function deleteUser(id: string) {
  // 1. Update local database
  await db.users.delete(id);

  // 2. Queue for backend sync
  await syncService.queueOperation('users', 'DELETE', { id });
}
