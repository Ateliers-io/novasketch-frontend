import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import {
    LayoutGrid,
    Search,
    Plus,
    Clock,
    FolderOpen,
    Circle,
    Command,
    ChevronLeft,
    Menu,
    Grid3X3,
    List as ListIcon,
    Trash2,
    Copy,
    Edit2,
    Users,
    Sparkles,
    Bell,
    X,
    User,
    UserPlus,
    Share2,
    MessageSquare,
    AlertCircle,
    Loader2,
    LogOut,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { useAuth } from '../../../contexts';
import { createSession, getUserSessions, SessionInfo, deleteSession } from '../../../services/session.service';

/** Simple relative time formatter — avoids heavy date-fns dependency */
function formatRelativeTime(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}

/* --- TYPES --- */
interface Notification {
    id: number;
    type: 'invite' | 'comment' | 'update' | 'alert';
    title: string;
    message: string;
    time: string;
    read: boolean;
}

/* --- MOCK DATA --- */
const INITIAL_NOTIFICATIONS: Notification[] = [
    { id: 1, type: 'invite', title: 'Team Invitation', message: 'Alex invited you to "Design System" project', time: '2m ago', read: false },
    { id: 2, type: 'comment', title: 'New Comment', message: 'Maya commented on "Neural Interface V2"', time: '15m ago', read: false },
    { id: 3, type: 'update', title: 'Project Updated', message: 'System Architecture was modified by John', time: '1h ago', read: true },
    { id: 4, type: 'alert', title: 'Storage Alert', message: 'You are using 85% of your storage quota', time: '3h ago', read: true },
];

/** Pick a deterministic preview type from the session ID hash */
function getPreviewType(sessionId: string): 'rects' | 'circles' | 'mixed' {
    const hash = sessionId.charCodeAt(0) + sessionId.charCodeAt(sessionId.length - 1);
    const types: ('rects' | 'circles' | 'mixed')[] = ['rects', 'circles', 'mixed'];
    return types[hash % 3];
}

/* --- 3. NOTIFICATIONS PANEL --- */
interface NotificationsPanelProps {
    notifications: Notification[];
    onMarkRead: (id: number) => void;
    onDismiss: (id: number) => void;
    onClose: () => void;
}

const NotificationsPanel = ({ notifications, onMarkRead, onDismiss, onClose }: NotificationsPanelProps) => {
    const getIcon = (type: string) => {
        switch (type) {
            case 'invite': return <UserPlus size={16} className="text-[#66FCF1]" />;
            case 'comment': return <MessageSquare size={16} className="text-pink-400" />;
            case 'update': return <Share2 size={16} className="text-indigo-400" />;
            case 'alert': return <AlertCircle size={16} className="text-amber-400" />;
            default: return <Bell size={16} className="text-[#66FCF1]" />;
        }
    };

    return (
        <div className="absolute right-0 top-12 w-80 bg-[#1F2833] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Bell size={14} className="text-[#66FCF1]" />
                    Notifications
                </h3>
                <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-[#8b9bb4] hover:text-white">
                    <X size={14} />
                </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center text-[#8b9bb4] text-sm">No notifications</div>
                ) : (
                    notifications.map((notif) => (
                        <div
                            key={notif.id}
                            className={`flex gap-3 p-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!notif.read ? 'bg-[#66FCF1]/5' : ''
                                }`}
                            onClick={() => onMarkRead(notif.id)}
                        >
                            <div className="flex-shrink-0 mt-0.5">{getIcon(notif.type)}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium text-white truncate">{notif.title}</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDismiss(notif.id); }}
                                        className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 text-[#8b9bb4] hover:text-white"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                                <p className="text-xs text-[#8b9bb4] truncate mt-0.5">{notif.message}</p>
                                <p className="text-[10px] text-[#45A29E] mt-1">{notif.time}</p>
                            </div>
                            {!notif.read && <div className="w-2 h-2 rounded-full bg-[#66FCF1] flex-shrink-0 mt-1.5" />}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

/* --- 4. PROJECT CARD (GRID VIEW) --- */
const ProjectCard = ({ project, isSelected, onSelect, onOpen, onContextMenu }: { project: SessionInfo; isSelected: boolean; onSelect: (id: string) => void; onOpen: (id: string) => void; onContextMenu: (e: React.MouseEvent, id: string) => void }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<SVGSVGElement>(null);
    const tlRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);
    const previewType = getPreviewType(project.sessionId);
    const thumbnailData = localStorage.getItem(`novasketch_thumbnail_${project.sessionId}`);

    useLayoutEffect(() => {
        if (!cardRef.current) return;
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
            const isRect = previewType === 'rects' || (previewType === 'mixed' && i % 2 === 0);
            const style = { fill: 'transparent', stroke: i === 0 ? '#66FCF1' : '#45A29E', strokeWidth: 1.5, opacity: i === 0 ? 1 : 0.4 };
            if (isRect) shapes.push(<rect key={i} className="live-shape" x={40 + i * 25} y={30 + i * 12} width={24} height={18} rx={2} {...style} />);
            else shapes.push(<circle key={i} className="live-shape" cx={50 + i * 20} cy={40 + i * 12} r={10} {...style} />);
        }
        return shapes;
    };

    const shortId = project.sessionId.length > 8 ? project.sessionId.slice(0, 8) : project.sessionId;

    return (
        <div
            ref={cardRef}
            onClick={(e) => { e.stopPropagation(); onSelect(project.sessionId); }}
            onDoubleClick={(e) => { e.stopPropagation(); onOpen(project.sessionId); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, project.sessionId); }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`group relative flex flex-col bg-[#1F2833] border rounded-lg overflow-hidden cursor-pointer transition-all ${isSelected ? 'border-[#66FCF1] ring-1 ring-[#66FCF1]' : 'border-white/10 hover:border-[#66FCF1]/50'}`}
        >
            <div className="relative h-32 bg-[#0B0C10] w-full overflow-hidden border-b border-white/5">
                {thumbnailData ? (
                    <img src={thumbnailData} alt="Board thumbnail" className="absolute inset-0 w-full h-full object-contain opacity-80" />
                ) : (
                    <>
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#45A29E 1px, transparent 1px), linear-gradient(90deg, #45A29E 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                        <svg ref={previewRef} className="absolute inset-0 w-full h-full p-4 pointer-events-none" viewBox="0 0 200 120">{renderShapes()}</svg>
                    </>
                )}
                {/* Collab/Personal Badge */}
                <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-sm text-[9px] font-bold ${project.isCollab ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    }`}>
                    {project.isCollab ? <Users size={10} className="inline mr-1" /> : <User size={10} className="inline mr-1" />}
                    {project.isCollab ? 'TEAM' : 'PERSONAL'}
                </div>
                {project.role && project.role !== 'owner' && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-[#0B0C10]/80 backdrop-blur border border-[#45A29E]/50 rounded-sm">
                        <span className="text-[9px] font-mono font-bold text-[#45A29E] uppercase">{project.role}</span>
                    </div>
                )}
            </div>
            <div className="p-3 flex flex-col gap-1">
                <h3 className={`text-sm font-medium truncate transition-colors ${isSelected ? 'text-[#66FCF1]' : 'text-white group-hover:text-[#66FCF1]'}`}>{project.name}</h3>
                <div className="flex items-center justify-between text-[10px] font-mono text-[#8b9bb4]">
                    <div className="flex items-center gap-1"><Clock size={10} /><span>{formatRelativeTime(project.lastEditedAt)}</span></div>
                    <span>#{shortId}</span>
                </div>
            </div>
        </div>
    );
};

/* --- 5. LIST ROW (LIST VIEW) --- */
const ProjectRow = ({ project, isSelected, onSelect, onOpen, onContextMenu }: { project: SessionInfo; isSelected: boolean; onSelect: (id: string) => void; onOpen: (id: string) => void; onContextMenu: (e: React.MouseEvent, id: string) => void }) => {
    const previewType = getPreviewType(project.sessionId);
    return (
        <div
            onClick={(e) => { e.stopPropagation(); onSelect(project.sessionId); }}
            onDoubleClick={(e) => { e.stopPropagation(); onOpen(project.sessionId); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, project.sessionId); }}
            className={`group flex items-center gap-4 p-3 rounded-md cursor-pointer border transition-all ${isSelected ? 'bg-[#66FCF1]/10 border-[#66FCF1]/30' : 'bg-[#1F2833]/30 border-transparent hover:bg-[#1F2833]'}`}
        >
            <div className={`w-8 h-8 rounded flex items-center justify-center border ${isSelected ? 'border-[#66FCF1] bg-[#66FCF1]/20' : 'border-white/10 bg-[#0B0C10]'}`}>
                {previewType === 'rects' ? <Grid3X3 size={14} className={isSelected ? 'text-[#66FCF1]' : 'text-[#45A29E]'} /> : <Circle size={14} className={isSelected ? 'text-[#66FCF1]' : 'text-[#45A29E]'} />}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-medium truncate ${isSelected ? 'text-[#66FCF1]' : 'text-white'}`}>{project.name}</h3>
            </div>
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${project.isCollab ? 'bg-pink-500/20 text-pink-400' : 'bg-indigo-500/20 text-indigo-400'
                }`}>
                {project.isCollab ? 'TEAM' : 'PERSONAL'}
            </div>
            <div className="hidden md:flex items-center gap-6 text-xs text-[#8b9bb4] font-mono">
                {project.role && <span className="text-[#45A29E] uppercase">{project.role}</span>}
                <span>{formatRelativeTime(project.lastEditedAt)}</span>
            </div>
        </div>
    );
};

/* --- 6. MAIN DASHBOARD --- */
export const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [projects, setProjects] = useState<SessionInfo[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);

    const fetchProjects = async () => {
        setIsLoadingProjects(true);
        try {
            const data = await getUserSessions();
            setProjects(data);
        } catch (err) {
            console.error("Failed to fetch projects", err);
        } finally {
            setIsLoadingProjects(false);
        }
    };

    useEffect(() => {
        // Always fetch — getUserSessions now merges API + localStorage
        fetchProjects();
    }, [user]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);
    const [projectFilter, setProjectFilter] = useState<'all' | 'collab' | 'personal'>('all');

    // Task 4: Sidebar view (All Projects vs Recent)
    const [sidebarView, setSidebarView] = useState<'all' | 'recent'>('all');

    // Task 4: Sort order (newest first / oldest first)
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

    // Task 4: Search query for filtering projects
    const [searchQuery, setSearchQuery] = useState('');

    // Notifications State
    const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
    const [showNotifications, setShowNotifications] = useState(false);

    const unreadCount = notifications.filter(n => !n.read).length;

    // Notification Operations
    const markNotificationRead = (id: number) => {
        setNotifications(notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
        ));
    };

    const dismissNotification = (id: number) => {
        setNotifications(notifications.filter(n => n.id !== id));
    };

    // Sort projects chronologically by lastEditedAt
    const sortedProjects = [...projects]
        .filter(p => {
            // Task 4: Apply search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return p.name.toLowerCase().includes(q) || p.sessionId.toLowerCase().includes(q);
            }
            return true;
        })
        .sort((a, b) => {
            const dateA = a.lastEditedAt ? new Date(a.lastEditedAt).getTime() : 0;
            const dateB = b.lastEditedAt ? new Date(b.lastEditedAt).getTime() : 0;
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

    // Apply type filter
    const filteredProjects = sortedProjects.filter(p => {
        if (projectFilter === 'collab') return p.isCollab;
        if (projectFilter === 'personal') return !p.isCollab;
        return true;
    });

    // Split into sections (only used in 'all' sidebarView)
    const collabProjects = sortedProjects.filter(p => p.isCollab);
    const personalProjects = sortedProjects.filter(p => !p.isCollab);

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

    const openProject = (id: string) => {
        // Navigate to board URL
        navigate(`/board/${id}`);
    };

    const handleDeleteProject = async (id: string) => {
        if (!confirm("Are you sure you want to delete this board?")) return;
        await deleteSession(id);
        fetchProjects();
        setContextMenu(null);
    };

    const [isCreatingBoard, setIsCreatingBoard] = useState(false);
    const [joinBoardId, setJoinBoardId] = useState('');

    const handleJoinBoard = () => {
        if (!joinBoardId.trim()) return;

        let idToJoin = joinBoardId.trim();
        // If they pasted a full URL, extract the ID
        if (idToJoin.includes('/board/')) {
            const parts = idToJoin.split('/board/');
            idToJoin = parts[parts.length - 1].split('?')[0].split('/')[0];
        }
        navigate(`/board/${idToJoin}`);
    };

    const handleCreateBoard = async (isCollab: boolean = false) => {
        if (isCreatingBoard) return;
        setIsCreatingBoard(true);
        try {
            const { url } = await createSession(undefined, isCollab);
            // Re-fetch projects so the new board appears if user goes back
            fetchProjects();
            navigate(url);
        } catch (err) {
            console.error('Failed to create board:', err);
            alert('Failed to create a new board. Please try again.');
        } finally {
            setIsCreatingBoard(false);
        }
    };

    // Task 5: Re-fetch projects when tab becomes visible (detects collab promotion)
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchProjects();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from(".sidebar-el", { x: -20, opacity: 0, stagger: 0.05, duration: 0.4, ease: "power2.out" });
            gsap.from(".dash-content", { y: 20, opacity: 0, duration: 0.5, delay: 0.2, ease: "power2.out" });
        });
        return () => ctx.revert();
    }, []);

    return (
        <div className="flex h-screen w-full bg-[#0B0C10] text-[#C5C6C7] font-sans overflow-hidden selection:bg-[#66FCF1] selection:text-[#0B0C10]"
            style={{ cursor: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2366FCF1%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z%27/%3E%3Cpath d=%27M13 13l6 6%27/%3E%3C/svg%3E") 0 0, auto' }}
            onContextMenu={(e) => e.preventDefault()}>

            {/* SIDEBAR */}
            <aside className={`flex flex-col border-r border-white/10 bg-[#0B0C10] transition-all duration-300 z-20 ${isSidebarCollapsed ? 'w-14' : 'w-60'}`}>
                <div className="h-12 flex items-center px-3 border-b border-white/10">
                    <div className="flex items-center gap-2 text-[#66FCF1] overflow-hidden">
                        <div className="min-w-[20px]"><Sparkles size={20} /></div>
                        {!isSidebarCollapsed && <span className="font-bold tracking-tight text-white whitespace-nowrap">NovaSketch</span>}
                    </div>
                    <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="ml-auto p-1 rounded hover:bg-[#1F2833] text-[#45A29E]">
                        {isSidebarCollapsed ? <Menu size={14} /> : <ChevronLeft size={14} />}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-2">
                    <div
                        onClick={() => { setSidebarView('all'); setProjectFilter('all'); }}
                        className={`sidebar-el flex items-center gap-3 px-2 py-1.5 rounded-sm text-sm cursor-pointer transition-colors ${sidebarView === 'all' && projectFilter === 'all' ? 'bg-[#1F2833] text-white' : 'text-[#8b9bb4] hover:bg-[#1F2833]/50 hover:text-white'}`}
                    >
                        <FolderOpen size={16} className={sidebarView === 'all' && projectFilter === 'all' ? 'text-[#66FCF1]' : ''} />{!isSidebarCollapsed && <span>All Projects</span>}
                    </div>
                    <div
                        onClick={() => { setSidebarView('recent'); setProjectFilter('all'); }}
                        className={`sidebar-el flex items-center gap-3 px-2 py-1.5 rounded-sm text-sm cursor-pointer transition-colors ${sidebarView === 'recent' ? 'bg-[#1F2833] text-white' : 'text-[#8b9bb4] hover:bg-[#1F2833]/50 hover:text-white'}`}
                    >
                        <Clock size={16} className={sidebarView === 'recent' ? 'text-[#66FCF1]' : ''} />{!isSidebarCollapsed && <span>Recent</span>}
                    </div>

                    {!isSidebarCollapsed && (
                        <div className="mt-6 pt-4 border-t border-white/10">
                            <div className="px-2 mb-2 text-[10px] font-bold text-[#45A29E] uppercase tracking-wider">Filter by Type</div>
                            <div
                                onClick={() => setProjectFilter('collab')}
                                className={`sidebar-el flex items-center gap-3 px-2 py-1.5 rounded-sm text-sm cursor-pointer transition-colors ${projectFilter === 'collab' ? 'bg-pink-500/10 text-pink-400' : 'text-[#8b9bb4] hover:bg-[#1F2833]/50 hover:text-white'}`}
                            >
                                <Users size={16} /><span>Collaborative</span>
                            </div>
                            <div
                                onClick={() => setProjectFilter('personal')}
                                className={`sidebar-el flex items-center gap-3 px-2 py-1.5 rounded-sm text-sm cursor-pointer transition-colors ${projectFilter === 'personal' ? 'bg-indigo-500/10 text-indigo-400' : 'text-[#8b9bb4] hover:bg-[#1F2833]/50 hover:text-white'}`}
                            >
                                <User size={16} /><span>Personal</span>
                            </div>
                            <div
                                onClick={() => setProjectFilter('all')}
                                className={`sidebar-el flex items-center gap-3 px-2 py-1.5 rounded-sm text-sm cursor-pointer transition-colors ${projectFilter === 'all' ? 'bg-[#1F2833] text-[#66FCF1]' : 'text-[#8b9bb4] hover:bg-[#1F2833]/50 hover:text-white'}`}
                            >
                                <LayoutGrid size={16} /><span>Show All</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-2 border-t border-white/10">
                    <div className="flex items-center gap-3 p-2 rounded-sm hover:bg-[#1F2833] cursor-pointer transition-colors">
                        <div className="w-8 h-8 rounded bg-[#1F2833] border border-white/10 flex items-center justify-center text-xs font-bold text-white">{user?.displayName?.[0] || 'U'}</div>
                        {!isSidebarCollapsed && <div className="flex-1 min-w-0"><div className="text-xs font-medium text-white truncate">{user?.displayName}</div><div className="text-[10px] text-[#45A29E] truncate font-mono">ONLINE</div></div>}
                        {!isSidebarCollapsed && <button onClick={handleLogout} className="text-[#8b9bb4] hover:text-[#66FCF1]" title="Log Out"><LogOut size={14} /></button>}
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col relative bg-[#0B0C10]" onClick={() => setSelectedId(null)}>

                {/* HEADER */}
                <header className="h-12 border-b border-white/10 flex items-center justify-between px-6 bg-[#0B0C10] z-10">
                    <div className="flex items-center gap-2 text-sm text-[#8b9bb4]">
                        <span className="text-white font-medium">{sidebarView === 'recent' ? 'Recent Projects' : 'Dashboard'}</span>
                        {sidebarView === 'recent' && (
                            <span className="text-[10px] font-mono text-[#45A29E] bg-[#1F2833] px-2 py-0.5 rounded">
                                {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
                            </span>
                        )}
                        <div className="ml-4 flex bg-[#1F2833] rounded-md border border-white/10 items-center overflow-hidden h-8 hidden md:flex">
                            <input
                                type="text"
                                placeholder="Enter board ID or share link to join"
                                value={joinBoardId}
                                onChange={(e) => setJoinBoardId(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoinBoard()}
                                className="bg-transparent border-none outline-none text-xs text-white px-3 w-64 placeholder:text-[#8b9bb4]"
                            />
                            <button
                                onClick={handleJoinBoard}
                                disabled={!joinBoardId.trim()}
                                className="h-full px-3 text-[10px] font-bold bg-[#45A29E]/20 text-[#66FCF1] hover:bg-[#45A29E]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-l border-white/10"
                            >
                                JOIN
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group w-64 hidden md:block">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#45A29E]" size={14} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search projects..."
                                className="w-full h-8 bg-[#1F2833] border border-white/10 rounded-sm pl-8 pr-8 text-xs text-white focus:outline-none focus:border-[#66FCF1] transition-all placeholder:text-[#8b9bb4]"
                            />
                            {searchQuery ? (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b9bb4] hover:text-white">
                                    <X size={12} />
                                </button>
                            ) : (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none"><Command size={10} className="text-[#8b9bb4]" /><span className="text-[10px] font-mono text-[#8b9bb4]">K</span></div>
                            )}
                        </div>

                        {/* Sort Toggle */}
                        <button
                            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[#8b9bb4] hover:text-[#66FCF1] hover:bg-[#1F2833] transition-all text-xs font-mono"
                            title={`Sort: ${sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}`}
                        >
                            {sortOrder === 'newest' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                            <span className="hidden lg:inline">{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
                        </button>

                        {/* Notifications Button */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications); }}
                                className="relative p-2 rounded hover:bg-[#1F2833] text-[#8b9bb4] hover:text-[#66FCF1] transition-colors"
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                            {showNotifications && (
                                <NotificationsPanel
                                    notifications={notifications}
                                    onMarkRead={markNotificationRead}
                                    onDismiss={dismissNotification}
                                    onClose={() => setShowNotifications(false)}
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-[#1F2833] text-[#66FCF1]' : 'text-[#8b9bb4] hover:text-white'}`}><LayoutGrid size={16} /></button>
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-[#1F2833] text-[#66FCF1]' : 'text-[#8b9bb4] hover:text-white'}`}><ListIcon size={16} /></button>
                        </div>
                    </div>
                </header>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto p-8 dash-content">
                    <div className="max-w-6xl mx-auto space-y-10">

                        {/* LOADING STATE */}
                        {isLoadingProjects && (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 size={32} className="text-[#66FCF1] animate-spin" />
                                <p className="text-sm text-[#8b9bb4] font-mono">Loading your projects...</p>
                            </div>
                        )}

                        {/* EMPTY STATE — no projects at all */}
                        {!isLoadingProjects && projects.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-[#1F2833] border border-white/10 flex items-center justify-center">
                                    <FolderOpen size={28} className="text-[#45A29E]" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-bold text-white mb-1">No projects yet</h3>
                                    <p className="text-sm text-[#8b9bb4]">Create your first board to get started!</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCreateBoard(); }}
                                    disabled={isCreatingBoard}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[#66FCF1] hover:bg-[#45A29E] text-black font-bold text-sm rounded-lg transition-all disabled:opacity-50"
                                >
                                    {isCreatingBoard ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Create New Board
                                </button>
                            </div>
                        )}

                        {/* SEARCH NO RESULTS STATE */}
                        {!isLoadingProjects && projects.length > 0 && filteredProjects.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Search size={28} className="text-[#45A29E]" />
                                <div className="text-center">
                                    <h3 className="text-lg font-bold text-white mb-1">No matching projects</h3>
                                    <p className="text-sm text-[#8b9bb4]">
                                        {searchQuery ? `No results for "${searchQuery}"` : 'No projects match the selected filter'}
                                    </p>
                                </div>
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="text-xs text-[#66FCF1] hover:underline"
                                    >
                                        Clear search
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ============ RECENT VIEW (flat list) ============ */}
                        {!isLoadingProjects && sidebarView === 'recent' && filteredProjects.length > 0 && (
                            <section>
                                <div className="flex items-end justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-[#66FCF1]/10 border border-[#66FCF1]/20">
                                            <Clock size={18} className="text-[#66FCF1]" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white">Recent Projects</h2>
                                            <p className="text-xs text-[#8b9bb4] mt-0.5">
                                                {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} · Sorted by {sortOrder === 'newest' ? 'newest first' : 'oldest first'}
                                                {projectFilter !== 'all' && ` · ${projectFilter === 'collab' ? 'Collaborative only' : 'Personal only'}`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleCreateBoard(); }}
                                        disabled={isCreatingBoard}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-[#66FCF1]/10 hover:bg-[#66FCF1]/20 border border-[#66FCF1]/30 text-[#66FCF1] text-xs font-bold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isCreatingBoard ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}NEW BOARD
                                    </button>
                                </div>

                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
                                        {filteredProjects.map((project) => (
                                            <ProjectCard
                                                key={project.sessionId}
                                                project={project}
                                                isSelected={selectedId === project.sessionId}
                                                onSelect={setSelectedId}
                                                onOpen={openProject}
                                                onContextMenu={handleContextMenu}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        {filteredProjects.map((project) => (
                                            <ProjectRow
                                                key={project.sessionId}
                                                project={project}
                                                isSelected={selectedId === project.sessionId}
                                                onSelect={setSelectedId}
                                                onOpen={openProject}
                                                onContextMenu={handleContextMenu}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* ============ ALL PROJECTS VIEW (split sections) ============ */}
                        {!isLoadingProjects && sidebarView === 'all' && (
                            <>
                                {/* COLLABORATIVE PROJECTS SECTION */}
                                {(projectFilter === 'all' || projectFilter === 'collab') && (
                                    <section>
                                        <div className="flex items-end justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-pink-500/10 border border-pink-500/20">
                                                    <Users size={18} className="text-pink-400" />
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-bold text-white">Collaborative Projects</h2>
                                                    <p className="text-xs text-[#8b9bb4] mt-0.5">Team boards you're working on with others</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleCreateBoard(true); }}
                                                disabled={isCreatingBoard}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-400 text-xs font-bold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isCreatingBoard ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}NEW TEAM BOARD
                                            </button>
                                        </div>

                                        {viewMode === 'grid' ? (
                                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); handleCreateBoard(true); }}
                                                    className={`group border border-dashed border-white/20 hover:border-pink-500 rounded-lg p-4 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-[#1F2833]/50 transition-all min-h-[200px] ${isCreatingBoard ? 'opacity-50 pointer-events-none' : ''}`}
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-[#1F2833] flex items-center justify-center group-hover:scale-110 transition-transform border border-white/10 group-hover:border-pink-500">
                                                        {isCreatingBoard ? <Loader2 size={20} className="text-pink-500 animate-spin" /> : <Plus size={20} className="text-pink-400" />}
                                                    </div>
                                                    <span className="text-xs font-medium text-[#8b9bb4] group-hover:text-white">{isCreatingBoard ? 'Creating...' : 'Create Team Board'}</span>
                                                </div>
                                                {collabProjects.map((project) => (
                                                    <ProjectCard
                                                        key={project.sessionId}
                                                        project={project}
                                                        isSelected={selectedId === project.sessionId}
                                                        onSelect={setSelectedId}
                                                        onOpen={openProject}
                                                        onContextMenu={handleContextMenu}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                {collabProjects.map((project) => (
                                                    <ProjectRow
                                                        key={project.sessionId}
                                                        project={project}
                                                        isSelected={selectedId === project.sessionId}
                                                        onSelect={setSelectedId}
                                                        onOpen={openProject}
                                                        onContextMenu={handleContextMenu}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                )}

                                {/* PERSONAL PROJECTS SECTION */}
                                {(projectFilter === 'all' || projectFilter === 'personal') && (
                                    <section>
                                        <div className="flex items-end justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                                    <User size={18} className="text-indigo-400" />
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-bold text-white">Personal Boards</h2>
                                                    <p className="text-xs text-[#8b9bb4] mt-0.5">Your private sketches and ideas</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleCreateBoard(); }}
                                                disabled={isCreatingBoard}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isCreatingBoard ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}NEW PERSONAL BOARD
                                            </button>
                                        </div>

                                        {viewMode === 'grid' ? (
                                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); handleCreateBoard(); }}
                                                    className={`group border border-dashed border-white/20 hover:border-indigo-400 rounded-lg p-4 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-[#1F2833]/50 transition-all min-h-[200px] ${isCreatingBoard ? 'opacity-50 pointer-events-none' : ''}`}
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-[#1F2833] flex items-center justify-center group-hover:scale-110 transition-transform border border-white/10 group-hover:border-indigo-400">
                                                        {isCreatingBoard ? <Loader2 size={20} className="text-indigo-400 animate-spin" /> : <Plus size={20} className="text-indigo-400" />}
                                                    </div>
                                                    <span className="text-xs font-medium text-[#8b9bb4] group-hover:text-white">{isCreatingBoard ? 'Creating...' : 'Create Personal Board'}</span>
                                                </div>
                                                {personalProjects.map((project) => (
                                                    <ProjectCard
                                                        key={project.sessionId}
                                                        project={project}
                                                        isSelected={selectedId === project.sessionId}
                                                        onSelect={setSelectedId}
                                                        onOpen={openProject}
                                                        onContextMenu={handleContextMenu}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                {personalProjects.map((project) => (
                                                    <ProjectRow
                                                        key={project.sessionId}
                                                        project={project}
                                                        isSelected={selectedId === project.sessionId}
                                                        onSelect={setSelectedId}
                                                        onOpen={openProject}
                                                        onContextMenu={handleContextMenu}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* CONTEXT MENU */}
                {contextMenu && (
                    <div
                        className="fixed bg-[#1F2833] border border-white/10 rounded-md shadow-2xl z-50 py-1 w-48 backdrop-blur-md"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 py-2 text-xs font-mono text-[#45A29E] border-b border-white/5 mb-1">ID: {contextMenu.id.length > 12 ? `${contextMenu.id.slice(0, 8)}...` : contextMenu.id}</div>
                        <button className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-[#66FCF1]/10 hover:text-[#66FCF1] flex items-center gap-2"><Edit2 size={14} /> Rename</button>
                        <button className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-[#66FCF1]/10 hover:text-[#66FCF1] flex items-center gap-2"><Copy size={14} /> Duplicate</button>
                        <button className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-[#66FCF1]/10 hover:text-[#66FCF1] flex items-center gap-2" onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/board/${contextMenu.id}`);
                            setContextMenu(null);
                        }}><Share2 size={14} /> Copy Link</button>
                        <div className="h-px bg-white/5 my-1" />
                        <button onClick={() => handleDeleteProject(contextMenu.id)} className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                    </div>
                )}
            </main>
        </div>
    );
};