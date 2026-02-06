import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import {
    LayoutGrid,
    Search,
    Plus,
    Clock,
    ChevronRight,
    Settings,
    LogOut,
    FolderOpen,
    FileCode,
    CheckCircle2,
    Circle,
    Command,
    ChevronLeft,
    Menu,
    Terminal,
    Grid3X3,
    List as ListIcon,
    MoreHorizontal,
    Trash2,
    Copy,
    Edit2,
    Users
} from 'lucide-react';
import { useAuth } from '../../../contexts';

/* --- 1. MOCK DATA --- */
const MOCK_PROJECTS = [
    { id: 'proj_01', title: 'Neural Interface V2', edited: '2m ago', users: 3, previewType: 'rects', size: '12MB' },
    { id: 'proj_02', title: 'System Architecture', edited: '1h ago', users: 1, previewType: 'circles', size: '4.5MB' },
    { id: 'proj_03', title: 'Q3 Roadmap / Alpha', edited: '4h ago', users: 5, previewType: 'mixed', size: '8.2MB' },
    { id: 'proj_04', title: 'Landing Page Assets', edited: '1d ago', users: 0, previewType: 'rects', size: '24MB' },
    { id: 'proj_05', title: 'Component Library', edited: '2d ago', users: 2, previewType: 'circles', size: '1.1MB' },
];

const CHECKLIST_ITEMS = [
    { id: 1, label: "Initialize first workspace" },
    { id: 2, label: "Invite a pilot (collaborator)" },
    { id: 3, label: "Export schema to SVG" },
    { id: 4, label: "Configure system settings" },
];

/* --- 2. SUB-COMPONENTS --- */

const ChecklistItem = ({ label }: { label: string }) => {
    const [checked, setChecked] = useState(false);
    const itemRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const checkRef = useRef<HTMLDivElement>(null);

    const handleCheck = () => {
        if (checked) return;
        setChecked(true);
        const ctx = gsap.context(() => {
            gsap.to(textRef.current, { color: '#45A29E', textDecoration: 'line-through', opacity: 0.5, duration: 0.3 });
            gsap.fromTo(checkRef.current, { scale: 0.8, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.4, ease: "back.out(2)" });
            gsap.to(itemRef.current, { backgroundColor: "rgba(102, 252, 241, 0.05)", duration: 0.2, yoyo: true, repeat: 1 });
        }, itemRef.current);
    };

    return (
        <div ref={itemRef} onClick={handleCheck} className="group flex items-center gap-3 py-2 px-3 rounded-sm cursor-pointer border border-transparent hover:border-[#45A29E]/30 transition-colors">
            <div ref={checkRef} className="text-[#66FCF1]">
                {checked ? <CheckCircle2 size={16} /> : <Circle size={16} className="text-[#45A29E]/50 group-hover:text-[#66FCF1]" />}
            </div>
            <span ref={textRef} className="text-sm text-[#C5C6C7] font-mono transition-all">{label}</span>
        </div>
    );
};

