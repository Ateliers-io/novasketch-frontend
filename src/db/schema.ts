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
