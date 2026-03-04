import React, { useState, useEffect, useRef, useCallback } from 'react';
import Konva from 'konva';
import { jsPDF } from 'jspdf';
import { Download, FileDown, FileImage, Users, Lock, Unlock, Trash2, Sun, Moon, Sparkles } from 'lucide-react';
import LiveCollaborationMenu from './LiveCollaborationMenu';
import AnalyzeWithAI from './AnalyzeWithAI';
import {
    Shape,
    isRectangle,
    isCircle,
    isEllipse,
    isLine,
    isArrow,
    isTriangle,
} from '../../../types/shapes';

/**
 * HamburgerMenu — Main menu for the whiteboard.
 * 
 * Top-left hamburger icon that toggles a scrollable dropdown panel.
 * Contains grouped sections including Export.
 * Closes on outside-click, Esc, or menu-item selection.
 * 
 * Theme: NovaSketch dark-cyber palette.
 */

interface MenuItem {
    id: string;
    label: string;
    icon?: React.ReactNode | string;
    onClick?: () => void;
    dividerAfter?: boolean;
    subItems?: MenuItem[];
    customContent?: React.ReactNode;
    rightElement?: React.ReactNode;
}

interface MenuSection {
    id: string;
    title: string;
    items: MenuItem[];
}

interface HamburgerMenuProps {
    /** Extra menu sections to render below export */
    extraSections?: MenuSection[];
    /** Export dependencies */
    stageRef?: React.RefObject<Konva.Stage | null>;
    lines?: any[];
    shapes?: Shape[];
    textAnnotations?: any[];
    backgroundColor?: string;

    /** Session lock dependencies */
    isOwner?: boolean;
    isLocked?: boolean;
    onToggleLock?: () => Promise<void>;

    /** Clear canvas action */
    onClearCanvas?: () => void;

    /** Theme toggle */
    theme?: 'light' | 'dark';
    onToggleTheme?: () => void;

    /** Canvas capture callback for AI sharing */
    onCaptureCanvas?: () => Promise<Blob | null>;
}

// ─── SVG Generation (same as ExportTools) ───────────────────
function generateSVGString(
    width: number,
    height: number,
    lines: any[],
    shapes: Shape[],
    textAnnotations: any[],
    backgroundColor: string
): string {
    let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    svgContent += `
    <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#66FCF1" />
        </marker>
    </defs>
    <rect width="100%" height="100%" fill="${backgroundColor}"/>`;

    const sortedShapes = [...shapes].sort((a, b) => a.zIndex - b.zIndex);

    sortedShapes.forEach(shape => {
        if (!shape.visible) return;
        const { position, transform, opacity, style } = shape;
        const fill = style.hasFill ? style.fill : 'none';
        const stroke = style.stroke;
        const strokeWidth = style.strokeWidth;

        let innerSVG = '';
        let transformStr = '';
        let cx = position.x;
        let cy = position.y;

        if (isRectangle(shape)) {
            cx = position.x + shape.width / 2;
            cy = position.y + shape.height / 2;
            transformStr = `translate(${cx}, ${cy}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY}) translate(${-shape.width / 2}, ${-shape.height / 2})`;
            innerSVG = `<rect width="${shape.width}" height="${shape.height}" rx="${shape.cornerRadius || 0}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        } else if (isCircle(shape)) {
            transformStr = `translate(${cx}, ${cy}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})`;
            innerSVG = `<circle r="${shape.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        } else if (isEllipse(shape)) {
            transformStr = `translate(${cx}, ${cy}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})`;
            innerSVG = `<ellipse rx="${shape.radiusX}" ry="${shape.radiusY}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        } else if (isLine(shape) || isArrow(shape)) {
            // Both Line and Arrow share this calculation
            const dx = shape.endPoint.x - shape.startPoint.x;
            const dy = shape.endPoint.y - shape.startPoint.y;
            cx = shape.startPoint.x + dx / 2;
            cy = shape.startPoint.y + dy / 2;
            transformStr = `translate(${cx}, ${cy}) rotate(${transform.rotation})`;

            const markerStr = isArrow(shape) ? ' marker-end="url(#arrowhead)"' : '';
            innerSVG = `<line x1="${-dx / 2}" y1="${-dy / 2}" x2="${dx / 2}" y2="${dy / 2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${markerStr} />`;
        } else if (isTriangle(shape)) {
            cx = (shape.points[0].x + shape.points[1].x + shape.points[2].x) / 3;
            cy = (shape.points[0].y + shape.points[1].y + shape.points[2].y) / 3;
            const pts = shape.points.map(p => `${p.x - cx},${p.y - cy}`).join(' ');
            transformStr = `translate(${cx}, ${cy}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})`;
            innerSVG = `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        }

        if (innerSVG && transformStr) {
            svgContent += `\n    <g transform="${transformStr}" opacity="${opacity}">\n        ${innerSVG}\n    </g>`;
        }
    });

    lines.forEach(line => {
        const points = line.points;
        if (points.length < 2) return;
        let path = `M ${points[0]} ${points[1]}`;
        for (let i = 2; i < points.length; i += 2) {
            path += ` L ${points[i]} ${points[i + 1]}`;
        }
        svgContent += `<path d="${path}" stroke="${line.color}" stroke-width="${line.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
    });

    textAnnotations.forEach((text: any) => {
        const escapedText = text.text
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");

        let textAnchorStr = 'start';
        if (text.textAlign === 'center') textAnchorStr = 'middle';
        else if (text.textAlign === 'right') textAnchorStr = 'end';

        svgContent += `
        <text x="${text.x}" y="${text.y}"
            transform="rotate(${text.rotation || 0}, ${text.x}, ${text.y})"
            font-family="${text.fontFamily}"
            font-size="${text.fontSize}"
            fill="${text.color}"
            font-weight="${text.fontWeight}"
            font-style="${text.fontStyle}"
            text-decoration="${text.textDecoration}"
            dominant-baseline="hanging"
            text-anchor="${textAnchorStr}">${escapedText}</text>`;
    });

    svgContent += `</svg>`;
    return svgContent;
}

