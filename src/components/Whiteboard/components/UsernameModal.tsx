import React, { useState, useRef, useEffect } from 'react';
import { User, ArrowRight } from 'lucide-react';

interface UsernameModalProps {
    onSubmit: (name: string) => void;
}

export const UsernameModal: React.FC<UsernameModalProps> = ({ onSubmit }) => {
    const [name, setName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus the input when the modal mounts
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const trimmedName = name.trim();
    const isValid = trimmedName.length > 0;

    const handleSubmit = () => {
        if (isValid) {
            onSubmit(trimmedName);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B0C10]/80 backdrop-blur-md transition-all duration-300">

            {/* Modal Container */}
            <div
                className="relative w-full max-w-md mx-4 overflow-hidden bg-[#12141D]/90 rounded-2xl shadow-[0_0_40px_rgba(102,252,241,0.15)] border border-[#66FCF1]/20 p-8"
                role="dialog"
                aria-labelledby="username-modal-title"
                aria-modal="true"
            >

                {/* Subtle top glow effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-[#66FCF1]/50 to-transparent" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-[2px] bg-gradient-to-r from-transparent via-[#66FCF1] to-transparent shadow-[0_0_15px_#66FCF1]" />

                <div className="flex flex-col items-center text-center space-y-6">

                    {/* Icon Badge */}
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#66FCF1]/10 border border-[#66FCF1]/30 shadow-[0_0_20px_rgba(102,252,241,0.2)]">
                        <User className="w-8 h-8 text-[#66FCF1]" />
                    </div>

                    {/* Text Content */}
                    <div className="space-y-2">
                        <h2 id="username-modal-title" className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
                            Who is joining?
                        </h2>
                        <p className="text-sm text-gray-400">
                            Enter your display name so your collaborators know who you are on the canvas.
                        </p>
                    </div>

                    {/* Input Area */}
                    <div className="w-full space-y-4 pt-2">
                        <div className="relative group">
                            <input
                                ref={inputRef}
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="E.g. Alex"
                                maxLength={30}
                                className="w-full h-12 px-4 py-2 text-white bg-[#0B0C10] border border-gray-700/80 rounded-xl outline-none transition-all duration-200 focus:border-[#66FCF1] focus:ring-1 focus:ring-[#66FCF1]/50 placeholder:text-gray-600"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={!isValid}
                            className={`
                group relative flex items-center justify-center w-full h-12 gap-2 font-semibold text-sm rounded-xl transition-all duration-300 overflow-hidden
                ${isValid
                                    ? 'bg-[#66FCF1] text-[#0B0C10] hover:bg-[#45A29E] hover:shadow-[0_0_20px_rgba(102,252,241,0.4)] active:scale-[0.98]'
                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50'
                                }
              `}
                        >
                            <span>Join Canvas</span>
                            <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${isValid ? 'group-hover:translate-x-1' : ''}`} />
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
