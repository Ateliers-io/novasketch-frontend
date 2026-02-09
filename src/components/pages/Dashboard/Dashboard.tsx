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
    Users,
    Sparkles,
    Bell,
    X,
    Check,
    User,
    UserPlus,
    Share2,
    MessageSquare,
    AlertCircle
} from 'lucide-react';
import { useAuth } from '../../../contexts';

/* --- TYPES --- */
interface TodoItem {
    id: number;
    label: string;
    completed: boolean;
}

interface Notification {
    id: number;
    type: 'invite' | 'comment' | 'update' | 'alert';
    title: string;
    message: string;
    time: string;
    read: boolean;
}

interface Project {
    id: string;
    title: string;
    edited: string;
    users: number;
    previewType: 'rects' | 'circles' | 'mixed';
    size: string;
    isCollab: boolean;
}

/* --- 1. MOCK DATA --- */
const INITIAL_TODOS: TodoItem[] = [
    { id: 1, label: "Initialize first workspace", completed: false },
    { id: 2, label: "Invite a collaborator", completed: false },
    { id: 3, label: "Export schema to SVG", completed: false },
    { id: 4, label: "Configure system settings", completed: false },
];

const INITIAL_NOTIFICATIONS: Notification[] = [
    { id: 1, type: 'invite', title: 'Team Invitation', message: 'Alex invited you to "Design System" project', time: '2m ago', read: false },
    { id: 2, type: 'comment', title: 'New Comment', message: 'Maya commented on "Neural Interface V2"', time: '15m ago', read: false },
    { id: 3, type: 'update', title: 'Project Updated', message: 'System Architecture was modified by John', time: '1h ago', read: true },
    { id: 4, type: 'alert', title: 'Storage Alert', message: 'You are using 85% of your storage quota', time: '3h ago', read: true },
];

const MOCK_PROJECTS: Project[] = [
    { id: 'proj_01', title: 'Neural Interface V2', edited: '2m ago', users: 3, previewType: 'rects', size: '12MB', isCollab: true },
    { id: 'proj_02', title: 'System Architecture', edited: '1h ago', users: 2, previewType: 'circles', size: '4.5MB', isCollab: true },
    { id: 'proj_03', title: 'Q3 Roadmap / Alpha', edited: '4h ago', users: 5, previewType: 'mixed', size: '8.2MB', isCollab: true },
    { id: 'proj_04', title: 'Personal Sketches', edited: '1d ago', users: 0, previewType: 'rects', size: '24MB', isCollab: false },
    { id: 'proj_05', title: 'My Ideas Board', edited: '2d ago', users: 0, previewType: 'circles', size: '1.1MB', isCollab: false },
    { id: 'proj_06', title: 'Quick Notes', edited: '3d ago', users: 0, previewType: 'mixed', size: '0.5MB', isCollab: false },
];

/* --- 2. TODO ITEM COMPONENT WITH CRUD --- */
interface TodoItemProps {
    item: TodoItem;
    onToggle: (id: number) => void;
    onEdit: (id: number, newLabel: string) => void;
    onDelete: (id: number) => void;
}

const TodoItemComponent = ({ item, onToggle, onEdit, onDelete }: TodoItemProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(item.label);
    const inputRef = useRef<HTMLInputElement>(null);
    const itemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editValue.trim()) {
            onEdit(item.id, editValue.trim());
        } else {
            setEditValue(item.label);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setEditValue(item.label);
            setIsEditing(false);
        }
    };

    return (
        <div
            ref={itemRef}
            className={`group flex items-center gap-3 py-2 px-3 rounded-md border transition-all ${item.completed
                ? 'bg-[#66FCF1]/5 border-[#66FCF1]/20'
                : 'bg-[#1F2833]/30 border-transparent hover:border-[#45A29E]/30'
                }`}
        >
            <button
                onClick={() => onToggle(item.id)}
                className="flex-shrink-0 text-[#66FCF1] hover:scale-110 transition-transform"
            >
                {item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} className="text-[#45A29E]/50 group-hover:text-[#66FCF1]" />}
            </button>

            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-[#0B0C10] border border-[#66FCF1] rounded px-2 py-1 text-sm text-white focus:outline-none"
                />
            ) : (
                <span className={`flex-1 text-sm font-mono transition-all ${item.completed ? 'text-[#45A29E] line-through opacity-50' : 'text-[#C5C6C7]'
                    }`}>
                    {item.label}
                </span>
            )}

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 rounded hover:bg-[#66FCF1]/10 text-[#8b9bb4] hover:text-[#66FCF1]"
                    title="Edit"
                >
                    <Edit2 size={14} />
                </button>
                <button
                    onClick={() => onDelete(item.id)}
                    className="p-1 rounded hover:bg-red-500/10 text-[#8b9bb4] hover:text-red-400"
                    title="Delete"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

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
const ProjectCard = ({ project, isSelected, onSelect, onOpen, onContextMenu }: any) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<SVGSVGElement>(null);
    const tlRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);

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
                {/* Collab/Personal Badge */}
                <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-sm text-[9px] font-bold ${project.isCollab ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    }`}>
                    {project.isCollab ? <Users size={10} className="inline mr-1" /> : <User size={10} className="inline mr-1" />}
                    {project.isCollab ? 'TEAM' : 'PERSONAL'}
                </div>
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

/* --- 5. LIST ROW (LIST VIEW) --- */
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
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${project.isCollab ? 'bg-pink-500/20 text-pink-400' : 'bg-indigo-500/20 text-indigo-400'
                }`}>
                {project.isCollab ? 'TEAM' : 'PERSONAL'}
            </div>
            <div className="hidden md:flex items-center gap-6 text-xs text-[#8b9bb4] font-mono">
                {project.users > 0 && <div className="flex items-center gap-1 text-[#66FCF1]"><Users size={12} /> <span>{project.users}</span></div>}
                <span>{project.size}</span>
                <span>{project.edited}</span>
            </div>
        </div>
    );
};