// ─── NovaSketch Light Theme Palette ───────────────────────
// Instead of generic white/gray, we use a warm cream-teal palette
// that harmonises with the dark theme's cyber-teal identity.
const LIGHT = {
    bg: '#F8FAFB',           // Soft ice-white
    bgPanel: 'rgba(248,250,251,0.96)',
    bgHover: 'rgba(69,162,158,0.08)',
    bgSub: 'rgba(69,162,158,0.04)',
    border: 'rgba(69,162,158,0.18)',
    borderSub: 'rgba(69,162,158,0.10)',
    accent: '#2A9D8F',       // Warm teal (more vibrant than the dark theme's muted teal)
    accentGlow: 'rgba(42,157,143,0.12)',
    text: '#1A3C40',         // Dark teal-charcoal  (readable, NovaSketch-branded)
    textMuted: '#5B7F82',    // Softer teal-gray
    textSection: 'rgba(42,157,143,0.65)',
    shadow: '0 8px 32px rgba(42,157,143,0.08), 0 2px 12px rgba(0,0,0,0.06)',
    btnShadow: '0 2px 12px rgba(42,157,143,0.18)',
    btnBorder: 'rgba(42,157,143,0.35)',
    btnBg: 'rgba(248,250,251,0.88)',
};

const DARK = {
    bg: '#0B0C10',
    bgPanel: 'rgba(11,12,16,0.92)',
    bgHover: '#1F2833',
    bgSub: 'rgba(11,12,16,0.50)',
    border: 'rgba(102,252,241,0.2)',
    borderSub: 'rgba(102,252,241,0.05)',
    accent: '#66FCF1',
    accentGlow: 'rgba(102,252,241,0.08)',
    text: '#c5c6c7',
    textMuted: '#a0a0a0',
    textSection: 'rgba(102,252,241,0.5)',
    shadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(102,252,241,0.08)',
    btnShadow: '0 0 16px rgba(102,252,241,0.20)',
    btnBorder: 'rgba(102,252,241,0.5)',
    btnBg: 'rgba(11,12,16,0.80)',
};

const palette = (theme: string) => theme === 'dark' ? DARK : LIGHT;

// ─── Render Helpers to Reduce Ternary Nesting ────────────
function getMenuItemColor(theme: string, id: string, isLocked: boolean) {
    if (id === 'lock-session' && isLocked) return '#fbbf24';
    if (id === 'clear-canvas') return '#ef4444';
    return palette(theme).text;
}

function getMenuItemHoverBg(theme: string, id: string, isLocked: boolean) {
    if (id === 'lock-session' && isLocked) return 'rgba(245, 158, 11, 0.1)';
    if (id === 'clear-canvas') return 'rgba(239, 68, 68, 0.1)';
    return palette(theme).bgHover;
}

function getMenuItemHoverColor(theme: string, id: string, isLocked: boolean) {
    if (id === 'lock-session' && isLocked) return '#fbbf24';
    if (id === 'clear-canvas') return '#ef4444';
    return theme === 'dark' ? '#ffffff' : '#0D3B3B';
}

