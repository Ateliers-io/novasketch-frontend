import { useLayoutEffect, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Sparkles, Layers, Users, Lock, Pencil,
  MousePointer2, ArrowRight, Share2, Palette,
  Zap, Globe, Download
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// ═══════════════════════════════════════════════════════════════════════════════
// NOVASKETCH LANDING PAGE
// Modern, Clean Design for Collaborative Whiteboard
// ═══════════════════════════════════════════════════════════════════════════════

// --- FLOATING SHAPES BACKGROUND ---
const FloatingShapesBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    // Floating shapes
    const shapes: { x: number; y: number; vx: number; vy: number; size: number; type: 'circle' | 'square' | 'triangle'; rotation: number; color: string }[] = [];
    const colors = ['rgba(102, 252, 241, 0.15)', 'rgba(69, 162, 158, 0.12)', 'rgba(236, 72, 153, 0.1)', 'rgba(99, 102, 241, 0.12)'];

    for (let i = 0; i < 15; i++) {
      shapes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 60 + 30,
        type: ['circle', 'square', 'triangle'][Math.floor(Math.random() * 3)] as any,
        rotation: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, w, h);

      shapes.forEach(shape => {
        shape.x += shape.vx;
        shape.y += shape.vy;
        shape.rotation += 0.002;

        if (shape.x < -100) shape.x = w + 100;
        if (shape.x > w + 100) shape.x = -100;
        if (shape.y < -100) shape.y = h + 100;
        if (shape.y > h + 100) shape.y = -100;

        ctx.save();
        ctx.translate(shape.x, shape.y);
        ctx.rotate(shape.rotation);
        ctx.fillStyle = shape.color;

        if (shape.type === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, shape.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (shape.type === 'square') {
          ctx.fillRect(-shape.size / 2, -shape.size / 2, shape.size, shape.size);
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -shape.size / 2);
          ctx.lineTo(shape.size / 2, shape.size / 2);
          ctx.lineTo(-shape.size / 2, shape.size / 2);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
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

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 opacity-40 pointer-events-none" />;
};

// --- PRODUCT PREVIEW COMPONENT ---
const ProductPreview = () => {
  return (
    <div className="preview-window w-full max-w-5xl mx-auto rounded-2xl overflow-hidden border border-gray-700/50 bg-[#1a1d24] shadow-2xl shadow-black/50 relative">

      {/* Window Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-[#12141a]">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="text-xs text-gray-400 flex items-center gap-2">
          <span>Team Project - Brainstorm Session</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            3 online
          </div>
        </div>
      </div>

      {/* Canvas Content */}
      <div className="flex h-[400px] relative">
        {/* Sidebar */}
        <div className="w-14 border-r border-gray-700/50 bg-[#12141a] flex flex-col items-center py-4 gap-3">
          {[MousePointer2, Pencil, Layers, Share2].map((Icon, i) => (
            <div key={i} className={`p-2.5 rounded-lg transition-all ${i === 1 ? 'bg-[#66FCF1] text-black' : 'text-gray-500 hover:bg-gray-700/50 hover:text-gray-300'}`}>
              <Icon size={18} />
            </div>
          ))}
        </div>

        {/* Drawing Area */}
        <div className="flex-1 relative overflow-hidden bg-[#1a1d24]" style={{
          backgroundImage: 'radial-gradient(circle, rgba(102, 252, 241, 0.03) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}>

          {/* Sample Elements */}
          <div className="canvas-elem absolute top-[15%] left-[10%] w-52 h-36 border-2 border-[#66FCF1] rounded-xl bg-[#66FCF1]/5 flex items-center justify-center p-4">
            <span className="text-[#66FCF1] text-sm font-medium text-center">User Research Findings</span>
          </div>

          <div className="canvas-elem absolute top-[45%] left-[35%] w-28 h-28 border-2 border-pink-400 rounded-full bg-pink-400/10 flex items-center justify-center">
            <Palette className="text-pink-400 w-8 h-8" />
          </div>

          <div className="canvas-elem absolute top-[60%] left-[55%] px-6 py-4 border border-indigo-400/50 bg-indigo-500/10 rounded-xl">
            <span className="text-indigo-300 font-medium">Design Sprint 🎨</span>
          </div>

          {/* Connection Lines */}
          <svg className="absolute inset-0 pointer-events-none">
            <path d="M 250 130 Q 320 200 350 260" fill="none" stroke="#66FCF1" strokeWidth="2" strokeDasharray="6,4" opacity="0.5" />
            <path d="M 400 310 Q 480 340 550 360" fill="none" stroke="#ec4899" strokeWidth="2" opacity="0.5" />
          </svg>

          {/* Live Cursors */}
          <div className="live-cursor absolute top-[25%] left-[25%] pointer-events-none z-20">
            <MousePointer2 className="w-4 h-4 fill-[#66FCF1] text-[#66FCF1] transform -rotate-12" />
            <span className="ml-3 px-2 py-0.5 bg-[#66FCF1] text-black text-[10px] font-semibold rounded-full">Alex</span>
          </div>

          <div className="live-cursor absolute top-[55%] left-[45%] pointer-events-none z-20">
            <MousePointer2 className="w-4 h-4 fill-pink-400 text-pink-400 transform -rotate-12" />
            <span className="ml-3 px-2 py-0.5 bg-pink-400 text-white text-[10px] font-semibold rounded-full">Maya</span>
          </div>

          {/* User Avatars */}
          <div className="absolute top-4 right-4 flex -space-x-2">
            {['A', 'M', 'J'].map((initial, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-[#1a1d24] flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: ['#6366f1', '#ec4899', '#f59e0b'][i] }}>
                {initial}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

// --- FEATURES DATA ---
const FEATURES = [
  {
    id: 1,
    title: "Infinite Canvas",
    desc: "Unlimited space for your ideas. Zoom, pan, and navigate freely across an endless creative workspace.",
    icon: Layers,
    color: "text-[#66FCF1]",
    bg: "bg-[#66FCF1]/10"
  },
  {
    id: 2,
    title: "Real-time Collaboration",
    desc: "Work together with your team in real-time. See changes instantly as they happen.",
    icon: Users,
    color: "text-pink-400",
    bg: "bg-pink-400/10"
  },
  {
    id: 3,
    title: "Drawing Tools",
    desc: "Shapes, freehand drawing, text, arrows, and sticky notes - everything you need to express your ideas.",
    icon: Pencil,
    color: "text-indigo-400",
    bg: "bg-indigo-400/10"
  },
  {
    id: 4,
    title: "Secure & Private",
    desc: "Your work is encrypted and secure. Control who can view and edit your boards.",
    icon: Lock,
    color: "text-amber-400",
    bg: "bg-amber-400/10"
  }
];

export const Landing = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {

      // Hero entrance
      gsap.from(".hero-element", {
        y: 50,
        opacity: 0,
        duration: 1,
        stagger: 0.15,
        ease: "power3.out"
      });

      // Preview animation
      gsap.from(previewRef.current, {
        scrollTrigger: {
          trigger: previewRef.current,
          start: "top 85%",
        },
        y: 80,
        opacity: 0,
        duration: 1,
        ease: "power2.out"
      });

      // Live cursor movement
      gsap.to(".live-cursor", {
        x: "random(-80, 80)",
        y: "random(-40, 40)",
        duration: 4,
        ease: "sine.inOut",
        repeat: -1,
        repeatRefresh: true,
        yoyo: true
      });

      // Canvas elements
      gsap.from(".canvas-elem", {
        scrollTrigger: {
          trigger: previewRef.current,
          start: "top 80%",
        },
        scale: 0,
        opacity: 0,
        duration: 0.6,
        stagger: 0.15,
        ease: "back.out(1.5)"
      });

      // Feature cards
      ScrollTrigger.batch(".feature-card", {
        onEnter: (elements) => {
          gsap.fromTo(elements,
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "power2.out" }
          );
        },
        once: true
      });

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0B0C10] text-gray-100 font-sans overflow-x-hidden">

      {/* Background */}
      <FloatingShapesBackground />

      {/* Gradient Overlays */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#66FCF1] rounded-full mix-blend-overlay filter blur-[150px] opacity-[0.05]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-pink-500 rounded-full mix-blend-overlay filter blur-[150px] opacity-[0.05]" />
      </div>

      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 w-full z-50 bg-[#0B0C10]/80 backdrop-blur-lg border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#66FCF1]" />
            <span className="font-bold text-xl text-white">NovaSketch</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/home')}
              className="px-5 py-2 rounded-lg bg-[#66FCF1] hover:bg-[#45A29E] text-black text-sm font-semibold transition-all"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-32 pb-24 px-6 max-w-6xl mx-auto">

        {/* --- HERO SECTION --- */}
        <section className="mb-24 text-center">
          <div className="hero-element inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#66FCF1]/30 bg-[#66FCF1]/10 mb-8">
            <Zap className="w-4 h-4 text-[#66FCF1]" />
            <span className="text-sm text-[#66FCF1] font-medium">Collaborative Whiteboard for Teams</span>
          </div>

          <h1 className="hero-element text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Sketch Ideas,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#66FCF1] to-pink-400">
              Together
            </span>
          </h1>

          <p className="hero-element max-w-2xl mx-auto text-lg text-gray-400 mb-10 leading-relaxed">
            A real-time collaborative whiteboard that helps teams brainstorm, design, and plan together.
            Simple, fast, and beautifully designed.
          </p>

          <div className="hero-element flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => navigate('/board/demo')}
              className="group h-12 px-8 rounded-xl bg-[#66FCF1] hover:bg-white text-black font-semibold flex items-center gap-2 transition-all shadow-lg shadow-[#66FCF1]/20"
            >
              Try Demo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/home')}
              className="h-12 px-8 rounded-xl border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-medium transition-all flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              Sign Up Free
            </button>
          </div>
        </section>

        {/* --- PRODUCT PREVIEW --- */}
        <section ref={previewRef} className="mb-32">
          <ProductPreview />
        </section>

        {/* --- FEATURES --- */}
        <section className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything you need</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Powerful features designed for seamless collaboration and creativity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feat) => (
              <div
                key={feat.id}
                className="feature-card p-8 rounded-2xl border border-gray-800 bg-gray-900/50 hover:bg-gray-800/50 hover:border-gray-700 transition-all group"
              >
                <div className={`inline-flex p-3 rounded-xl ${feat.bg} mb-6`}>
                  <feat.icon className={`w-6 h-6 ${feat.color}`} />
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">{feat.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- CTA SECTION --- */}
        <section className="text-center py-16 px-8 rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to start sketching?</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">Join thousands of teams using NovaSketch to collaborate and create.</p>
          <button
            onClick={() => navigate('/home')}
            className="h-12 px-8 rounded-xl bg-[#66FCF1] hover:bg-white text-black font-semibold transition-all shadow-lg shadow-[#66FCF1]/20"
          >
            Get Started for Free
          </button>
        </section>

      </main>

      {/* --- FOOTER --- */}
      <footer className="relative z-10 border-t border-gray-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>NovaSketch © 2026</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Terms</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;