/* --- 3. PROJECT CARD (GRID VIEW) --- */
const ProjectCard = ({ project, isSelected, onSelect, onOpen, onContextMenu }: any) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<SVGSVGElement>(null);
    const tlRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            const shapes = gsap.utils.selector(previewRef.current)('.live-shape');
            tlRef.current = gsap.timeline({ paused: true, repeat: -1, yoyo: true });
            tlRef.current.to(shapes, { x: "random(-5, 5)", y: "random(-5, 5)", rotation: "random(-10, 10)", duration: 2.5, ease: "sine.inOut", stagger: { amount: 1, from: "random" } });
        }, cardRef.current);
        return () => ctx.revert();
    }, []);

    const handleMouseEnter = () => tlRef.current?.play();
    const handleMouseLeave = () => tlRef.current?.pause();

    const renderShapes = () => {
        const shapes = [];
        for (let i = 0; i < 4; i++) {
            const isRect = project.previewType === 'rects' || (project.previewType === 'mixed' && i % 2 === 0);
            const style = { fill: 'transparent', stroke: i === 0 ? '#66FCF1' : '#45A29E', strokeWidth: 1.5, opacity: i === 0 ? 1 : 0.4 };
            if (isRect) shapes.push(<rect key={i} className="live-shape" x={40 + i * 25} y={30 + i * 12} width={24} height={18} rx={2} {...style} />);
            else shapes.push(<circle key={i} className="live-shape" cx={50 + i * 20} cy={40 + i * 12} r={10} {...style} />);
        }
        return shapes;
    };

    return (
        <div
            ref={cardRef}
            onClick={(e) => { e.stopPropagation(); onSelect(project.id); }}
            onDoubleClick={(e) => { e.stopPropagation(); onOpen(project.id); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, project.id); }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`group relative flex flex-col bg-[#1F2833] border rounded-lg overflow-hidden cursor-pointer transition-all ${isSelected ? 'border-[#66FCF1] ring-1 ring-[#66FCF1]' : 'border-white/10 hover:border-[#66FCF1]/50'}`}
        >
            <div className="relative h-32 bg-[#0B0C10] w-full overflow-hidden border-b border-white/5">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#45A29E 1px, transparent 1px), linear-gradient(90deg, #45A29E 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <svg ref={previewRef} className="absolute inset-0 w-full h-full p-4 pointer-events-none" viewBox="0 0 200 120">{renderShapes()}</svg>
                {project.users > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-[#0B0C10]/80 backdrop-blur border border-[#66FCF1] rounded-sm">
                        <div className="w-1.5 h-1.5 bg-[#66FCF1] rounded-full animate-pulse" />
                        <span className="text-[9px] font-mono font-bold text-[#66FCF1]">{project.users}</span>
                    </div>
                )}
            </div>
            <div className="p-3 flex flex-col gap-1">
                <h3 className={`text-sm font-medium truncate transition-colors ${isSelected ? 'text-[#66FCF1]' : 'text-white group-hover:text-[#66FCF1]'}`}>{project.title}</h3>
                <div className="flex items-center justify-between text-[10px] font-mono text-[#8b9bb4]">
                    <div className="flex items-center gap-1"><Clock size={10} /><span>{project.edited}</span></div>
                    <span>#{project.id.split('_')[1]}</span>
                </div>
            </div>
        </div>
    );
};

