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
        // slight delay needed to ensure DOM is ready before focusing.
        // react sometimes swallows the focus if we do it synchronously on mount.
        const timer = setTimeout(() => {
            ref.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // shift+enter for new lines, plain enter to submit/close.
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
        // escape to cancel. clearing input effectively deletes the temp text node in parent.
        if (e.key === 'Escape') {
            onChange('');
            onSubmit();
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
            // vital: stop propagation to prevent the canvas underneath from verifying a click
            // and deselecting us or starting a new shape drawing.
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
                        // fallback logic handled in utils, keeping default just in case.
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
