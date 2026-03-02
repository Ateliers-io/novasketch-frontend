import React, { useState, useEffect, useRef, useCallback } from 'react';
import Konva from 'konva';
import { jsPDF } from 'jspdf';
import { Download, FileDown, FileImage, Users, Lock, Unlock, Trash2 } from 'lucide-react';
import LiveCollaborationMenu from './LiveCollaborationMenu';
import {
    Shape,
    isRectangle,
    isCircle,
    isEllipse,
    isLine,
    isArrow,
    isTriangle,
    RectangleShape,
    CircleShape,
    EllipseShape,
    LineShape,
    ArrowShape,
    TriangleShape,
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
    icon: React.ReactNode | string;
    onClick?: () => void;
    dividerAfter?: boolean;
    subItems?: MenuItem[];
    customContent?: React.ReactNode;
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

        if (isRectangle(shape)) {
            const s = shape as RectangleShape;
            const cx = position.x + s.width / 2;
            const cy = position.y + s.height / 2;
            svgContent += `
            <g transform="translate(${cx}, ${cy}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY}) translate(${-s.width / 2}, ${-s.height / 2})" opacity="${opacity}">
                <rect width="${s.width}" height="${s.height}" rx="${s.cornerRadius || 0}"
                    fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            </g>`;
        } else if (isCircle(shape)) {
            const s = shape as CircleShape;
            svgContent += `
            <g transform="translate(${position.x}, ${position.y}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})" opacity="${opacity}">
                <circle r="${s.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            </g>`;
        } else if (isEllipse(shape)) {
            const s = shape as EllipseShape;
            svgContent += `
            <g transform="translate(${position.x}, ${position.y}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})" opacity="${opacity}">
                <ellipse rx="${s.radiusX}" ry="${s.radiusY}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            </g>`;
        } else if (isLine(shape)) {
            const s = shape as LineShape;
            const dx = s.endPoint.x - s.startPoint.x;
            const dy = s.endPoint.y - s.startPoint.y;
            const midX = s.startPoint.x + dx / 2;
            const midY = s.startPoint.y + dy / 2;
            svgContent += `
            <g transform="translate(${midX}, ${midY}) rotate(${transform.rotation})" opacity="${opacity}">
                <line x1="${-dx / 2}" y1="${-dy / 2}" x2="${dx / 2}" y2="${dy / 2}"
                    stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" />
            </g>`;
        } else if (isArrow(shape)) {
            const s = shape as ArrowShape;
            const dx = s.endPoint.x - s.startPoint.x;
            const dy = s.endPoint.y - s.startPoint.y;
            const midX = s.startPoint.x + dx / 2;
            const midY = s.startPoint.y + dy / 2;
            svgContent += `
            <g transform="translate(${midX}, ${midY}) rotate(${transform.rotation})" opacity="${opacity}">
                <line x1="${-dx / 2}" y1="${-dy / 2}" x2="${dx / 2}" y2="${dy / 2}"
                    stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" marker-end="url(#arrowhead)" />
            </g>`;
        } else if (isTriangle(shape)) {
            const s = shape as TriangleShape;
            const cx = (s.points[0].x + s.points[1].x + s.points[2].x) / 3;
            const cy = (s.points[0].y + s.points[1].y + s.points[2].y) / 3;
            const pts = s.points.map(p => `${p.x - cx},${p.y - cy}`).join(' ');
            svgContent += `
            <g transform="translate(${cx}, ${cy}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})" opacity="${opacity}">
                <polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            </g>`;
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
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

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
            text-anchor="${text.textAlign === 'center' ? 'middle' : text.textAlign === 'right' ? 'end' : 'start'}">${escapedText}</text>`;
    });

    svgContent += `</svg>`;
    return svgContent;
}

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

    const handleExportImage = useCallback((format: 'png' | 'jpeg') => {
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
                if (format === 'jpeg') {
                    ctx.fillStyle = backgroundColor;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                ctx.scale(2, 2);
                ctx.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL(`image/${format}`, 1.0);
                const link = document.createElement('a');
                link.download = `whiteboard-export.${format}`;
                link.href = dataURL;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            URL.revokeObjectURL(url);
        };
        img.src = url;
        setIsOpen(false);
    }, [getCanvasSize, lines, shapes, textAnnotations, backgroundColor]);

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
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsOpen(false);
    }, [getCanvasSize, lines, shapes, textAnnotations, backgroundColor]);

    const handleExportPDF = useCallback(() => {
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
                ctx.scale(2, 2);
                ctx.drawImage(img, 0, 0);
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'px',
                    format: [size.width, size.height],
                });
                pdf.addImage(imgData, 'PNG', 0, 0, size.width, size.height);
                pdf.save('whiteboard-export.pdf');
            }
            URL.revokeObjectURL(url);
        };
        img.src = url;
        setIsOpen(false);
    }, [getCanvasSize, lines, shapes, textAnnotations, backgroundColor]);

    // ─── Main Menu Sections ─────────────────────────────
    const mainSection: MenuSection = {
        id: 'main-actions',
        title: 'Actions',
        items: [
            {
                id: 'collaboration',
                label: 'Live collaboration...',
                icon: <Users size={16} />,
                customContent: <LiveCollaborationMenu roomId="c8589ed6-mock" />
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
            {/* Hamburger button */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="group flex items-center justify-center w-11 h-11 rounded-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#66FCF1]/50"
                style={{
                    background: isOpen ? 'rgba(11, 12, 16, 0.92)' : 'transparent',
                    border: `2px solid ${isOpen ? '#66FCF1' : 'rgba(102,252,241,0.5)'}`,
                    boxShadow: isOpen
                        ? '0 0 20px rgba(102,252,241,0.25)'
                        : '0 0 10px rgba(102,252,241,0.15)',
                }}
                title={isOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                {/* Animated hamburger → X */}
                <div className="flex flex-col items-center justify-center gap-[5px] w-5 h-5 relative">
                    <span
                        className="block h-[2px] w-5 rounded-full transition-all duration-300"
                        style={{
                            backgroundColor: '#66FCF1',
                            transform: isOpen ? 'rotate(45deg) translate(2.5px, 2.5px)' : 'none',
                        }}
                    />
                    <span
                        className="block h-[2px] w-5 rounded-full transition-all duration-300"
                        style={{
                            backgroundColor: '#66FCF1',
                            opacity: isOpen ? 0 : 1,
                            transform: isOpen ? 'scaleX(0)' : 'scaleX(1)',
                        }}
                    />
                    <span
                        className="block h-[2px] w-5 rounded-full transition-all duration-300"
                        style={{
                            backgroundColor: '#66FCF1',
                            transform: isOpen ? 'rotate(-45deg) translate(2.5px, -2.5px)' : 'none',
                        }}
                    />
                </div>
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div
                    className="mt-2 rounded-xl overflow-hidden"
                    style={{
                        background: 'rgba(11, 12, 16, 0.92)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(102,252,241,0.2)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(102,252,241,0.08)',
                        minWidth: 220,
                        maxHeight: '70vh',
                        animation: 'menuSlideIn 0.2s ease-out',
                    }}
                >
                    {/* Header */}
                    <div
                        className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest flex items-center gap-2"
                        style={{
                            color: '#66FCF1',
                            borderBottom: '1px solid rgba(102,252,241,0.1)',
                        }}
                    >
                        <span>☰</span>
                        <span>Menu</span>
                    </div>

                    {/* Scrollable sections */}
                    <div
                        className="py-1 overflow-y-auto"
                        style={{ maxHeight: 'calc(70vh - 44px)' }}
                    >
                        {allSections.map((section, sIdx) => (
                            <div key={section.id}>
                                {/* Section header */}
                                <div
                                    className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.15em]"
                                    style={{ color: 'rgba(102,252,241,0.5)' }}
                                >
                                    {section.title}
                                </div>

                                {/* Section items */}
                                {section.items.map((item) => (
                                    <React.Fragment key={item.id}>
                                        <button
                                            onClick={async () => {
                                                // Prevent closing menu explicitly if clicking a parent with customContent or subItems
                                                if (item.subItems || item.customContent) {
                                                    setExpandedSubmenus(prev => ({
                                                        ...prev,
                                                        [item.id]: !prev[item.id]
                                                    }));
                                                } else {
                                                    await handleItemClick(item);
                                                }
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all duration-200 group"
                                            style={{
                                                // If it's the lock button and it's locked, use amber text. If clear canvas use red if needed, else default text color.
                                                color: (item.id === 'lock-session' && isLocked) ? '#fbbf24' : (item.id === 'clear-canvas' ? '#ef4444' : '#c5c6c7')
                                            }}
                                            onMouseEnter={(e) => {
                                                if (item.id === 'lock-session' && isLocked) {
                                                    e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                                                    e.currentTarget.style.color = '#fbbf24';
                                                } else if (item.id === 'clear-canvas') {
                                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                                    e.currentTarget.style.color = '#ef4444';
                                                } else {
                                                    e.currentTarget.style.backgroundColor = '#1F2833';
                                                    e.currentTarget.style.color = '#ffffff';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = (item.id === 'lock-session' && isLocked) ? '#fbbf24' : (item.id === 'clear-canvas' ? '#ef4444' : '#c5c6c7');
                                            }}
                                        >
                                            <span
                                                className={`flex-shrink-0 w-5 flex justify-center transition-colors ${(item.id === 'lock-session' && isLocked)
                                                        ? 'text-amber-400 group-hover:text-amber-300'
                                                        : (item.id === 'clear-canvas')
                                                            ? 'text-red-400 group-hover:text-red-300'
                                                            : 'text-[#66FCF1] group-hover:text-white'
                                                    }`}
                                            >{item.icon}</span>
                                            <span className="font-medium flex-grow">{item.label}</span>
                                            {/* Expand indicator chevron if subItems OR customContent exists */}
                                            {(item.subItems || item.customContent) && (
                                                <span className="text-[10px] opacity-70 transition-transform duration-200 text-[#66FCF1]" style={{ transform: expandedSubmenus[item.id] ? 'rotate(180deg)' : 'none' }}>
                                                    ▼
                                                </span>
                                            )}
                                        </button>

                                        {/* Sub-items block (retained from previous fix) */}
                                        {item.subItems && expandedSubmenus[item.id] && (
                                            <div className="bg-[#0B0C10]/50 border-y border-[rgba(102,252,241,0.05)] pb-1">
                                                {item.subItems.map((sub) => (
                                                    <button
                                                        key={sub.id}
                                                        onClick={() => handleItemClick(sub)}
                                                        className="w-full flex items-center gap-3 pl-11 pr-4 py-2 text-left text-sm transition-all duration-200 group"
                                                        style={{ color: '#a0a0a0' }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#1F2833';
                                                            e.currentTarget.style.color = '#ffffff';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                            e.currentTarget.style.color = '#a0a0a0';
                                                        }}
                                                    >
                                                        <span className="flex-shrink-0 w-4 flex justify-center text-[#66FCF1] group-hover:text-white transition-colors">{sub.icon}</span>
                                                        <span>{sub.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Custom content block (for inline UI like QR code) */}
                                        {item.customContent && expandedSubmenus[item.id] && (
                                            <div className="bg-[#0B0C10]/50 border-y border-[rgba(102,252,241,0.05)] w-full">
                                                {item.customContent}
                                            </div>
                                        )}
                                    </React.Fragment>
                                ))}

                                {/* Section divider (except last) */}
                                {sIdx < allSections.length - 1 && (
                                    <div className="mx-3 my-1.5" style={{ borderTop: '1px solid rgba(102,252,241,0.08)' }} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Slide-in animation */}
            <style>{`
                @keyframes menuSlideIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default HamburgerMenu;
