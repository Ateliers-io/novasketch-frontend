import { db } from "../db";
import type { Session } from "../db/schema";

export async function saveSession(session: Session) {
  return db.session.put(session);
}

export async function getSession() {
  return db.session.get("current");
}

export async function clearSession() {
  return db.session.delete("current");
}
