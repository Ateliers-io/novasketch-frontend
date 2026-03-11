/**
 * Auth Service
 *
 * Wraps the /api/auth/* endpoints for profile management.
 */

import api from './api';

export interface UpdateProfilePayload {
    displayName?: string;
    avatar?: string;
    currentPassword?: string;
    newPassword?: string;
}

export interface UserProfile {
    id: string;
    email: string;
    displayName: string;
    avatar: string;
    authProvider?: string;
}

/** Update the authenticated user's profile fields */
export async function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    const response = await api.patch('/auth/profile', payload);
    return response.data.user as UserProfile;
}

/** Permanently delete the authenticated user's account */
export async function deleteAccount(): Promise<void> {
    await api.delete('/auth/account');
}

/** Fetch the authenticated user's full profile from the server */
export async function fetchProfile(): Promise<UserProfile> {
    const response = await api.get('/auth/me');
    const u = response.data;
    return {
        id: u._id || u.id,
        email: u.email,
        displayName: u.displayName,
        avatar: u.avatar || '',
        authProvider: u.authProvider,
    };
}
