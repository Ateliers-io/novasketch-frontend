import React, { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { 
  Zap, Layers, WifiOff, ShieldCheck, Command, 
  MousePointer2, GitBranch, Database, ArrowRight, 
  Code2, Terminal, Activity, Scan
} from 'lucide-react';

// Register GSAP Plugin
gsap.registerPlugin(ScrollTrigger);

/* --- HELPER COMPONENTS --- */

function DownloadIcon({ className }: { className?: string }) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <span className="px-2 py-1 rounded bg-[#1a2026] border border-[#262e35] text-[10px] font-mono text-gray-400">.SVG</span>
      <span className="px-2 py-1 rounded bg-[#1a2026] border border-[#262e35] text-[10px] font-mono text-gray-400">.PDF</span>
    </div>
  );
}

/* --- PRODUCT PREVIEW COMPONENT (The "Mecha" Window) --- */
const ProductPreview = () => {
  return (
    <div className="preview-window w-full max-w-5xl mx-auto rounded-xl overflow-hidden border border-[#45A29E]/30 bg-[#1F2833]/80 backdrop-blur-md shadow-[0_0_50px_rgba(102,252,241,0.1)] relative group">
      
      {/* Anime HUD Decorations */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#66FCF1] to-transparent opacity-50"></div>
      <div className="absolute bottom-2 right-4 font-mono text-[10px] text-[#45A29E] tracking-widest opacity-60">SYSTEM_SYNC_RATE: 99.8%</div>
      <div className="absolute top-12 left-4 w-1 h-12 bg-[#66FCF1]/20 hidden md:block"></div>

      {/* Window Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#45A29E]/20 bg-[#0B0C10]/50">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-[0_0_10px_#ff5f56]"></div>
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[0_0_10px_#ffbd2e]"></div>
          <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-[0_0_10px_#27c93f]"></div>
        </div>
        <div className="font-mono text-xs text-[#66FCF1] tracking-widest flex items-center gap-2">
          <Scan size={12} />
          WORKSPACE // TEAM_ALPHA
        </div>
        <div className="px-3 py-1 rounded bg-[#45A29E]/20 text-[#66FCF1] text-[10px] font-bold border border-[#45A29E]/30">
          LIVE
        </div>
      </div>

      {/* Canvas Content */}
      <div className="flex h-[450px] relative">
        {/* Sidebar */}
        <div className="w-14 border-r border-[#45A29E]/20 bg-[#0B0C10]/80 flex flex-col items-center py-4 gap-4 z-10">
          {[MousePointer2, Layers, Zap, GitBranch].map((Icon, i) => (
            <div key={i} className={`p-2 rounded-lg transition-all ${i === 0 ? 'bg-[#66FCF1] text-black shadow-[0_0_15px_#66FCF1]' : 'text-[#45A29E] hover:bg-[#1F2833]'}`}>
              <Icon size={18} />
            </div>
          ))}
        </div>

        {/* The Drawing Area */}
        <div className="flex-1 relative overflow-hidden bg-[#0B0C10] bg-[radial-gradient(#1F2833_1px,transparent_1px)] [background-size:20px_20px]">
          
          {/* Animated Elements (Shapes) */}
          <div className="canvas-elem absolute top-[20%] left-[15%] w-48 h-32 border-2 border-[#66FCF1] rounded-xl bg-[#66FCF1]/5 backdrop-blur-sm flex items-center justify-center">
            <span className="font-mono text-[#66FCF1] text-xs">BACKEND_NODE</span>
          </div>
          
          <div className="canvas-elem absolute top-[50%] left-[40%] w-24 h-24 border-2 border-[#ec4899] rounded-full bg-[#ec4899]/5 flex items-center justify-center animate-pulse">
            <Activity className="text-[#ec4899]" />
          </div>

          <div className="canvas-elem absolute top-[65%] left-[60%] px-6 py-3 border border-[#45A29E] bg-[#1F2833] rounded-lg text-white font-bold shadow-lg">
            Brainstorm 🧠
          </div>

          {/* Connection Lines (SVG) */}
          <svg className="absolute inset-0 pointer-events-none opacity-50">
            <path d="M 260 160 Q 350 160 400 250" fill="none" stroke="#66FCF1" strokeWidth="2" strokeDasharray="5,5" />
            <path d="M 450 300 Q 500 350 600 350" fill="none" stroke="#ec4899" strokeWidth="2" />
          </svg>

          {/* Floating Cursors (Sarah & Mike) */}
          <div className="live-cursor absolute top-[30%] left-[30%] pointer-events-none z-20">
            <MousePointer2 className="fill-[#66FCF1] text-[#66FCF1] transform -rotate-12" />
            <span className="ml-4 px-2 py-0.5 bg-[#66FCF1] text-black text-[10px] font-bold rounded">Sarah</span>
          </div>

          <div className="live-cursor absolute top-[60%] left-[50%] pointer-events-none z-20">
            <MousePointer2 className="fill-[#ec4899] text-[#ec4899] transform -rotate-12" />
            <span className="ml-4 px-2 py-0.5 bg-[#ec4899] text-white text-[10px] font-bold rounded">Mike</span>
          </div>

          {/* User Avatars Top Right */}
          <div className="absolute top-4 right-4 flex -space-x-2">
            {['S', 'M', 'A'].map((initial, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0B0C10] flex items-center justify-center text-xs font-bold text-white shadow-lg" 
                   style={{ backgroundColor: ['#6366f1', '#ec4899', '#f59e0b'][i] }}>
                {initial}
              </div>
            ))}
            <div className="w-8 h-8 rounded-full border-2 border-[#0B0C10] bg-[#1F2833] flex items-center justify-center text-[10px] text-[#45A29E]">
              +5
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

/* --- DATA STRUCTURE --- */
const FEATURES = [
  {
    id: 1,
    title: "Infinite Canvas",
    desc: "A vector-based coordinate system that scales infinitely. Includes Mini-Map navigation and 10px grid snapping.",
    icon: Layers,
    isWide: true, 
    accent: "text-turquoise-400",
    borderColor: "hover:border-turquoise-400/50"
  },
  {
    id: 2,
    title: "Offline Resilient",
    desc: "Network drop? Changes queue locally in IndexedDB and auto-reconcile via CRDTs upon reconnection.",
    icon: WifiOff,
    isWide: false,
    accent: "text-rose-400",
    borderColor: "hover:border-rose-400/50"
  },
  {
    id: 3,
    title: "Session Control",
    desc: "Read-only modes, locked sessions, and cryptographic UUIDs ensure data sovereignty.",
    icon: ShieldCheck,
    isWide: false,
    accent: "text-amber-400",
    borderColor: "hover:border-amber-400/50"
  },
  {
    id: 4,
    title: "High-Fidelity Export",
    desc: "Generate production-ready assets instantly. Support for SVG (Vector), PNG (Raster), and PDF.",
    icon: DownloadIcon,
    isWide: true,
    accent: "text-turquoise-400",
    borderColor: "hover:border-turquoise-400/50"
  }
];

export const Landing = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const flowChartRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleStartSketching = () => {
    // TODO: Testing only - redirect to whiteboard component
    navigate(`/whiteboard`);
  };

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      
      // 1. Hero Text Glitch Entrance
      const tl = gsap.timeline({ delay: 0.2 }); 
      tl.from(".hero-element", {
        y: 40,
        opacity: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: "power4.out"
      });

      // 2. Product Preview "Deployment" Animation
      gsap.from(previewRef.current, {
        scrollTrigger: {
          trigger: previewRef.current,
          start: "top 80%",
        },
        rotateX: 45, // 3D Tilt effect
        opacity: 0,
        scale: 0.8,
        y: 100,
        duration: 1.5,
        ease: "elastic.out(1, 0.75)"
      });

      // 3. Live Cursor Autonomous Movement (Simulating AI Users)
      gsap.to(".live-cursor", {
        x: "random(-100, 100, 5)",
        y: "random(-50, 50, 5)",
        duration: 4,
        ease: "sine.inOut",
        repeat: -1,
        repeatRefresh: true,
        yoyo: true
      });

      // 4. Canvas Elements Pop-in
      gsap.from(".canvas-elem", {
        scrollTrigger: {
          trigger: previewRef.current,
          start: "top 70%",
        },
        scale: 0,
        opacity: 0,
        duration: 0.6,
        stagger: 0.2,
        ease: "back.out(1.7)"
      });

      // 5. Flow Chart Packets
      gsap.to(".packet-left", { attr: { cx: "50%" }, duration: 1.5, repeat: -1, ease: "none", opacity: 0 });
      gsap.to(".packet-right", { attr: { cx: "75%" }, duration: 1.5, repeat: -1, ease: "none", delay: 0.75, opacity: 0 });

      // 6. Feature Cards Batch
      ScrollTrigger.batch(".feature-card", {
        onEnter: (elements) => {
          gsap.fromTo(elements, 
            { y: 60, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: "back.out(1.2)", overwrite: true }
          );
        },
        once: true 
      });

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0B0C10] text-[#C5C6C7] font-sans selection:bg-[#66FCF1] selection:text-[#0B0C10] overflow-x-hidden perspective-1000">
      
      {/* --- ANIME-STYLE BACKGROUND LAYERS --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Hex Grid Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill-opacity='0.2' fill='%2366FCF1' fill-rule='evenodd'/%3E%3C/svg%3E")`, 
          }} 
        />
        {/* Deep Glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-[#66FCF1] rounded-full mix-blend-overlay filter blur-[150px] opacity-[0.07]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#45A29E] rounded-full mix-blend-screen filter blur-[120px] opacity-[0.1]" />
      </div>

      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 w-full z-50 border-b border-[#45A29E]/20 bg-[#0B0C10]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#66FCF1]">
            <Terminal className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight text-white">NOVA<span className="text-[#66FCF1]">SKETCH</span></span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/auth')} className="text-sm font-medium text-[#C5C6C7] hover:text-[#66FCF1] transition-colors tracking-wide">
              TERMINAL LOGON
            </button>
            <button 
              onClick={handleStartSketching}
              className="px-5 py-2 rounded bg-[#45A29E] hover:bg-[#66FCF1] text-[#0B0C10] text-sm font-bold transition-all shadow-[0_0_15px_rgba(102,252,241,0.4)] hover:shadow-[0_0_30px_rgba(102,252,241,0.6)] uppercase tracking-wider"
            >
              Initialize Link
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto">
        
        {/* --- HERO SECTION --- */}
        <section className="mb-24 text-center md:text-left">
          <div className="hero-element inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-[#66FCF1]/30 bg-[#66FCF1]/10 mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#66FCF1] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#66FCF1]"></span>
            </span>
            <span className="text-xs font-mono text-[#66FCF1] tracking-[0.2em] font-bold">SYSTEM STATUS: ONLINE</span>
          </div>

          <h1 className="hero-element text-5xl md:text-8xl font-black tracking-tighter text-white mb-8 leading-[0.9]">
            SYNCHRONIZE <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#66FCF1] via-[#45A29E] to-white animate-text-shimmer">
              YOUR THOUGHTS.
            </span>
          </h1>

          <p className="hero-element max-w-2xl text-lg text-[#8b9bb4] mb-12 leading-relaxed font-mono">
            // High-performance collaboration engine. <br/>
            // Latency: &lt;30ms. Protocol: CRDT. <br/>
            // Encryption: AES-256.
          </p>

          <div className="hero-element flex flex-wrap gap-4 justify-center md:justify-start">
            {/* TODO: Testing only - redirect to whiteboard component */}
            <button 
              onClick={() => navigate('/board/1')}
              className="group h-14 px-8 rounded-none skew-x-[-10deg] bg-[#66FCF1] text-[#0B0C10] font-black flex items-center gap-3 hover:bg-white transition-all shadow-[0_0_30px_rgba(102,252,241,0.3)]"
            >
              <div className="skew-x-[10deg] flex items-center gap-2">
                <Zap className="w-5 h-5 fill-current" />
                ENGAGE SESSION
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </div>
            </button>
            <button 
              onClick={() => window.open('https://github.com', '_blank')}
              className="h-14 px-8 rounded-none skew-x-[-10deg] border border-[#45A29E] bg-transparent text-[#66FCF1] font-bold hover:bg-[#45A29E]/10 transition-all flex items-center gap-2"
            >
              <div className="skew-x-[10deg] flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                ACCESS ARCHIVES
              </div>
            </button>
          </div>
        </section>

        {/* --- PRODUCT PREVIEW SECTION (NEW) --- */}
        <section ref={previewRef} className="mb-40 perspective-1000">
          <ProductPreview />
        </section>

        {/* --- ARCHITECTURE DIAGRAM --- */}
        <section ref={flowChartRef} className="mb-32">
          {/* ... Existing Architecture Code (kept simple for brevity, logic is same as before) ... */}
          <div className="bg-[#0B0C10] rounded-xl border border-[#1F2833] p-8 md:p-12 relative overflow-hidden">
             <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#66FCF1_1px,transparent_1px)] [background-size:16px_16px]"></div>
             <div className="text-center mb-12">
               <h2 className="text-2xl font-bold text-white uppercase tracking-[0.2em]">Neural Network Architecture</h2>
             </div>
             
             {/* Flowchart Visualization */}
             <div className="relative flex flex-col md:flex-row items-center justify-center gap-16 min-h-[300px]">
                {/* Client A */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="w-24 h-24 rounded-xl bg-[#1F2833] border border-[#45A29E] flex items-center justify-center shadow-[0_0_20px_rgba(69,162,158,0.2)]">
                    <MousePointer2 className="w-8 h-8 text-[#66FCF1]" />
                  </div>
                  <div className="text-center font-mono text-xs text-[#45A29E]">PILOT 01</div>
                </div>

                {/* Animated Wires */}
                <div className="hidden md:block absolute top-1/2 left-0 w-full h-full -translate-y-1/2 pointer-events-none z-0">
                  <svg className="w-full h-full">
                    <defs>
                      <linearGradient id="wireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#1F2833" />
                        <stop offset="50%" stopColor="#45A29E" />
                        <stop offset="100%" stopColor="#1F2833" />
                      </linearGradient>
                    </defs>
                    <line x1="25%" y1="50%" x2="50%" y2="50%" stroke="url(#wireGradient)" strokeWidth="2" strokeDasharray="4 4" />
                    <circle className="packet-left" cx="25%" cy="50%" r="4" fill="#66FCF1" filter="drop-shadow(0 0 5px #66FCF1)" />
                    <line x1="50%" y1="50%" x2="75%" y2="50%" stroke="url(#wireGradient)" strokeWidth="2" strokeDasharray="4 4" />
                    <circle className="packet-right" cx="50%" cy="50%" r="4" fill="#66FCF1" filter="drop-shadow(0 0 5px #66FCF1)" />
                  </svg>
                </div>

                {/* Server Core */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="w-32 h-32 rounded-full bg-[#0B0C10] border-2 border-[#66FCF1] flex flex-col items-center justify-center relative shadow-[0_0_40px_rgba(102,252,241,0.2)]">
                    <div className="absolute inset-0 rounded-full border border-[#66FCF1] opacity-40 animate-ping"></div>
                    <Database className="w-8 h-8 text-white mb-2" />
                    <div className="text-[10px] font-mono text-[#66FCF1]">MAGI SYSTEM</div>
                  </div>
                </div>

                {/* Client B */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="w-24 h-24 rounded-xl bg-[#1F2833] border border-[#1F2833] flex items-center justify-center">
                    <MousePointer2 className="w-8 h-8 text-gray-500" />
                  </div>
                  <div className="text-center font-mono text-xs text-gray-500">PILOT 02</div>
                </div>
             </div>
          </div>
        </section>

        {/* --- FEATURES (BENTO GRID) --- */}
        <section id="features" className="mb-32">
          <div className="flex items-end justify-between mb-12 px-2 border-l-4 border-[#66FCF1] pl-6">
            <div>
              <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">Core Specs</h2>
              <p className="text-[#45A29E] font-mono">// MODULES_LOADED: 4/4</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feat) => (
              <div 
                key={feat.id}
                className={`feature-card relative p-8 rounded-none border border-[#1F2833] bg-[#1F2833]/30 
                  ${feat.borderColor} hover:bg-[#1F2833]/50 transition-all duration-300 group 
                  ${feat.isWide ? 'md:col-span-2' : 'md:col-span-1'}
                  hover:shadow-[0_0_30px_rgba(69,162,158,0.15)]
                `}
              >
                {/* Tech Corner Markers */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#66FCF1] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#66FCF1] opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-none bg-[#0B0C10] border border-[#45A29E]/30 ${feat.accent}`}>
                    <feat.icon className="w-6 h-6" />
                  </div>
                  <div className="p-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    <ArrowRight className="w-5 h-5 text-[#66FCF1]" />
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{feat.title}</h3>
                <p className="text-[#8b9bb4] leading-relaxed text-sm font-mono opacity-80">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
};

export default Landing;