function getMenuIconClass(theme: string, id: string, isLocked: boolean) {
    if (id === 'lock-session' && isLocked) return 'text-amber-400 group-hover:text-amber-300';
    if (id === 'clear-canvas') return 'text-red-400 group-hover:text-red-300';
    return theme === 'dark' ? 'text-[#66FCF1] group-hover:text-white' : 'text-[#2A9D8F] group-hover:text-[#1A3C40]';
}

const HamburgerMenuItemRender: React.FC<{
    item: MenuItem;
    theme: string;
    isLocked: boolean;
    isExpanded: boolean;
    onToggle: (item: MenuItem) => void;
    onItemClick: (item: MenuItem) => void;
}> = ({ item, theme, isLocked, isExpanded, onToggle, onItemClick }) => {
    const handleMainClick = async () => {
        if (item.subItems || item.customContent) {
            onToggle(item);
        } else {
            onItemClick(item);
        }
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.backgroundColor = getMenuItemHoverBg(theme, item.id, isLocked);
        e.currentTarget.style.color = getMenuItemHoverColor(theme, item.id, isLocked);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = getMenuItemColor(theme, item.id, isLocked);
    };

    const handleSubMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.backgroundColor = palette(theme).bgHover;
        e.currentTarget.style.color = theme === 'dark' ? '#ffffff' : '#0D3B3B';
    };

    const handleSubMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = palette(theme).textMuted;
    };

    return (
        <React.Fragment>
            <button
                onClick={handleMainClick}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all duration-200 group"
                style={{ color: getMenuItemColor(theme, item.id, isLocked) }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {item.icon && (
                    <span className={`flex-shrink-0 w-5 flex justify-center transition-colors ${getMenuIconClass(theme, item.id, isLocked)}`}>
                        {item.icon}
                    </span>
                )}
                <span className="font-medium flex-grow">{item.label}</span>

                {item.rightElement && (
                    <div className="flex-shrink-0 ml-auto">
                        {item.rightElement}
                    </div>
                )}

                {(item.subItems || item.customContent) && (
                    <span className="text-[10px] opacity-70 transition-transform duration-200" style={{ color: palette(theme).accent, transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                        ▼
                    </span>
                )}
            </button>

            {item.subItems && isExpanded && (
                <div style={{ background: palette(theme).bgSub, borderTop: `1px solid ${palette(theme).borderSub}`, borderBottom: `1px solid ${palette(theme).borderSub}` }} className="pb-1">
                    {item.subItems.map((sub) => (
                        <button
                            key={sub.id}
                            onClick={() => onItemClick(sub)}
                            className="w-full flex items-center gap-3 pl-11 pr-4 py-2 text-left text-sm transition-all duration-200 group rounded-md"
                            style={{ color: palette(theme).textMuted }}
                            onMouseEnter={handleSubMouseEnter}
                            onMouseLeave={handleSubMouseLeave}
                        >
                            {sub.icon && (
                                <span className={`flex-shrink-0 w-4 flex justify-center transition-colors ${theme === 'dark' ? 'text-[#66FCF1] group-hover:text-white' : 'text-[#2A9D8F] group-hover:text-[#1A3C40]'}`}>
                                    {sub.icon}
                                </span>
                            )}
                            <span>{sub.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {item.customContent && isExpanded && (
                <div style={{ background: palette(theme).bgSub, borderTop: `1px solid ${palette(theme).borderSub}`, borderBottom: `1px solid ${palette(theme).borderSub}` }} className="w-full">
                    {item.customContent}
                </div>
            )}
        </React.Fragment>
    );
};

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
    extraSections = [],
    stageRef,
    lines = [],
    shapes = [],
    textAnnotations = [],
    backgroundColor = '#0b0c10',
    isOwner = false,
    isLocked = false,
    onToggleLock,
    onClearCanvas,
    theme = 'dark',
    onToggleTheme,
    onCaptureCanvas,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedSubmenus, setExpandedSubmenus] = useState<Record<string, boolean>>({});
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen]);

    // ─── Export handlers ────────────────────────────────────
    const getCanvasSize = useCallback(() => {
        if (!stageRef?.current) return null;
        return { width: stageRef.current.width(), height: stageRef.current.height() };
    }, [stageRef]);

    const processCanvasExport = useCallback(
        (callback: (canvas: HTMLCanvasElement, size: { width: number; height: number; }) => void, fillBackground = false) => {
            const size = getCanvasSize();
            if (!size) return;
            const svgString = generateSVGString(size.width, size.height, lines, shapes, textAnnotations, backgroundColor);
            const img = new Image();
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size.width * 2;
                canvas.height = size.height * 2;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    if (fillBackground) {
                        ctx.fillStyle = backgroundColor;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    ctx.scale(2, 2);
                    ctx.drawImage(img, 0, 0);
                    callback(canvas, size);
                }
                URL.revokeObjectURL(url);
            };
            img.src = url;
            setIsOpen(false);
        },
        [getCanvasSize, lines, shapes, textAnnotations, backgroundColor]
    );

    const handleExportImage = useCallback((format: 'png' | 'jpeg') => {
        processCanvasExport((canvas) => {
            const dataURL = canvas.toDataURL(`image/${format}`, 1);
            const link = document.createElement('a');
            link.download = `whiteboard-export.${format}`;
            link.href = dataURL;
            document.body.appendChild(link);
            link.click();
            link.remove();
        }, format === 'jpeg');
    }, [processCanvasExport]);

    const handleExportSVG = useCallback(() => {
        const size = getCanvasSize();
        if (!size) return;
        const svgContent = generateSVGString(size.width, size.height, lines, shapes, textAnnotations, backgroundColor);
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'whiteboard-export.svg';
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setIsOpen(false);
    }, [getCanvasSize, lines, shapes, textAnnotations, backgroundColor]);

    const handleExportPDF = useCallback(() => {
        processCanvasExport((canvas, size) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [size.width, size.height],
            });
            pdf.addImage(imgData, 'PNG', 0, 0, size.width, size.height);
            pdf.save('whiteboard-export.pdf');
        });
    }, [processCanvasExport]);

    // ─── Main Menu Sections ─────────────────────────────
    const mainSection: MenuSection = {
        id: 'main-actions',
        title: 'Actions',
        items: [
            {
                id: 'theme-toggle',
                label: 'Theme',
                icon: theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />,
                rightElement: (
                    <div
                        role="button"
                        tabIndex={0}
                        className="flex items-center gap-0.5 p-[3px] rounded-full transition-all cursor-pointer"
                        style={{
                            border: `1.5px solid ${palette(theme).btnBorder}`,
                            background: theme === 'dark' ? 'rgba(31,40,51,0.6)' : 'rgba(42,157,143,0.06)',
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleTheme?.();
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                e.preventDefault();
                                onToggleTheme?.();
                            }
                        }}
                    >
                        <div className="p-1.5 rounded-full flex items-center justify-center transition-all duration-200"
                            style={{
                                background: theme === 'light' ? '#2A9D8F' : 'transparent',
                                boxShadow: theme === 'light' ? '0 1px 6px rgba(42,157,143,0.35)' : 'none',
                            }}
                        >
                            <Sun size={13} color={theme === 'light' ? '#fff' : '#6b7280'} strokeWidth={2.5} />
                        </div>
                        <div className="p-1.5 rounded-full flex items-center justify-center transition-all duration-200"
                            style={{
                                background: theme === 'dark' ? '#1F2833' : 'transparent',
                                boxShadow: theme === 'dark' ? '0 1px 6px rgba(102,252,241,0.3)' : 'none',
                            }}
                        >
                            <Moon size={13} color={theme === 'dark' ? '#66FCF1' : '#b0b8b9'} strokeWidth={2.5} />
                        </div>
                    </div>
                )
            },
            {
                id: 'collaboration',
                label: 'Live collaboration...',
                icon: <Users size={16} />,
                customContent: <LiveCollaborationMenu roomId="c8589ed6-mock" theme={theme} />
            },
            {
                id: 'analyze-ai',
                label: 'Analyze with AI',
                icon: <Sparkles size={16} />,
                customContent: <AnalyzeWithAI theme={theme} onCaptureCanvas={onCaptureCanvas} />
            },
            // Include Lock Session only if user is owner
            ...(isOwner ? [{
                id: 'lock-session',
                label: isLocked ? 'Unlock Session' : 'Lock Session',
                icon: isLocked ? <Unlock size={16} /> : <Lock size={16} />,
                onClick: async () => {
                    if (onToggleLock) {
                        try {
                            await onToggleLock();
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
            }] : []),
            {
                id: 'clear-canvas',
                label: 'Clear Canvas',
                icon: <Trash2 size={16} />,
                onClick: () => {
                    if (onClearCanvas) {
                        onClearCanvas();
                    }
                }
            },
            {
                id: 'export',
                label: 'Export Canvas',
                icon: <Download size={16} />,
                subItems: [
                    { id: 'export-png', label: 'Export as PNG', icon: <FileImage size={16} />, onClick: () => handleExportImage('png') },
                    { id: 'export-jpg', label: 'Export as JPG', icon: <FileImage size={16} />, onClick: () => handleExportImage('jpeg') },
                    { id: 'export-svg', label: 'Export as SVG', icon: <FileDown size={16} />, onClick: handleExportSVG },
                    { id: 'export-pdf', label: 'Export as PDF', icon: <FileDown size={16} />, onClick: handleExportPDF },
                ]
            }
        ],
    };

    const allSections = [mainSection, ...extraSections];

    const handleItemClick = useCallback((item: MenuItem) => {
        item.onClick?.();
    }, []);

    return (
        <div ref={containerRef} className="fixed top-4 left-4 z-50 select-none">
            {/* Hamburger button — premium glassmorphism style */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#66FCF1]/50"
                style={{
                    background: isOpen
                        ? palette(theme).bgPanel
                        : palette(theme).btnBg,
                    border: `1.5px solid ${isOpen ? palette(theme).accent : palette(theme).btnBorder}`,
                    boxShadow: isOpen
                        ? `0 0 24px ${palette(theme).accentGlow}`
                        : palette(theme).btnShadow,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                }}
                title={isOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                {/* Subtle pulse ring on hover */}
                <span
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                        boxShadow: `inset 0 0 0 1px ${palette(theme).accent}, 0 0 16px ${palette(theme).accentGlow}`,
                    }}
                />

                {/* Animated hamburger → X */}
                <div className="relative z-10" style={{ width: 16, height: 14 }}>
                    {/* Top bar */}
                    <span
                        className="absolute block rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                        style={{
                            width: 16,
                            height: 2,
                            left: 0,
                            backgroundColor: palette(theme).accent,
                            top: isOpen ? 6 : 1,
                            transform: isOpen ? 'rotate(45deg)' : 'none',
                            transformOrigin: 'center',
                        }}
                    />
                    {/* Middle bar */}
                    <span
                        className="absolute block rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                        style={{
                            width: 16,
                            height: 2,
                            left: 0,
                            backgroundColor: palette(theme).accent,
                            top: 6,
                            opacity: isOpen ? 0 : 1,
                        }}
                    />
                    {/* Bottom bar */}
                    <span
                        className="absolute block rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                        style={{
                            width: 16,
                            height: 2,
                            left: 0,
                            backgroundColor: palette(theme).accent,
                            top: isOpen ? 6 : 11,
                            transform: isOpen ? 'rotate(-45deg)' : 'none',
                            transformOrigin: 'center',
                        }}
                    />
                </div>
            </button>

            {/* Dropdown panel */}
            {
                isOpen && (
                    <div
                        className="mt-2 rounded-xl overflow-hidden"
                        style={{
                            background: palette(theme).bgPanel,
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: `1px solid ${palette(theme).border}`,
                            boxShadow: palette(theme).shadow,
                            minWidth: 240,
                            maxHeight: '70vh',
                            animation: 'menuSlideIn 0.25s cubic-bezier(0.16,1,0.3,1)',
                        }}
                    >
                        {/* Header with NovaSketch branding */}
                        <div
                            className="px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2.5"
                            style={{
                                color: palette(theme).accent,
                                borderBottom: `1px solid ${palette(theme).borderSub}`,
                                background: theme === 'dark' ? 'rgba(102,252,241,0.03)' : 'rgba(42,157,143,0.03)',
                            }}
                        >
                            <span style={{ fontSize: 14, opacity: 0.8 }}>✦</span>
                            <span>NovaSketch</span>
                        </div>

                        {/* Scrollable sections */}
                        <div
                            className="py-1.5 overflow-y-auto"
                            style={{ maxHeight: 'calc(70vh - 48px)' }}
                        >
                            {allSections.map((section, sIdx) => (
                                <div key={section.id}>
                                    {/* Section header */}
                                    <div
                                        className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em]"
                                        style={{ color: palette(theme).textSection }}
                                    >
                                        {section.title}
                                    </div>

                                    {/* Section items */}
                                    {section.items.map((item) => (
                                        <HamburgerMenuItemRender
                                            key={item.id}
                                            item={item}
                                            theme={theme}
                                            isLocked={isLocked}
                                            isExpanded={!!expandedSubmenus[item.id]}
                                            onToggle={(i) => setExpandedSubmenus(prev => ({ ...prev, [i.id]: !prev[i.id] }))}
                                            onItemClick={handleItemClick}
                                        />
                                    ))}

                                    {/* Section divider (except last) */}
                                    {sIdx < allSections.length - 1 && (
                                        <div className="mx-3 my-1.5" style={{ borderTop: `1px solid ${palette(theme).borderSub}` }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Slide-in animation */}
            <style>{`
                @keyframes menuSlideIn {
                    from { opacity: 0; transform: translateY(-10px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div >
    );
};

export default HamburgerMenu;
