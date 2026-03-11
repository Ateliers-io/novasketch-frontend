import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, User, Mail, Lock, Camera, Save, LogOut,
    Trash2, Edit2, Check, X, Eye, EyeOff, Copy,
    ExternalLink, AlertTriangle, Loader2, CheckCircle2, Shield
} from 'lucide-react';
import { useAuth } from '../../../contexts';
import { updateProfile, deleteAccount } from '../../../services/auth.service';
import { getUserSessions, SessionInfo } from '../../../services/session.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function relativeTime(iso?: string): string {
    if (!iso) return '—';
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.floor(d / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

// ─── Password strength checker ───────────────────────────────────────────────

const PW_RULES = [
    { test: (p: string) => p.length >= 8,           label: '8+ characters' },
    { test: (p: string) => /[A-Z]/.test(p),         label: 'Uppercase letter' },
    { test: (p: string) => /[a-z]/.test(p),         label: 'Lowercase letter' },
    { test: (p: string) => /\d/.test(p),             label: 'Number' },
    { test: (p: string) => /[@$!%*?&#^()_\-+=]/.test(p), label: 'Special character' },
];

const strength = (pw: string) => PW_RULES.filter(r => r.test(pw)).length;

// ─── Sub components ───────────────────────────────────────────────────────────

function RevealInput({ value, onChange, placeholder, disabled, id }: {
    value: string; onChange: (v: string) => void;
    placeholder?: string; disabled?: boolean; id: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <input
                id={id}
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full bg-[#1a1c23] border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-sm text-white
                           placeholder:text-gray-500 focus:outline-none focus:border-teal-500/50
                           focus:ring-1 focus:ring-teal-500/50 transition disabled:opacity-50"
            />
            <button type="button" onClick={() => setShow(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors" tabIndex={-1}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>
    );
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg shadow-xl
            border text-sm font-medium pointer-events-none transition-all
            ${ok ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
            style={{ animation: 'slideUp .3s ease' }}
        >
            {ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {msg}
        </div>
    );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export const ProfilePage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Form state
    const [displayName, setDisplayName]   = useState(user?.displayName ?? '');
    const [avatarUrl,   setAvatarUrl]     = useState(user?.avatar ?? '');
    const [editingName, setEditingName]   = useState(false);
    const [imgError,    setImgError]      = useState(false);

    const [curPw,       setCurPw]        = useState('');
    const [newPw,       setNewPw]        = useState('');
    const [confPw,      setConfPw]       = useState('');

    const [savingInfo,   setSavingInfo]  = useState(false);
    const [savingPw,     setSavingPw]    = useState(false);
    const [deleting,     setDeleting]    = useState(false);
    const [showDel,      setShowDel]     = useState(false);
    const [delText,      setDelText]     = useState('');
    const [copied,       setCopied]      = useState(false);

    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [boards, setBoards] = useState<SessionInfo[]>([]);
    const [loadingBoards, setLoadingBoards] = useState(true);

    // Navigation active section
    const [section, setSection] = useState<'profile' | 'security'>('profile');

    const nameRef = useRef<HTMLInputElement>(null);
    const isGoogle = user?.authProvider === 'google';
    const initials = getInitials(user?.displayName ?? 'U');
    const pw_strength = strength(newPw);

    const toast$ = useCallback((msg: string, ok: boolean) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3500);
    }, []);

    useEffect(() => { if (editingName) nameRef.current?.focus(); }, [editingName]);

    useEffect(() => {
        getUserSessions().then(setBoards).catch(() => {}).finally(() => setLoadingBoards(false));
    }, []);

    const total = boards.length;
    const collab = boards.filter(b => b.isCollab).length;
    const personal = boards.filter(b => !b.isCollab).length;

    // ── save display info ──────────────────────────────────────────────────
    const saveInfo = async () => {
        if (!displayName.trim()) return toast$('Display name is required', false);
        setSavingInfo(true);
        try {
            await updateProfile({ displayName: displayName.trim(), avatar: avatarUrl.trim() || undefined });
            setEditingName(false);
            toast$('Profile saved!', true);
        } catch (e: any) {
            toast$(e?.response?.data?.error || 'Save failed', false);
        } finally { setSavingInfo(false); }
    };

    // ── save password ──────────────────────────────────────────────────────
    const savePw = async () => {
        if (!curPw) return toast$('Current password required', false);
        if (!newPw)  return toast$('New password required', false);
        if (newPw !== confPw) return toast$("Passwords don't match", false);
        setSavingPw(true);
        try {
            await updateProfile({ currentPassword: curPw, newPassword: newPw });
            setCurPw(''); setNewPw(''); setConfPw('');
            toast$('Password updated!', true);
        } catch (e: any) {
            toast$(e?.response?.data?.error || 'Password update failed', false);
        } finally { setSavingPw(false); }
    };

    // ── delete account ─────────────────────────────────────────────────────
    const confirmDelete = async () => {
        if (delText !== 'DELETE') return;
        setDeleting(true);
        try {
            await deleteAccount(); logout(); navigate('/');
        } catch (e: any) {
            toast$(e?.response?.data?.error || 'Delete failed', false);
            setDeleting(false);
        }
    };

    // ── strength bar colour ────────────────────────────────────────────────
    const barColor = pw_strength <= 1 ? '#ef4444' : pw_strength <= 3 ? '#f59e0b' : '#14b8a6';

    return (
        <div className="min-h-screen bg-[#0B0C10] text-gray-200 font-sans flex flex-col">
            
            {/* Top Navigation Bar */}
            <header className="h-16 border-b border-white/10 bg-[#0B0C10] flex items-center px-6 sticky top-0 z-20">
                <button 
                    onClick={() => navigate('/home')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mr-8"
                >
                    <ArrowLeft size={18} />
                    <span className="font-medium text-sm">Dashboard</span>
                </button>
                <div className="h-6 w-px bg-white/10 mr-8" />
                <h1 className="text-lg font-semibold text-white">Account Settings</h1>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex gap-10">
                
                {/* Left Sidebar Navigation */}
                <aside className="w-64 shrink-0 flex flex-col gap-1">
                    <button 
                        onClick={() => setSection('profile')}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
                            ${section === 'profile' ? 'bg-teal-500/10 text-teal-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <User size={18} />
                        Profile Settings
                    </button>
                    <button 
                        onClick={() => setSection('security')}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
                            ${section === 'security' ? 'bg-teal-500/10 text-teal-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <Shield size={18} />
                        Security & Data
                    </button>
                </aside>

                {/* Right Content Panel */}
                <div className="flex-1 space-y-8 max-w-2xl">
                    
                    {/* Header showing basic user info - visible on all tabs */}
                    <div className="flex items-start gap-5 pb-8 border-b border-white/10">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-2xl font-bold text-white shadow-lg overflow-hidden shrink-0 border-2 border-[#0B0C10]">
                            {avatarUrl && !imgError 
                                ? <img src={avatarUrl} onError={() => setImgError(true)} alt="" className="w-full h-full object-cover" /> 
                                : initials}
                        </div>
                        <div className="pt-1 flex-1">
                            <h2 className="text-2xl font-bold text-white">{user?.displayName}</h2>
                            <p className="text-gray-400 mt-1">{user?.email}</p>
                            <div className="flex items-center gap-4 mt-3">
                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isGoogle ? 'bg-white/10 text-white' : 'bg-teal-500/15 text-teal-400'}`}>
                                    {isGoogle ? 'Google Account' : 'Standard Account'}
                                </span>
                                <div className="flex items-center gap-3 text-sm text-gray-400">
                                    <span title="Total Boards" className="cursor-help"><b className="text-white">{loadingBoards ? '-' : total}</b> projects</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* === PROFILE SECTION === */}
                    {section === 'profile' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">Personal Information</h3>
                                <p className="text-sm text-gray-400 mb-6">Update your display name and profile picture.</p>
                            </div>

                            <div className="space-y-5">
                                {/* Display Name */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Display Name</label>
                                    {editingName ? (
                                        <div className="flex gap-2">
                                            <input ref={nameRef} id="display-name-input"
                                                value={displayName} onChange={e => setDisplayName(e.target.value)}
                                                maxLength={30}
                                                className="flex-1 bg-[#1a1c23] border border-teal-500/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500/50 transition"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveInfo();
                                                    if (e.key === 'Escape') { setEditingName(false); setDisplayName(user?.displayName ?? ''); }
                                                }}
                                            />
                                            <button onClick={() => { setEditingName(false); setDisplayName(user?.displayName ?? ''); }}
                                                className="px-3 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <div className="flex-1 bg-[#1a1c23] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white cursor-default">
                                                {displayName || '—'}
                                            </div>
                                            <button onClick={() => setEditingName(true)}
                                                className="px-4 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition font-medium">
                                                Edit
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Email */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Email Address</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-[#1a1c23]/50 border border-white/5 rounded-lg px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed">
                                            {user?.email}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500">Your email address is managed by your authentication provider and cannot be changed here.</p>
                                </div>

                                {/* Avatar */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Avatar URL</label>
                                    <input type="url"
                                        value={avatarUrl}
                                        onChange={e => { setAvatarUrl(e.target.value); setImgError(false); }}
                                        placeholder="https://example.com/your-avatar.jpg"
                                        className="w-full bg-[#1a1c23] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white
                                                   placeholder:text-gray-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition"

                                    />
                                    {avatarUrl && !imgError && (
                                        <div className="flex items-center gap-3 pt-2">
                                            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
                                                <img src={avatarUrl} onError={() => setImgError(true)} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-sm text-green-400 flex items-center gap-1.5"><Check size={14} /> Preview successful</span>
                                        </div>
                                    )}
                                    {imgError && <p className="text-sm text-red-400 flex items-center gap-1.5 pt-1"><AlertTriangle size={14} /> Image could not be loaded</p>}
                                </div>

                                <div className="pt-4">
                                    <button onClick={saveInfo} disabled={savingInfo}
                                        className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                                        {savingInfo ? <Loader2 size={16} className="animate-spin" /> : null}
                                        {savingInfo ? 'Saving Changes...' : 'Save Profile Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === SECURITY SECTION === */}
                    {section === 'security' && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            
                            {/* Password Update */}
                            <section>
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-1">Password</h3>
                                    <p className="text-sm text-gray-400 mb-6">Manage your password to keep your account secure.</p>
                                </div>

                                {isGoogle ? (
                                    <div className="bg-white/5 border border-white/10 p-5 rounded-xl flex gap-4 items-start">
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z"/></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-base font-medium text-white">Google Authenticated</h4>
                                            <p className="text-sm text-gray-400 mt-1 mb-3">You signed in using Google. Password changes are disabled because Google manages your account security.</p>
                                            <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors">
                                                Manage Google Account <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-5 max-w-md">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-300">Current Password</label>
                                            <RevealInput id="cur-pw" value={curPw} onChange={setCurPw} placeholder="Enter current password" disabled={savingPw} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-300">New Password</label>
                                            <RevealInput id="new-pw" value={newPw} onChange={setNewPw} placeholder="Enter new password" disabled={savingPw} />
                                            
                                            {/* Password Strength Indicator */}
                                            {newPw && (
                                                <div className="pt-2 space-y-3">
                                                    <div className="flex gap-1.5">
                                                        {[1,2,3,4,5].map(i => (
                                                            <div key={i} className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                                                                <div className="h-full transition-all duration-300" style={{ width: i <= pw_strength ? '100%' : '0%', backgroundColor: barColor }} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                                                        {PW_RULES.map(r => {
                                                            const ok = r.test(newPw);
                                                            return (
                                                                <div key={r.label} className={`flex items-center gap-2 ${ok ? 'text-green-400' : 'text-gray-500'}`}>
                                                                    {ok ? <Check size={12} /> : <div className="w-1 h-1 rounded-full bg-gray-600 ml-1 mr-1" />} {r.label}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-300">Confirm New Password</label>
                                            <RevealInput id="conf-pw" value={confPw} onChange={setConfPw} placeholder="Confirm new password" disabled={savingPw} />
                                            {confPw && newPw !== confPw && (
                                                <p className="text-sm text-red-400 mt-1">Passwords do not match.</p>
                                            )}
                                        </div>
                                        <div className="pt-2">
                                            <button onClick={savePw} disabled={savingPw || !curPw || !newPw || newPw !== confPw}
                                                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                                                {savingPw ? <Loader2 size={16} className="animate-spin" /> : null}
                                                Update Password
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </section>

                            <hr className="border-white/10" />

                            {/* Danger Zone */}
                            <section>
                                <div>
                                    <h3 className="text-lg font-semibold text-red-500 mb-1">Danger Zone</h3>
                                    <p className="text-sm text-gray-400 mb-6">Irreversible and destructive actions.</p>
                                </div>

                                <div className="space-y-4">
                                    {/* Sign Out Card */}
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5">
                                        <div>
                                            <h4 className="text-sm font-medium text-white">Sign Out</h4>
                                            <p className="text-sm text-gray-400">Log out of your current session on this device.</p>
                                        </div>
                                        <button onClick={() => { logout(); navigate('/'); }}
                                            className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors">
                                            Sign Out
                                        </button>
                                    </div>

                                    {/* Delete Account Card */}
                                    <div className="p-5 rounded-xl border border-red-500/20 bg-red-500/5">
                                        <div className="flex items-start justify-between gap-4 mb-4">
                                            <div>
                                                <h4 className="text-sm font-medium text-white">Delete Account</h4>
                                                <p className="text-sm text-gray-400 mt-1">Permanently delete your account and remove access to all collaborative boards. This action is not reversible.</p>
                                            </div>
                                            {!showDel && (
                                                <button onClick={() => setShowDel(true)}
                                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-medium transition-colors shrink-0">
                                                    Delete Account...
                                                </button>
                                            )}
                                        </div>

                                        {showDel && (
                                            <div className="mt-6 pt-6 border-t border-red-500/10">
                                                <p className="text-sm text-gray-300 mb-3">
                                                    To verify, type <strong>DELETE</strong> below:
                                                </p>
                                                <div className="flex gap-3 max-w-md">
                                                    <input value={delText} onChange={e => setDelText(e.target.value)}
                                                        placeholder="DELETE"
                                                        className="flex-1 bg-[#1a1c23] border border-red-500/30 rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition" 
                                                    />
                                                    <button onClick={() => { setShowDel(false); setDelText(''); }}
                                                        className="px-4 py-2 border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors">
                                                        Cancel
                                                    </button>
                                                    <button onClick={confirmDelete}
                                                        disabled={delText !== 'DELETE' || deleting}
                                                        className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                                        {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                        Confirm Delete
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                        </div>
                    )}
                </div>
            </main>

            {/* Toast */}
            {toast && <Toast msg={toast.msg} ok={toast.ok} />}

            <style>{`
                @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
            `}</style>
        </div>
    );
};
