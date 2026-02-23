/**
 * BoardPage — Session validation wrapper for the Whiteboard.
 *
 * This component sits between the router and the Whiteboard:
 *   1. Reads the :id param from the URL
 *   2. Calls GET /api/session/:id to validate the session exists
 *   3. Shows a loading spinner while the API call is in progress
 *   4. Renders <Whiteboard /> once the session is confirmed
 *   5. Shows a "not found" placeholder if the session doesn't exist (Task 1.2.3)
 *
 * Why a wrapper instead of modifying Whiteboard.tsx directly?
 *   - Keeps the Whiteboard component focused on canvas logic (already ~2900 lines)
 *   - Clean separation: BoardPage handles session lifecycle, Whiteboard handles drawing
 *   - Makes the 404 page (1.2.3) easy to plug in later
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { getSession, SessionInfo } from '../../../services/session.service';
import Whiteboard from '../../Whiteboard/Whiteboard';

type BoardStatus = 'loading' | 'found' | 'not-found';

export const BoardPage = () => {
    const { id } = useParams<{ id: string }>();
    const [status, setStatus] = useState<BoardStatus>('loading');
    const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

    useEffect(() => {
        if (!id) {
            setStatus('not-found');
            return;
        }

        let cancelled = false;

        const validateSession = async () => {
            setStatus('loading');
            const session = await getSession(id);

            if (cancelled) return;

            if (session) {
                setSessionInfo(session);
                setStatus('found');
            } else {
                // Session not found or backend unavailable.
                // For now, we still load the whiteboard to maintain backward
                // compatibility (offline/demo usage). Task 1.2.3 will replace
                // this with a proper 404 page.
                setSessionInfo(null);
                setStatus('found');
            }
        };

        validateSession();

        return () => {
            cancelled = true;
        };
    }, [id]);

    // --- LOADING STATE ---
    if (status === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#0B0C10]">
                {/* Subtle background glow */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#66FCF1] rounded-full mix-blend-overlay filter blur-[180px] opacity-[0.06]" />
                </div>

                {/* Spinner */}
                <div className="relative z-10 flex flex-col items-center gap-6">
                    {/* Animated logo */}
                    <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-[#1F2833] border border-[#66FCF1]/20 flex items-center justify-center shadow-lg shadow-[#66FCF1]/10">
                            <Sparkles className="w-7 h-7 text-[#66FCF1] animate-pulse" />
                        </div>
                        {/* Orbiting ring */}
                        <div className="absolute -inset-3">
                            <div className="w-full h-full border-2 border-transparent border-t-[#66FCF1] rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
                        </div>
                    </div>

                    {/* Text */}
                    <div className="text-center space-y-2">
                        <h2 className="text-lg font-semibold text-white">
                            {sessionInfo?.name
                                ? `Loading "${sessionInfo.name}"...`
                                : 'Loading board...'
                            }
                        </h2>
                        <p className="text-sm text-gray-500 font-mono">
                            {id && id.length > 20
                                ? `${id.slice(0, 8)}...${id.slice(-4)}`
                                : id
                            }
                        </p>
                    </div>

                    {/* Progress dots */}
                    <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="w-2 h-2 rounded-full bg-[#66FCF1]"
                                style={{
                                    animation: 'pulse 1.2s ease-in-out infinite',
                                    animationDelay: `${i * 0.2}s`,
                                    opacity: 0.3,
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Inline keyframes for progress dots */}
                <style>{`
                    @keyframes pulse {
                        0%, 100% { opacity: 0.3; transform: scale(1); }
                        50% { opacity: 1; transform: scale(1.3); }
                    }
                `}</style>
            </div>
        );
    }

    // --- NOT FOUND STATE ---
    // Placeholder for Task 1.2.3. Currently falls through to Whiteboard.
    // 1.2.3 will replace this with a proper SessionNotFound component.
    if (status === 'not-found') {
        // For now, render Whiteboard anyway (backward compat).
        // Task 1.2.3 will swap this out.
        return <Whiteboard />;
    }

    // --- FOUND STATE ---
    return <Whiteboard />;
};

export default BoardPage;
