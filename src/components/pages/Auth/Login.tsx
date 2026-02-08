import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import gsap from 'gsap';
import {
    ShieldCheck,
    Chrome,
    User,
    ArrowLeft,
    Cpu,
    Wifi,
    AlertCircle,
    Terminal,
    Radio,
    Activity,
    Sparkles
} from 'lucide-react';
import { useAuth } from '../../../contexts';

// NOVASKETCH - LOGIN PORTAL

// --- ANIMATED CONSTELLATION BACKGROUND ---
const ConstellationBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;

        // Stars
        const stars: { x: number; y: number; vx: number; vy: number; radius: number; brightness: number }[] = [];
        const starCount = Math.min(80, Math.floor((w * h) / 15000));

        for (let i = 0; i < starCount; i++) {
            stars.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                radius: Math.random() * 1.5 + 0.5,
                brightness: Math.random()
            });
        }

        const render = () => {
            ctx.fillStyle = 'rgba(11, 12, 16, 0.08)';
            ctx.fillRect(0, 0, w, h);

            const time = Date.now() * 0.001;

            stars.forEach((star, i) => {
                star.x += star.vx;
                star.y += star.vy;
                star.brightness = 0.3 + Math.sin(time + i) * 0.3;

                if (star.x < 0) star.x = w;
                if (star.x > w) star.x = 0;
                if (star.y < 0) star.y = h;
                if (star.y > h) star.y = 0;

                // Draw connections (constellation lines)
                stars.forEach((other, j) => {
                    if (i >= j) return;
                    const dx = star.x - other.x;
                    const dy = star.y - other.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 120) {
                        ctx.strokeStyle = `rgba(102, 252, 241, ${(1 - dist / 120) * 0.15})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(star.x, star.y);
                        ctx.lineTo(other.x, other.y);
                        ctx.stroke();
                    }
                });

                // Draw star
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(102, 252, 241, ${star.brightness})`;
                ctx.fill();
            });

            animationId = requestAnimationFrame(render);
        };

        render();

        const handleResize = () => {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationId);
        };
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 z-0 opacity-60 pointer-events-none" />;
};

// --- STATUS INDICATOR ---
const StatusIndicator = ({ label, status }: { label: string; status: 'online' | 'idle' }) => (
    <div className="flex items-center gap-2 text-[10px] font-mono text-[#45A29E]/70 uppercase tracking-wider">
        <div className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-500 shadow-green-500/50' : 'bg-gray-500'} shadow-lg`} />
        <span>{label}</span>
    </div>
);

// --- MAIN LOGIN COMPONENT ---
export const Login = () => {
    const navigate = useNavigate();
    const { loginWithGoogle, error, clearError, isAuthenticated, isLoading } = useAuth();

    const panelRef = useRef<HTMLDivElement>(null);
    const [loadingMethod, setLoadingMethod] = useState<string | null>(null);

    // Redirect if authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/home', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    // Google OAuth hook - uses authorization code flow
    const googleLogin = useGoogleLogin({
        flow: 'auth-code',
        onSuccess: async (codeResponse) => {
            setLoadingMethod('google');
            clearError();
            try {
                // Send auth code to backend to exchange for id_token
                await loginWithGoogle(codeResponse.code);
            } catch (err) {
                console.error('Google auth failed:', err);
            } finally {
                setLoadingMethod(null);
            }
        },
        onError: (errorResponse) => {
            console.error('Google login error:', errorResponse);
            setLoadingMethod(null);
        },
    });

    // --- GSAP ENTRANCE ANIMATION ---
    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline();

            // Panel entrance
            tl.fromTo(panelRef.current,
                { opacity: 0, y: 40, scale: 0.95 },
                { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out' }
            )
                .fromTo('.logo-icon',
                    { scale: 0, rotate: -180 },
                    { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(2)' },
                    '-=0.4'
                )
                .fromTo('.login-title',
                    { opacity: 0, y: 20 },
                    { opacity: 1, y: 0, duration: 0.5 },
                    '-=0.3'
                )
                .fromTo('.auth-button',
                    { opacity: 0, x: -20 },
                    { opacity: 1, x: 0, duration: 0.4, stagger: 0.1, ease: 'power2.out' },
                    '-=0.2'
                );
        });

        return () => ctx.revert();
    }, []);

    return (
        <div className="min-h-screen bg-[#0B0C10] text-[#C5C6C7] font-sans flex items-center justify-center relative overflow-hidden">

            {/* Constellation Background */}
            <ConstellationBackground />

            {/* Subtle Grid */}
            <div
                className="fixed inset-0 z-[1] pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage: 'linear-gradient(rgba(102, 252, 241, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(102, 252, 241, 0.4) 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                }}
            />

            {/* Back Button */}
            <button
                onClick={() => navigate('/')}
                className="fixed top-6 left-6 z-40 flex items-center gap-2 px-3 py-2 text-[#45A29E] hover:text-[#66FCF1] hover:bg-[#1F2833]/50 rounded border border-transparent hover:border-[#45A29E]/30 transition-all font-mono text-xs tracking-widest group"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                BACK
            </button>

            {/* === MAIN LOGIN PANEL === */}
            <div ref={panelRef} className="relative w-full max-w-md mx-4 z-10">

                {/* Glow Effect */}
                <div className="absolute -inset-2 bg-gradient-to-br from-[#66FCF1]/10 via-transparent to-[#45A29E]/10 rounded-2xl blur-2xl" />

                {/* Panel Container */}
                <div className="relative bg-[#0B0C10]/95 backdrop-blur-xl border border-[#45A29E]/30 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">

                    {/* Top Accent Bar */}
                    <div className="h-1 bg-gradient-to-r from-[#45A29E] via-[#66FCF1] to-[#45A29E]" />

                    <div className="p-8 md:p-10">

                        {/* === HEADER === */}
                        <div className="text-center mb-10">
                            <div className="logo-icon inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1F2833] to-[#0B0C10] border border-[#45A29E]/30 mb-6 shadow-lg shadow-[#66FCF1]/10">
                                <Sparkles className="w-10 h-10 text-[#66FCF1]" />
                            </div>
                            <h1 className="login-title text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
                                NovaSketch
                            </h1>
                            <p className="login-title text-sm text-[#45A29E]">
                                Collaborative Whiteboard
                            </p>
                        </div>

                        {/* === ERROR === */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-300">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        {/* === AUTH BUTTONS === */}
                        <div className="space-y-4">

                            {/* GOOGLE */}
                            <button
                                onClick={() => googleLogin()}
                                disabled={!!loadingMethod}
                                className="auth-button group w-full h-14 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-xl flex items-center justify-center gap-3 transition-all hover:shadow-lg hover:shadow-white/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loadingMethod === 'google' ? (
                                    <>
                                        <Radio className="w-5 h-5 animate-spin" />
                                        <span>Connecting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Chrome className="w-5 h-5" />
                                        <span>Continue with Google</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* === FOOTER === */}
                        <div className="mt-10 pt-6 border-t border-[#1F2833] flex justify-between items-center">
                            <StatusIndicator label="Secure" status="online" />
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#45A29E]/40">
                                <Terminal className="w-3 h-3" />
                                <span>v2.0</span>
                            </div>
                            <StatusIndicator label="Online" status="online" />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;