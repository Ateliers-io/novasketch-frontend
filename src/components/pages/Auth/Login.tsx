import { useLayoutEffect, useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import gsap from 'gsap';
import { ArrowLeft, AlertCircle, Sparkles, Eye, EyeOff, Radio, Shield, Fingerprint, ChevronRight, Orbit, Check, X } from 'lucide-react';
import { useAuth } from '../../../contexts';

const REGEX = {
    name: /^[a-zA-Z][a-zA-Z0-9 _-]{1,29}$/,
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,64}$/,
};
const RULES = {
    name: 'Must be 2-30 chars, start with a letter',
    email: 'Enter a valid email address',
    password: 'Min 8 chars: uppercase, lowercase, digit & special char',
};

/* ── constellation ── */
const Stars = () => {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const c = ref.current!, gl = c.getContext('2d')!;
        let raf: number, w = (c.width = innerWidth), h = (c.height = innerHeight);
        const N = Math.min(100, ~~((w * h) / 12000));
        const pts = Array.from({ length: N }, () => ({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - .5) * .16, vy: (Math.random() - .5) * .16,
            r: Math.random() * 1.5 + .3, p: Math.random() * 6.28,
        }));
        const draw = () => {
            gl.fillStyle = 'rgba(11,12,16,.06)'; gl.fillRect(0, 0, w, h);
            const t = Date.now() * .001;
            for (let i = 0; i < N; i++) {
                const a = pts[i]; a.x += a.vx; a.y += a.vy;
                if (a.x < 0) a.x = w; if (a.x > w) a.x = 0;
                if (a.y < 0) a.y = h; if (a.y > h) a.y = 0;
                for (let j = i + 1; j < N; j++) {
                    const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < 130) { gl.strokeStyle = `rgba(102,252,241,${(1 - d / 130) * .09})`; gl.lineWidth = .35; gl.beginPath(); gl.moveTo(a.x, a.y); gl.lineTo(b.x, b.y); gl.stroke(); }
                }
                gl.beginPath(); gl.arc(a.x, a.y, a.r, 0, 6.283);
                gl.fillStyle = `rgba(102,252,241,${.2 + Math.sin(t + a.p) * .3})`; gl.fill();
            }
            raf = requestAnimationFrame(draw);
        }; draw();
        const rs = () => { w = c.width = innerWidth; h = c.height = innerHeight; };
        addEventListener('resize', rs);
        return () => { removeEventListener('resize', rs); cancelAnimationFrame(raf); };
    }, []);
    return <canvas ref={ref} className="fixed inset-0 z-0 pointer-events-none" style={{ opacity: .5 }} />;
};