/* --- 6. MAIN DASHBOARD --- */
export const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);
    const [projectFilter, setProjectFilter] = useState<'all' | 'collab' | 'personal'>('all');

    // Todo State with CRUD
    const [todos, setTodos] = useState<TodoItem[]>(INITIAL_TODOS);
    const [newTodoText, setNewTodoText] = useState('');

    // Notifications State
    const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
    const [showNotifications, setShowNotifications] = useState(false);

    const unreadCount = notifications.filter(n => !n.read).length;

    // Todo CRUD Operations
    const addTodo = () => {
        if (newTodoText.trim()) {
            const newTodo: TodoItem = {
                id: Date.now(),
                label: newTodoText.trim(),
                completed: false
            };
            setTodos([...todos, newTodo]);
            setNewTodoText('');
        }
    };

    const toggleTodo = (id: number) => {
        setTodos(todos.map(todo =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
        ));
    };

    const editTodo = (id: number, newLabel: string) => {
        setTodos(todos.map(todo =>
            todo.id === id ? { ...todo, label: newLabel } : todo
        ));
    };

    const deleteTodo = (id: number) => {
        setTodos(todos.filter(todo => todo.id !== id));
    };

    // Notification Operations
    const markNotificationRead = (id: number) => {
        setNotifications(notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
        ));
    };

    const dismissNotification = (id: number) => {
        setNotifications(notifications.filter(n => n.id !== id));
    };

    // Filter projects
    const filteredProjects = MOCK_PROJECTS.filter(project => {
        if (projectFilter === 'all') return true;
        if (projectFilter === 'collab') return project.isCollab;
        if (projectFilter === 'personal') return !project.isCollab;
        return true;
    });

    const collabProjects = MOCK_PROJECTS.filter(p => p.isCollab);
    const personalProjects = MOCK_PROJECTS.filter(p => !p.isCollab);

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
                    <div className="sidebar-el flex items-center gap-3 px-2 py-1.5 rounded-sm bg-[#1F2833] text-white text-sm cursor-pointer"><FolderOpen size={16} className="text-[#66FCF1]" />{!isSidebarCollapsed && <span>All Projects</span>}</div>
                    <div className="sidebar-el flex items-center gap-3 px-2 py-1.5 rounded-sm hover:bg-[#1F2833]/50 text-[#8b9bb4] hover:text-white text-sm cursor-pointer transition-colors"><Clock size={16} />{!isSidebarCollapsed && <span>Recent</span>}</div>
                    <div className="sidebar-el flex items-center gap-3 px-2 py-1.5 rounded-sm hover:bg-[#1F2833]/50 text-[#8b9bb4] hover:text-white text-sm cursor-pointer transition-colors"><FileCode size={16} />{!isSidebarCollapsed && <span>Drafts</span>}</div>

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
                        {!isSidebarCollapsed && <button onClick={handleLogout} className="text-[#8b9bb4] hover:text-[#66FCF1]"><LogOut size={14} /></button>}
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col relative bg-[#0B0C10]" onClick={() => setSelectedId(null)}>

                {/* HEADER */}
                <header className="h-12 border-b border-white/10 flex items-center justify-between px-6 bg-[#0B0C10] z-10">
                    <div className="flex items-center gap-2 text-sm text-[#8b9bb4]">
                        <span className="text-white font-medium">Dashboard</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group w-64 hidden md:block">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#45A29E]" size={14} />
                            <input type="text" placeholder="Jump to file..." className="w-full h-8 bg-[#1F2833] border border-white/10 rounded-sm pl-8 pr-8 text-xs text-white focus:outline-none focus:border-[#66FCF1] transition-all placeholder:text-[#8b9bb4]" />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none"><Command size={10} className="text-[#8b9bb4]" /><span className="text-[10px] font-mono text-[#8b9bb4]">K</span></div>
                        </div>

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

                        {/* TODO SECTION WITH CRUD */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                                    <Terminal size={14} className="text-[#66FCF1]" />
                                    Tasks & Reminders
                                </h2>
                                <span className="text-[10px] font-mono text-[#45A29E]">
                                    {todos.filter(t => t.completed).length}/{todos.length} completed
                                </span>
                            </div>

                            {/* Add New Todo */}
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newTodoText}
                                    onChange={(e) => setNewTodoText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                                    placeholder="Add a new task..."
                                    className="flex-1 h-10 bg-[#1F2833] border border-white/10 rounded-md px-4 text-sm text-white focus:outline-none focus:border-[#66FCF1] transition-all placeholder:text-[#8b9bb4]"
                                />
                                <button
                                    onClick={addTodo}
                                    className="h-10 px-4 bg-[#66FCF1] hover:bg-[#45A29E] text-black font-bold text-sm rounded-md flex items-center gap-2 transition-colors"
                                >
                                    <Plus size={16} />
                                    Add
                                </button>
                            </div>

                            {/* Todo List */}
                            <div className="bg-[#1F2833]/30 border border-white/10 rounded-lg p-3 space-y-2">
                                {todos.length === 0 ? (
                                    <div className="text-center py-8 text-[#8b9bb4] text-sm">
                                        No tasks yet. Add one above!
                                    </div>
                                ) : (
                                    todos.map(item => (
                                        <TodoItemComponent
                                            key={item.id}
                                            item={item}
                                            onToggle={toggleTodo}
                                            onEdit={editTodo}
                                            onDelete={deleteTodo}
                                        />
                                    ))
                                )}
                            </div>
                        </section>

                        {/* COLLABORATIVE PROJECTS SECTION */}
                        {(projectFilter === 'all' || projectFilter === 'collab') && collabProjects.length > 0 && (
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
                                    <button onClick={() => navigate(`/board/${Math.random().toString(36).substr(2, 9)}`)} className="flex items-center gap-2 px-3 py-1.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-400 text-xs font-bold rounded-md transition-all">
                                        <UserPlus size={14} />NEW TEAM BOARD
                                    </button>
                                </div>

                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
                                        {collabProjects.map((project) => (
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
                                        {collabProjects.map((project) => (
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
                        )}

                        {/* PERSONAL PROJECTS SECTION */}
                        {(projectFilter === 'all' || projectFilter === 'personal') && personalProjects.length > 0 && (
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
                                    <button onClick={() => navigate(`/board/${Math.random().toString(36).substr(2, 9)}`)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold rounded-md transition-all">
                                        <Plus size={14} />NEW PERSONAL BOARD
                                    </button>
                                </div>

                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
                                        <div onClick={() => navigate(`/board/${Math.random().toString(36).substr(2, 9)}`)} className="group border border-dashed border-white/20 hover:border-indigo-400 rounded-lg p-4 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-[#1F2833]/50 transition-all min-h-[200px]">
                                            <div className="w-10 h-10 rounded-full bg-[#1F2833] flex items-center justify-center group-hover:scale-110 transition-transform border border-white/10 group-hover:border-indigo-400">
                                                <Plus size={20} className="text-indigo-400" />
                                            </div>
                                            <span className="text-xs font-medium text-[#8b9bb4] group-hover:text-white">Create Personal Board</span>
                                        </div>
                                        {personalProjects.map((project) => (
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
                                        {personalProjects.map((project) => (
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
                        <div className="px-3 py-2 text-xs font-mono text-[#45A29E] border-b border-white/5 mb-1">ID: {contextMenu.id.split('_')[1]}</div>
                        <button className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-[#66FCF1]/10 hover:text-[#66FCF1] flex items-center gap-2"><Edit2 size={14} /> Rename</button>
                        <button className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-[#66FCF1]/10 hover:text-[#66FCF1] flex items-center gap-2"><Copy size={14} /> Duplicate</button>
                        <button className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-[#66FCF1]/10 hover:text-[#66FCF1] flex items-center gap-2"><Share2 size={14} /> Share</button>
                        <div className="h-px bg-white/5 my-1" />
                        <button className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                    </div>
                )}
            </main>
        </div>
    );
};