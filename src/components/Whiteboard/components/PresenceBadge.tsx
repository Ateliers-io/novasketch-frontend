import React, { useState } from 'react';

export interface CollaboratorUser {
    name: string;
    color: string;
}

interface PresenceBadgeProps {
    users: CollaboratorUser[];
}

// Max avatars to show before collapsing into "+N"
const MAX_VISIBLE = 4;

function getInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase();
}

const PresenceBadge: React.FC<PresenceBadgeProps> = ({ users }) => {
    const [expanded, setExpanded] = useState(false);

    const count = users.length;
    const visible = users.slice(0, MAX_VISIBLE);
    const overflow = count - MAX_VISIBLE;

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2 select-none">

            {/* Main pill badge */}
            <button
                onClick={() => setExpanded(prev => !prev)}
                title={expanded ? 'Hide members' : 'Show members'}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300"
                style={{
                    background: 'rgba(11, 12, 16, 0.75)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: count > 0
                        ? '0 0 16px rgba(102,252,241,0.12), 0 4px 16px rgba(0,0,0,0.4)'
                        : '0 4px 16px rgba(0,0,0,0.4)',
                }}
            >
                {/* Overlapping avatar stack */}
                <div className="flex items-center" style={{ direction: 'rtl' }}>
                    {/* Overflow count bubble */}
                    {overflow > 0 && (
                        <div
                            className="flex items-center justify-center rounded-full font-bold text-white z-10"
                            style={{
                                width: 26,
                                height: 26,
                                fontSize: 10,
                                background: 'rgba(255,255,255,0.12)',
                                border: '2px solid rgba(11,12,16,0.9)',
                                marginRight: -6,
                                flexShrink: 0,
                            }}
                        >
                            +{overflow}
                        </div>
                    )}

                    {/* Individual avatars (reversed so first user shows on left) */}
                    {[...visible].reverse().map((user, idx) => (
                        <div
                            key={`${user.name}-${idx}`}
                            title={user.name}
                            className="flex items-center justify-center rounded-full font-bold text-black flex-shrink-0"
                            style={{
                                width: 26,
                                height: 26,
                                fontSize: 11,
                                background: user.color,
                                border: '2px solid rgba(11,12,16,0.9)',
                                marginRight: idx === 0 ? 0 : -8,
                                zIndex: visible.length - idx,
                                boxShadow: `0 0 8px ${user.color}55`,
                            }}
                        >
                            {getInitial(user.name)}
                        </div>
                    ))}
                </div>

                {/* Online label */}
                <div className="flex items-center gap-1.5">
                    {/* Live green dot */}
                    <span
                        className="rounded-full flex-shrink-0"
                        style={{
                            width: 7,
                            height: 7,
                            background: count > 0 ? '#33FF99' : '#555',
                            boxShadow: count > 0 ? '0 0 6px #33FF99' : 'none',
                        }}
                    />
                    <span
                        className="text-xs font-semibold whitespace-nowrap"
                        style={{ color: count > 0 ? '#e2e8f0' : '#64748b' }}
                    >
                        {count} {count === 1 ? 'Online' : 'Online'}
                    </span>
                </div>
            </button>

            {/* Expanded member list dropdown */}
            {expanded && count > 0 && (
                <div
                    className="rounded-xl overflow-hidden"
                    style={{
                        background: 'rgba(11,12,16,0.88)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(102,252,241,0.08)',
                        minWidth: 180,
                    }}
                >
                    {/* Header */}
                    <div
                        className="px-3 py-2 text-xs font-semibold uppercase tracking-widest"
                        style={{
                            color: '#66FCF1',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                    >
                        In this room
                    </div>

                    {/* User rows */}
                    <div className="py-1">
                        {users.map((user, idx) => (
                            <div
                                key={`row-${idx}`}
                                className="flex items-center gap-2.5 px-3 py-1.5"
                            >
                                {/* Avatar */}
                                <div
                                    className="flex items-center justify-center rounded-full font-bold text-black flex-shrink-0"
                                    style={{
                                        width: 24,
                                        height: 24,
                                        fontSize: 11,
                                        background: user.color,
                                        boxShadow: `0 0 8px ${user.color}66`,
                                    }}
                                >
                                    {getInitial(user.name)}
                                </div>

                                {/* Name */}
                                <span
                                    className="text-sm font-medium truncate"
                                    style={{ color: '#e2e8f0', maxWidth: 120 }}
                                >
                                    {user.name}
                                </span>

                                {/* Live dot */}
                                <span
                                    className="rounded-full ml-auto flex-shrink-0"
                                    style={{
                                        width: 6,
                                        height: 6,
                                        background: '#33FF99',
                                        boxShadow: '0 0 5px #33FF99',
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PresenceBadge;
