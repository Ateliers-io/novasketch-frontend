import React from 'react';

interface RemoteCursor {
    name: string;
    color: string;
    cursor?: { x: number; y: number };
}

interface RemoteCursorsProps {
    users: RemoteCursor[];
    stagePos: { x: number; y: number };
    stageScale: number;
}

/**
 * Task 3.1.3: Renders remote collaborator cursors on the canvas.
 * 
 * Each cursor shows:
 *   - A colored arrow pointer (SVG) matching the user's profile color
 *   - A name label pill below the cursor
 * 
 * Cursor positions come from Yjs Awareness (canvas/virtual coordinates).
 * We convert them to screen coordinates using: screen = virtual * scale + pan
 */
const RemoteCursors: React.FC<RemoteCursorsProps> = ({ users, stagePos, stageScale }) => {
    // Only render users who have an active cursor position
    const remoteCursors = users.filter(u => u.cursor);

    if (remoteCursors.length === 0) return null;

    return (
        <div
            className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
            aria-hidden="true"
        >
            {remoteCursors.map((user) => {
                // Convert canvas coordinates → screen coordinates
                const screenX = user.cursor!.x * stageScale + stagePos.x;
                const screenY = user.cursor!.y * stageScale + stagePos.y;

                return (
                    <div
                        key={user.name}
                        className="absolute top-0 left-0"
                        style={{
                            transform: `translate(${screenX}px, ${screenY}px)`,
                            transition: 'transform 80ms ease-out',
                            willChange: 'transform',
                        }}
                    >
                        {/* Arrow cursor SVG */}
                        <svg
                            width="20"
                            height="24"
                            viewBox="0 0 20 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{ filter: `drop-shadow(0 1px 3px rgba(0,0,0,0.5))` }}
                        >
                            {/* Cursor arrow body */}
                            <path
                                d="M1 1L1 18.5L5.5 14L10.5 22L13.5 20.5L8.5 12.5L14.5 12L1 1Z"
                                fill={user.color}
                                stroke="rgba(0,0,0,0.6)"
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                            />
                        </svg>

                        {/* Name label pill */}
                        <div
                            className="absolute left-4 top-5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold shadow-lg"
                            style={{
                                backgroundColor: user.color,
                                color: getContrastColor(user.color),
                                boxShadow: `0 2px 8px ${user.color}66, 0 1px 3px rgba(0,0,0,0.4)`,
                            }}
                        >
                            {user.name}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/**
 * Returns black or white text depending on the background color brightness.
 * Ensures name labels are always readable regardless of cursor color.
 */
function getContrastColor(hex: string): string {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    // Perceived brightness (ITU-R BT.709)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? '#000000' : '#FFFFFF';
}

export default RemoteCursors;