/* --- 4. LIST ROW (LIST VIEW) --- */
const ProjectRow = ({ project, isSelected, onSelect, onOpen, onContextMenu }: any) => {
    return (
        <div
            onClick={(e) => { e.stopPropagation(); onSelect(project.id); }}
            onDoubleClick={(e) => { e.stopPropagation(); onOpen(project.id); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, project.id); }}
            className={`group flex items-center gap-4 p-3 rounded-md cursor-pointer border transition-all ${isSelected ? 'bg-[#66FCF1]/10 border-[#66FCF1]/30' : 'bg-[#1F2833]/30 border-transparent hover:bg-[#1F2833]'}`}
        >
            <div className={`w-8 h-8 rounded flex items-center justify-center border ${isSelected ? 'border-[#66FCF1] bg-[#66FCF1]/20' : 'border-white/10 bg-[#0B0C10]'}`}>
                {project.previewType === 'rects' ? <Grid3X3 size={14} className={isSelected ? 'text-[#66FCF1]' : 'text-[#45A29E]'} /> : <Circle size={14} className={isSelected ? 'text-[#66FCF1]' : 'text-[#45A29E]'} />}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-medium truncate ${isSelected ? 'text-[#66FCF1]' : 'text-white'}`}>{project.title}</h3>
            </div>
            <div className="hidden md:flex items-center gap-6 text-xs text-[#8b9bb4] font-mono">
                {project.users > 0 && <div className="flex items-center gap-1 text-[#66FCF1]"><Users size={12} /> <span>{project.users}</span></div>}
                <span>{project.size}</span>
                <span>{project.edited}</span>
            </div>
        </div>
    );
};

/* --- 5. MAIN DASHBOARD --- */
export const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // New States for "Figma-like" feel
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);

    // Close context menu on click anywhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setSelectedId(id);
        setContextMenu({ x: e.pageX, y: e.pageY, id });
    };

    const openProject = (id: string) => navigate(`/board/${id}`);

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(".sidebar-el", { x: -20, opacity: 0, stagger: 0.05, duration: 0.4, ease: "power2.out" });
            gsap.from(".dash-content", { y: 20, opacity: 0, duration: 0.5, delay: 0.2, ease: "power2.out" });
        });
        return () => ctx.revert();
    }, []);

    return (
        <div className="flex h-screen w-full bg-[#0B0C10] text-[#C5C6C7] font-sans overflow-hidden selection:bg-[#66FCF1] selection:text-[#0B0C10]"
            onContextMenu={(e) => e.preventDefault()}> {/* Disable default browser context menu */}

            {/* SIDEBAR */}
            <aside className={`flex flex-col border-r border-white/10 bg-[#0B0C10] transition-all duration-300 z-20 ${isSidebarCollapsed ? 'w-14' : 'w-60'}`}>
                <div className="h-12 flex items-center px-3 border-b border-white/10">
                    <div className="flex items-center gap-3 text-[#66FCF1] overflow-hidden">
                        <div className="min-w-[20px]"><LayoutGrid size={20} /></div>
                        {!isSidebarCollapsed && <span className="font-bold tracking-tight text-white whitespace-nowrap">NOVA.SYS</span>}
                    </div>
                    <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="ml-auto p-1 rounded hover:bg-[#1F2833] text-[#45A29E]">
                        {isSidebarCollapsed ? <Menu size={14} /> : <ChevronLeft size={14} />}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-2">
                    <div className="sidebar-el flex items-center gap-3 px-2 py-1.5 rounded-sm bg-[#1F2833] text-white text-sm cursor-pointer"><FolderOpen size={16} className="text-[#66FCF1]" />{!isSidebarCollapsed && <span>All Projects</span>}</div>
                    <div className="sidebar-el flex items-center gap-3 px-2 py-1.5 rounded-sm hover:bg-[#1F2833]/50 text-[#8b9bb4] hover:text-white text-sm cursor-pointer transition-colors"><Clock size={16} />{!isSidebarCollapsed && <span>Recent</span>}</div>
                    <div className="sidebar-el flex items-center gap-3 px-2 py-1.5 rounded-sm hover:bg-[#1F2833]/50 text-[#8b9bb4] hover:text-white text-sm cursor-pointer transition-colors"><FileCode size={16} />{!isSidebarCollapsed && <span>Drafts</span>}</div>
                </div>
                <div className="p-2 border-t border-white/10">
                    <div className="flex items-center gap-3 p-2 rounded-sm hover:bg-[#1F2833] cursor-pointer transition-colors">
                        <div className="w-8 h-8 rounded bg-[#1F2833] border border-white/10 flex items-center justify-center text-xs font-bold text-white">{user?.name?.[0] || 'U'}</div>
                        {!isSidebarCollapsed && <div className="flex-1 min-w-0"><div className="text-xs font-medium text-white truncate">{user?.name}</div><div className="text-[10px] text-[#45A29E] truncate font-mono">ONLINE</div></div>}
                        {!isSidebarCollapsed && <button onClick={logout} className="text-[#8b9bb4] hover:text-[#66FCF1]"><LogOut size={14} /></button>}
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col relative bg-[#0B0C10]" onClick={() => setSelectedId(null)}>

                {/* HEADER */}
                <header className="h-12 border-b border-white/10 flex items-center justify-between px-6 bg-[#0B0C10] z-10">
                    <div className="flex items-center gap-2 text-sm text-[#8b9bb4]">
                        <span className="hover:text-white cursor-pointer transition-colors">Root</span>
                        <ChevronRight size={14} className="opacity-50" />
                        <span className="text-white font-medium">Dashboard</span>
                    </div>
                    <div className="relative group w-64 hidden md:block">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#45A29E]" size={14} />
                        <input type="text" placeholder="Jump to file..." className="w-full h-8 bg-[#1F2833] border border-white/10 rounded-sm pl-8 pr-8 text-xs text-white focus:outline-none focus:border-[#66FCF1] transition-all placeholder:text-[#8b9bb4]" />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none"><Command size={10} className="text-[#8b9bb4]" /><span className="text-[10px] font-mono text-[#8b9bb4]">K</span></div>
                    </div>
                    <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-[#1F2833] text-[#66FCF1]' : 'text-[#8b9bb4] hover:text-white'}`}><LayoutGrid size={16} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-[#1F2833] text-[#66FCF1]' : 'text-[#8b9bb4] hover:text-white'}`}><ListIcon size={16} /></button>
                    </div>
                </header>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto p-8 dash-content">
                    <div className="max-w-6xl mx-auto space-y-12">
                        <section>
                            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide"><Terminal size={14} className="text-[#66FCF1]" />System Initialization</h2>
                            <div className="bg-[#1F2833]/50 border border-white/10 rounded-sm p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                {CHECKLIST_ITEMS.map(item => <ChecklistItem key={item.id} label={item.label} />)}
                            </div>
                        </section>

                        <section>
                            <div className="flex items-end justify-between mb-6">
                                <div><h2 className="text-xl font-bold text-white">Active Schematics</h2></div>
                                <button onClick={() => navigate(`/board/${Math.random().toString(36).substr(2, 9)}`)} className="flex items-center gap-2 px-3 py-1.5 bg-[#1F2833] hover:bg-[#66FCF1]/10 border border-[#66FCF1]/50 text-[#66FCF1] text-xs font-bold rounded-sm transition-all"><Plus size={14} />CREATE NEW</button>
                            </div>

                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
                                    <div onClick={() => navigate(`/board/${Math.random().toString(36).substr(2, 9)}`)} className="group border border-dashed border-white/20 hover:border-[#66FCF1] rounded-lg p-4 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-[#1F2833]/50 transition-all min-h-[200px]">
                                        <div className="w-10 h-10 rounded-full bg-[#1F2833] flex items-center justify-center group-hover:scale-110 transition-transform border border-white/10 group-hover:border-[#66FCF1]"><Plus size={20} className="text-[#66FCF1]" /></div>
                                        <span className="text-xs font-medium text-[#8b9bb4] group-hover:text-white">Initialize Board</span>
                                    </div>
                                    {MOCK_PROJECTS.map((project) => (
                                        <ProjectCard
                                            key={project.id}
                                            project={project}
                                            isSelected={selectedId === project.id}
                                            onSelect={setSelectedId}
                                            onOpen={openProject}
                                            onContextMenu={handleContextMenu}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {MOCK_PROJECTS.map((project) => (
                                        <ProjectRow
                                            key={project.id}
                                            project={project}
                                            isSelected={selectedId === project.id}
                                            onSelect={setSelectedId}
                                            onOpen={openProject}
                                            onContextMenu={handleContextMenu}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                </div>

                {/* CONTEXT MENU */}
                {contextMenu && (
                    <div
                        className="fixed bg-[#1F2833] border border-white/10 rounded-md shadow-2xl z-50 py-1 w-48 backdrop-blur-md"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 py-2 text-xs font-mono text-[#45A29E] border-b border-white/5 mb-1">ID: {contextMenu.id.split('_')[1]}</div>
                        <button className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-[#66FCF1]/10 hover:text-[#66FCF1] flex items-center gap-2"><Edit2 size={14} /> Rename</button>
                        <button className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-[#66FCF1]/10 hover:text-[#66FCF1] flex items-center gap-2"><Copy size={14} /> Duplicate</button>
                        <div className="h-px bg-white/5 my-1" />
                        <button className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                    </div>
                )}
            </main>
        </div>
    );
};