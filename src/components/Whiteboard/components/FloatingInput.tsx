/**
 * FloatingInput component for text editing on the canvas.
 * Extracted from Whiteboard.tsx (lines 211-266).
 */
import React, { useRef, useEffect } from 'react';
import { getFontFamilyWithFallback } from '../utils/mathUtils';

interface FloatingInputProps {
    x: number;
    y: number;
    style: {
        size?: number;
        family?: string;
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        textAlign?: 'left' | 'center' | 'right';
        color?: string;
        fontSize?: number;
    };
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
}

const FloatingInput: React.FC<FloatingInputProps> = ({ x, y, style, value, onChange, onSubmit }) => {
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        // auto-focus on mount with slight delay to ensure DOM is ready
        const timer = setTimeout(() => {
            ref.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
        if (e.key === 'Escape') {
            onChange(''); // clear input
            onSubmit();   // close
        }
    };

    return (
        <div
            className="fixed z-[99999]"
            style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(10px, 10px)'
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="bg-[#1a2026]/95 backdrop-blur-md p-2 rounded-lg shadow-2xl border border-[#2d2d44] ring-1 ring-white/10">
                <textarea
                    ref={ref}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type something..."
                    className="block w-full h-full bg-transparent text-white outline-none resize-none overflow-hidden min-w-[200px] min-h-[50px] placeholder:text-gray-500"
                    style={{
                        fontSize: `${style.size || style.fontSize || 18}px`,
                        fontFamily: getFontFamilyWithFallback(style.family || 'Arial'),
                        fontWeight: style.bold ? 'bold' : 'normal',
                        fontStyle: style.italic ? 'italic' : 'normal',
                        textDecoration: style.underline ? 'underline' : 'none',
                        textAlign: style.textAlign || 'left',
                        color: style.color,
                    }}
                />
                <div className="text-[10px] text-gray-500 text-right px-1 pt-1 font-mono">Press Enter to save</div>
            </div>
        </div>
    );
};

export default FloatingInput;
