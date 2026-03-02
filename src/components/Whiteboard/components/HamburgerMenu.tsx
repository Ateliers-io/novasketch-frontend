import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * HamburgerMenu — Main menu for the whiteboard.
 * 
 * Displays a hamburger icon in the top-left corner. On click, toggles a
 * scrollable dropdown panel with placeholder menu items. Closes on
 * outside-click, Esc key, or menu-item selection.
 * 
 * Theme tokens match the existing NovaSketch dark-cyber palette:
 *  - Background: rgba(11,12,16, 0.92)  (same as PresenceBadge dropdown)
 *  - Border / accent: #66FCF1
 *  - Text: #c5c6c7 → white on hover
 *  - Hover row: #1F2833
 */

interface MenuItem {
    id: string;
    label: string;
    icon: string;         // emoji icon (consistent with existing project style)
    onClick?: () => void;
    dividerAfter?: boolean;
}

interface HamburgerMenuProps {
    /** Menu items to render in the dropdown */
    items?: MenuItem[];
}

const DEFAULT_ITEMS: MenuItem[] = [
    { id: 'placeholder', label: 'Menu items coming soon…', icon: '🚧' },
];

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ items = DEFAULT_ITEMS }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen]);

    const handleItemClick = useCallback((item: MenuItem) => {
        item.onClick?.();
        setIsOpen(false);
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
                {/* Animated hamburger → X morphing icon */}
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

                    {/* Scrollable item list */}
                    <div
                        className="py-1 overflow-y-auto"
                        style={{ maxHeight: 'calc(70vh - 44px)' }}
                    >
                        {items.map((item) => (
                            <React.Fragment key={item.id}>
                                <button
                                    onClick={() => handleItemClick(item)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all duration-200 group"
                                    style={{ color: '#c5c6c7' }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#1F2833';
                                        e.currentTarget.style.color = '#ffffff';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = '#c5c6c7';
                                    }}
                                >
                                    <span className="text-base flex-shrink-0 w-5 text-center">{item.icon}</span>
                                    <span className="font-medium">{item.label}</span>
                                </button>
                                {item.dividerAfter && (
                                    <div className="mx-3 my-1" style={{ borderTop: '1px solid rgba(102,252,241,0.08)' }} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}

            {/* Keyframe for slide-in animation */}
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
