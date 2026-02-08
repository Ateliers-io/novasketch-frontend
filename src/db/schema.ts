import type { Shape } from '../types/shapes';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: 'google' | 'github' | 'guest';
  role: 'admin' | 'editor' | 'viewer';
  lastLogin: string;
}

export interface Session {
  id: string; // Typically "current"
  user: User;
  token?: string;
  expiresAt?: string;
  updatedAt: string;
}

export interface StrokeLine {
  id: string;
  points: number[];
  color: string;
  strokeWidth: number;
}

export interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
}

export type WhiteboardElement =
  | { type: 'shape'; data: Shape }
  | { type: 'line'; data: StrokeLine }
  | { type: 'text'; data: TextAnnotation };

export interface WhiteboardItem {
  id: string;
  boardId: string;
  element: WhiteboardElement;
  updatedAt: number;
}

export interface SyncOperation {
  id?: number;
  collection: string; // e.g., 'users', 'whiteboard'
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: number;
  status: 'pending' | 'failed';
  retryCount: number;
}

export interface CacheEntry {
  key: string;
  value: unknown;
  updatedAt: number;
}