/* ── social btn ── */
const GgI = () => <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>;

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
@keyframes nsBlink { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes nsOrbit { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
@keyframes nsFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
@keyframes nsMesh1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(15px,-20px) scale(1.08)} 66%{transform:translate(-10px,15px) scale(.95)} }
@keyframes nsMesh2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-20px,10px) scale(.92)} 66%{transform:translate(12px,-15px) scale(1.05)} }
.ns-inp:focus { border-color: rgba(102,252,241,.45) !important; box-shadow: 0 0 0 3px rgba(102,252,241,.06), 0 0 25px rgba(102,252,241,.04); background: rgba(31,40,51,.55) !important; }
@keyframes nsShimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
.ns-ghost { position:relative; z-index:1; overflow:hidden; }
.ns-ghost::before { content:''; position:absolute; top:0; left:0; width:100%; height:100%; background:linear-gradient(120deg, transparent 30%, rgba(255,255,255,.12) 50%, transparent 70%); transform:translateX(-100%); z-index:1; border-radius:inherit; pointer-events:none; }
.ns-ghost:hover::before { animation: nsShimmer .7s ease forwards; }
`;

export const Login = () => {
    const nav = useNavigate();
    const { loginWithGoogle, loginWithEmail, register, error, clearError, isAuthenticated, isLoading } = useAuth();

    const cardRef = useRef<HTMLDivElement>(null);
    const accentRef = useRef<HTMLDivElement>(null);
    const signUpRef = useRef<HTMLFormElement>(null);
    const signInRef = useRef<HTMLFormElement>(null);
    const accARef = useRef<HTMLDivElement>(null);
    const accBRef = useRef<HTMLDivElement>(null);

    const [mode, setMode] = useState<'up' | 'in'>('up');
    const [busy, setBusy] = useState(false);
    const [ldg, setLdg] = useState<string | null>(null);
    const [showPw, setShowPw] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    useEffect(() => { if (isAuthenticated) nav('/home', { replace: true }); }, [isAuthenticated, nav]);

    // Implementing Authorization Code Flow instead of Implicit Flow (deprecated).
    // The code is exchanged for a refresh token on the backend to maintain security.
    const googleLogin = useGoogleLogin({
        flow: 'auth-code',
        onSuccess: async (r) => { setLdg('g'); clearError(); try { await loginWithGoogle(r.code); } catch { } finally { setLdg(null); } },
        onError: () => setLdg(null),
    });

    const chg = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value } = e.target; setForm(p => ({ ...p, [name]: value })); if (!touched[name]) setTouched(t => ({ ...t, [name]: true })); };
    const onBlur = (e: React.FocusEvent<HTMLInputElement>) => setTouched(t => ({ ...t, [e.target.name]: true }));
    const validate = (f: string, v: string) => v ? (REGEX[f as keyof typeof REGEX]?.test(v) ?? true) : false;
    const isSignUpValid = validate('name', form.name) && validate('email', form.email) && validate('password', form.password);
    const isSignInValid = validate('email', form.email) && form.password.length >= 1;
    const fs = (f: string, v: string) => !touched[f] || !v ? 'border-white/[.07]' : validate(f, v) ? 'border-[#66FCF1]/40' : 'border-red-500/40';

    const handleSignUp = async (e: React.FormEvent) => { e.preventDefault(); if (!isSignUpValid || ldg) return; setLdg('register'); clearError(); try { await register(form.name.trim(), form.email.trim().toLowerCase(), form.password); } catch { } finally { setLdg(null); } };
    const handleSignIn = async (e: React.FormEvent) => { e.preventDefault(); if (!isSignInValid || ldg) return; setLdg('login'); clearError(); try { await loginWithEmail(form.email.trim().toLowerCase(), form.password); } catch { } finally { setLdg(null); } };

    const VIcon = ({ f, v }: { f: string; v: string }) => { if (!touched[f] || !v) return null; return validate(f, v) ? <Check className="w-3.5 h-3.5 text-[#66FCF1]/70" /> : <X className="w-3.5 h-3.5 text-red-400/70" />; };
    const Hint = ({ f, v }: { f: string; v: string }) => { if (!touched[f] || !v || validate(f, v)) return null; return <p className="mt-1 text-[10px] text-red-400/60 font-mono">{RULES[f as keyof typeof RULES]}</p>; };

    /* ── GSAP: slide accent panel left↔right ── */
    const toggle = useCallback(() => {
        if (busy) return; setBusy(true); clearError();
        setTouched({}); setForm({ name: '', email: '', password: '' }); setShowPw(false);
        const toIn = mode === 'up';

        const tl = gsap.timeline({ onComplete: () => { setMode(toIn ? 'in' : 'up'); setBusy(false); } });

        // 1. pulse card border
        tl.to(cardRef.current, { boxShadow: '0 0 60px rgba(102,252,241,.12), 0 0 0 1px rgba(102,252,241,.25), 0 40px 100px rgba(0,0,0,.5)', duration: .2 })
            // 2. fade out current form
            .to(toIn ? signUpRef.current : signInRef.current, { opacity: 0, duration: .2, ease: 'power2.in' }, '<')
            // 3. slide accent panel
            .to(accentRef.current, { left: toIn ? '55%' : '0%', duration: .55, ease: 'power3.inOut' })
            // 4. crossfade accent content during slide
            .to(toIn ? accARef.current : accBRef.current, { opacity: 0, scale: .92, duration: .18 }, '-=.4')
            .set(toIn ? accARef.current : accBRef.current, { display: 'none' })
            .set(toIn ? accBRef.current : accARef.current, { display: 'flex', opacity: 0, scale: .92 })
            .to(toIn ? accBRef.current : accARef.current, { opacity: 1, scale: 1, duration: .22 })
            // 5. hide old form, show new form
            .set(toIn ? signUpRef.current : signInRef.current, { visibility: 'hidden' })
            .set(toIn ? signInRef.current : signUpRef.current, { visibility: 'visible', opacity: 0 })
            .to(toIn ? signInRef.current : signUpRef.current, { opacity: 1, duration: .25, ease: 'power2.out' })
            // 6. settle card glow
            .to(cardRef.current, { boxShadow: '0 0 40px rgba(102,252,241,.05), 0 0 0 1px rgba(69,162,158,.12), 0 40px 100px rgba(0,0,0,.45)', duration: .3 }, '-=.15');
    }, [mode, busy, clearError]);

    /* ── entrance ── */
    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            gsap.set(signInRef.current, { visibility: 'hidden', opacity: 0 });
            gsap.set(accBRef.current, { display: 'none', opacity: 0 });
            gsap.set(accentRef.current, { left: '0%' });
            const tl = gsap.timeline({ delay: .2 });
            tl.fromTo(cardRef.current, { opacity: 0, y: 40, scale: .95 }, { opacity: 1, y: 0, scale: 1, duration: .9, ease: 'power4.out' })
                .fromTo('.ns-si', { opacity: 0, y: 12 }, { opacity: 1, y: 0, stagger: .035, duration: .3, ease: 'power2.out' }, '-=.4');
        });
        return () => ctx.revert();
    }, []);

    const ic = (extra = '') => `ns-inp w-full px-4 py-3 bg-[#1F2833]/40 border rounded-xl text-[.85rem] text-white/95 placeholder-white/25 outline-none transition-all duration-300 backdrop-blur-sm ${extra}`;

    const submitBtn = "w-full py-3 rounded-xl font-semibold text-[.82rem] uppercase tracking-[.12em] flex items-center justify-center gap-2 group transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-30 disabled:pointer-events-none";
    const btnStyle = { background: 'linear-gradient(135deg, #45A29E 0%, #66FCF1 50%, #45A29E 100%)', backgroundSize: '200% 200%', boxShadow: '0 4px 25px rgba(102,252,241,.12), 0 0 0 1px rgba(102,252,241,.1), inset 0 1px 0 rgba(255,255,255,.15)', color: '#0B0C10' };

    return (
        <>
            <style>{css}</style>
            <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center relative overflow-hidden p-4" style={{ fontFamily: "'Inter', sans-serif" }}>
                <Stars />
                <div className="fixed inset-0 z-[1] pointer-events-none opacity-[.012]" style={{ backgroundImage: 'linear-gradient(rgba(102,252,241,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(102,252,241,.4) 1px,transparent 1px)', backgroundSize: '80px 80px' }} />
                <div className="fixed z-[2] pointer-events-none rounded-full blur-[120px] opacity-15" style={{ width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(102,252,241,.18) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />

                <button onClick={() => nav('/')} className="fixed top-5 left-5 z-50 flex items-center gap-1.5 px-3 py-1.5 text-white/30 hover:text-[#66FCF1] rounded-lg border border-white/[.06] hover:border-[#66FCF1]/20 hover:bg-white/[.02] transition-all text-[10px] font-mono tracking-[.2em] uppercase group backdrop-blur-sm">
                    <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" /> back
                </button>

                {/* ═══ CARD ═══ */}
                <div ref={cardRef} className="relative z-10 w-full max-w-[960px] rounded-3xl overflow-hidden" style={{ opacity: 0, minHeight: 560, backdropFilter: 'blur(20px)', background: 'linear-gradient(135deg, rgba(15,17,24,.9) 0%, rgba(11,12,16,.94) 100%)', boxShadow: '0 0 40px rgba(102,252,241,.05), 0 0 0 1px rgba(69,162,158,.12), 0 40px 100px rgba(0,0,0,.45)' }}>
                    <div className="absolute inset-0 rounded-3xl pointer-events-none z-[1]" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04), inset 0 0 0 1px rgba(255,255,255,.02)' }} />

                    {/* ── SIGN UP FORM (right side) ── */}
                    <form ref={signUpRef} onSubmit={handleSignUp} className="absolute right-0 top-0 bottom-0 w-full md:w-[55%] flex items-center justify-center px-6 md:px-12 z-[5]">
                        <div className="w-full max-w-[360px]">
                            <div className="ns-si mb-6">
                                <div className="flex items-center gap-2.5 mb-3"><div className="w-9 h-9 rounded-xl bg-[#66FCF1]/[.08] border border-[#66FCF1]/15 flex items-center justify-center"><Sparkles className="w-[17px] h-[17px] text-[#66FCF1]" /></div><span className="text-[9px] font-semibold text-[#66FCF1]/40 tracking-[.25em] uppercase">NovaSketch</span></div>
                                <h1 className="text-[1.7rem] font-bold text-white tracking-tight">Create Account</h1>
                                <p className="text-[13px] text-white/45 mt-1">Start sketching ideas with your team</p>
                            </div>
                            <button type="button" onClick={() => gLogin()} disabled={!!ldg || isLoading} className="ns-si w-full mb-4 py-2.5 rounded-xl border border-white/[.08] bg-white/[.03] flex items-center justify-center gap-2.5 text-white/60 hover:text-white/90 hover:border-white/15 hover:bg-white/[.06] transition-all duration-300 disabled:opacity-30 disabled:pointer-events-none backdrop-blur-sm text-[.8rem] font-medium">
                                <GgI /> Continue with Google
                            </button>
                            <div className="ns-si flex items-center gap-3 mb-4"><div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[.08] to-transparent" /><span className="text-[8px] font-semibold text-white/20 tracking-[.15em] uppercase">or email</span><div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[.08] to-transparent" /></div>
                            {error && mode === 'up' && <div className="ns-si mb-3 p-2.5 bg-red-500/[.06] border border-red-500/15 rounded-xl flex items-center gap-2 text-red-400/80 text-xs"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}</div>}
                            <div className="ns-si mb-2"><div className="relative flex items-center"><input type="text" name="name" placeholder="Full name" value={form.name} onChange={chg} onBlur={onBlur} autoComplete="name" className={ic(`${fs('name', form.name)} pr-10`)} /><span className="absolute right-3.5 top-1/2 -translate-y-1/2"><VIcon f="name" v={form.name} /></span></div><Hint f="name" v={form.name} /></div>
                            <div className="ns-si mb-2"><div className="relative flex items-center"><input type="email" name="email" placeholder="Email address" value={form.email} onChange={chg} onBlur={onBlur} autoComplete="email" className={ic(`${fs('email', form.email)} pr-10`)} /><span className="absolute right-3.5 top-1/2 -translate-y-1/2"><VIcon f="email" v={form.email} /></span></div><Hint f="email" v={form.email} /></div>
                            <div className="ns-si mb-4"><div className="relative flex items-center"><input type={showPw ? 'text' : 'password'} name="password" placeholder="Password" value={form.password} onChange={chg} onBlur={onBlur} autoComplete="new-password" className={ic(`${fs('password', form.password)} pr-[4.5rem]`)} /><div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2"><VIcon f="password" v={form.password} /><button type="button" onClick={() => setShowPw(!showPw)} className="text-white/25 hover:text-[#66FCF1] transition-colors">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div><Hint f="password" v={form.password} /></div>
                            <button type="submit" className={`ns-si ${submitBtn}`} disabled={!isSignUpValid || !!ldg || isLoading} style={btnStyle}>{ldg === 'register' ? <><Radio className="w-4 h-4 animate-spin" /> Creating...</> : <>Sign Up <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>}</button>
                            <div className="ns-si mt-5 pt-3 border-t border-white/[.05] flex items-center justify-between"><div className="flex items-center gap-1.5 text-[8px] text-white/20 tracking-[.12em] font-mono"><Shield className="w-3 h-3" /> 256-BIT ENCRYPTED</div><div className="flex items-center gap-1.5 text-[8px] text-white/20 tracking-[.12em] font-mono"><div className="w-1 h-1 rounded-full bg-[#66FCF1]/50 animate-pulse" /> LIVE</div></div>
                            <button type="button" onClick={toggle} disabled={busy} className="md:hidden mt-4 w-full text-center text-xs text-white/40 hover:text-[#66FCF1]">Already have an account? <span className="text-[#66FCF1]/80 font-medium">Sign In →</span></button>
                        </div>
                    </form>

                    {/* ── SIGN IN FORM (left side) ── */}
                    <form ref={signInRef} onSubmit={handleSignIn} className="absolute left-0 top-0 bottom-0 w-full md:w-[55%] flex items-center justify-center px-6 md:px-12 z-[5]" style={{ visibility: 'hidden', opacity: 0 }}>
                        <div className="w-full max-w-[360px]">
                            <div className="mb-6">
                                <div className="flex items-center gap-2.5 mb-3"><div className="w-9 h-9 rounded-xl bg-[#66FCF1]/[.08] border border-[#66FCF1]/15 flex items-center justify-center"><Fingerprint className="w-[17px] h-[17px] text-[#66FCF1]" /></div><span className="text-[9px] font-semibold text-[#66FCF1]/40 tracking-[.25em] uppercase">NovaSketch</span></div>
                                <h1 className="text-[1.7rem] font-bold text-white tracking-tight">Sign In</h1>
                                <p className="text-[13px] text-white/45 mt-1">Pick up where you left off</p>
                            </div>
                            <button type="button" onClick={() => gLogin()} disabled={!!ldg || isLoading} className="w-full mb-4 py-2.5 rounded-xl border border-white/[.08] bg-white/[.03] flex items-center justify-center gap-2.5 text-white/60 hover:text-white/90 hover:border-white/15 hover:bg-white/[.06] transition-all duration-300 disabled:opacity-30 disabled:pointer-events-none backdrop-blur-sm text-[.8rem] font-medium">
                                <GgI /> Continue with Google
                            </button>
                            <div className="flex items-center gap-3 mb-4"><div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[.08] to-transparent" /><span className="text-[8px] font-semibold text-white/20 tracking-[.15em] uppercase">or email</span><div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[.08] to-transparent" /></div>
                            {error && mode === 'in' && <div className="mb-3 p-2.5 bg-red-500/[.06] border border-red-500/15 rounded-xl flex items-center gap-2 text-red-400/80 text-xs"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}</div>}
                            <div className="mb-2"><div className="relative flex items-center"><input type="email" name="email" placeholder="Email address" value={form.email} onChange={chg} onBlur={onBlur} autoComplete="email" className={ic(`${fs('email', form.email)} pr-10`)} /><span className="absolute right-3.5 top-1/2 -translate-y-1/2"><VIcon f="email" v={form.email} /></span></div><Hint f="email" v={form.email} /></div>
                            <div className="mb-2"><div className="relative flex items-center"><input type={showPw ? 'text' : 'password'} name="password" placeholder="Password" value={form.password} onChange={chg} onBlur={onBlur} autoComplete="current-password" className={ic('border-white/[.07] pr-11')} /><button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-[#66FCF1] transition-colors">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
                            <div className="mb-4 text-right"><button type="button" className="text-[11px] text-[#66FCF1]/40 hover:text-[#66FCF1] transition-colors font-medium">Forgot password?</button></div>
                            <button type="submit" className={submitBtn} disabled={!isSignInValid || !!ldg || isLoading} style={btnStyle}>{ldg === 'login' ? <><Radio className="w-4 h-4 animate-spin" /> Authenticating...</> : <>Sign In <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>}</button>
                            <div className="mt-5 pt-3 border-t border-white/[.05] flex items-center justify-between"><div className="flex items-center gap-1.5 text-[8px] text-white/20 tracking-[.12em] font-mono"><Shield className="w-3 h-3" /> SECURE SESSION</div><div className="flex items-center gap-1.5 text-[8px] text-white/20 tracking-[.12em] font-mono"><div className="w-1 h-1 rounded-full bg-[#66FCF1]/50 animate-pulse" /> ONLINE</div></div>
                            <button type="button" onClick={toggle} disabled={busy} className="md:hidden mt-4 w-full text-center text-xs text-white/40 hover:text-[#66FCF1]">Don't have an account? <span className="text-[#66FCF1]/80 font-medium">Sign Up →</span></button>
                        </div>
                    </form>

                    {/* ═══ ACCENT PANEL — slides left↔right ═══ */}
                    <div ref={accentRef} className="hidden md:flex absolute top-0 bottom-0 w-[45%] z-[15] items-center justify-center overflow-hidden" style={{ left: '0%', background: 'linear-gradient(155deg, #0a192f 0%, #0f2f44 30%, #184858 55%, #1d6b6b 80%, #45A29E 100%)' }}>
                        {/* mesh blobs */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute w-[260px] h-[260px] rounded-full opacity-25 blur-[80px]" style={{ background: 'radial-gradient(circle, #66FCF1 0%, transparent 70%)', top: '8%', left: '15%', animation: 'nsMesh1 12s ease-in-out infinite' }} />
                            <div className="absolute w-[200px] h-[200px] rounded-full opacity-20 blur-[70px]" style={{ background: 'radial-gradient(circle, #45A29E 0%, transparent 70%)', bottom: '12%', right: '8%', animation: 'nsMesh2 10s ease-in-out infinite 2s' }} />
                            <div className="absolute w-[140px] h-[140px] rounded-full opacity-15 blur-[60px]" style={{ background: 'radial-gradient(circle, #66FCF1 0%, transparent 70%)', top: '50%', left: '-5%', animation: 'nsMesh1 14s ease-in-out infinite 4s' }} />
                        </div>
                        {/* orbital rings */}
                        <div className="absolute w-[280px] h-[280px] rounded-full border border-white/[.04] pointer-events-none" style={{ animation: 'nsOrbit 28s linear infinite', top: '50%', left: '50%', marginTop: -140, marginLeft: -140 }}><div className="absolute -top-1 left-1/2 w-1.5 h-1.5 rounded-full bg-[#66FCF1]/30 -ml-[3px]" /></div>
                        <div className="absolute w-[180px] h-[180px] rounded-full border border-white/[.03] border-dashed pointer-events-none" style={{ animation: 'nsOrbit 20s linear infinite reverse', top: '50%', left: '50%', marginTop: -90, marginLeft: -90 }}><div className="absolute -bottom-1 left-1/2 w-1 h-1 rounded-full bg-[#66FCF1]/20 -ml-[2px]" /></div>
                        {/* floating shapes */}
                        <div className="absolute top-[14%] right-[14%] w-14 h-14 border border-white/[.04] rounded-2xl rotate-45 pointer-events-none" style={{ animation: 'nsFloat 7s ease-in-out infinite' }} />
                        <div className="absolute bottom-[18%] left-[12%] w-9 h-9 border border-white/[.05] rounded-lg rotate-12 pointer-events-none" style={{ animation: 'nsFloat 5s ease-in-out infinite 1.5s' }} />
                        {/* corner labels */}
                        <div className="absolute top-4 left-5 flex items-center gap-1.5 text-[7px] font-mono text-white/20 tracking-[.15em] z-20"><Orbit className="w-2.5 h-2.5" /> NOVA://AUTH</div>
                        <div className="absolute bottom-4 left-5 text-[7px] font-mono text-white/15 z-20"><div>$ session.init()</div><div className="text-[#66FCF1]/30">→ ready</div></div>
                        <div className="absolute bottom-4 right-5 text-[7px] font-mono text-white/15 z-20">v2.1 — {new Date().getFullYear()}</div>
                        {/* inner edge */}
                        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset -1px 0 0 rgba(255,255,255,.04), inset 1px 0 0 rgba(255,255,255,.04), inset 0 1px 0 rgba(255,255,255,.05)' }} />

                        {/* ── Content A: "Hello Friend" (shown in Sign Up mode) ── */}
                        <div ref={accARef} className="relative z-10 text-center px-10 max-w-[300px] flex flex-col items-center">
                            <div className="w-14 h-14 mb-5 rounded-2xl border border-white/[.1] bg-white/[.06] backdrop-blur-md flex items-center justify-center shadow-lg" style={{ animation: 'nsFloat 6s ease-in-out infinite' }}><Sparkles className="w-7 h-7 text-white/80" /></div>
                            <h2 className="text-[1.65rem] font-bold text-white tracking-tight mb-2 leading-tight">Hello, Friend!</h2>
                            <p className="text-[13px] text-white/55 leading-relaxed mb-2 italic">"Creativity takes courage."</p>
                            <p className="text-[11px] text-white/30 mb-6">— Henri Matisse</p>
                            <p className="text-[12px] text-white/50 leading-relaxed mb-6">Already have an account? Sign in and get back to creating amazing things.</p>
                            <button type="button" onClick={toggle} disabled={busy} className="ns-ghost px-9 py-2.5 rounded-full border-2 border-white/25 text-white text-[10.5px] font-semibold uppercase tracking-[.18em] bg-transparent hover:bg-white/[.08] hover:border-white/40 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-40 backdrop-blur-sm">Sign In</button>
                        </div>

                        {/* ── Content B: "Welcome Back" (shown in Sign In mode) ── */}
                        <div ref={accBRef} className="relative z-10 text-center px-10 max-w-[300px] flex flex-col items-center" style={{ display: 'none' }}>
                            <div className="w-14 h-14 mb-5 rounded-2xl border border-white/[.1] bg-white/[.06] backdrop-blur-md flex items-center justify-center shadow-lg" style={{ animation: 'nsFloat 6s ease-in-out infinite' }}><Fingerprint className="w-7 h-7 text-white/80" /></div>
                            <h2 className="text-[1.65rem] font-bold text-white tracking-tight mb-2 leading-tight">Welcome Back!</h2>
                            <p className="text-[13px] text-white/55 leading-relaxed mb-2 italic">"Every artist was first an amateur."</p>
                            <p className="text-[11px] text-white/30 mb-6">— Ralph Waldo Emerson</p>
                            <p className="text-[12px] text-white/50 leading-relaxed mb-6">Don't have an account yet? Join NovaSketch and start collaborating in seconds.</p>
                            <button type="button" onClick={toggle} disabled={busy} className="ns-ghost px-9 py-2.5 rounded-full border-2 border-white/25 text-white text-[10.5px] font-semibold uppercase tracking-[.18em] bg-transparent hover:bg-white/[.08] hover:border-white/40 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-40 backdrop-blur-sm">Sign Up</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;