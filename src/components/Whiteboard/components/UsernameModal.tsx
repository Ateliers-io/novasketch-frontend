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
    inputRef.current?.focus();
  }, []);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0;

  const handleSubmit = () => {
    if (isValid) onSubmit(trimmedName);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(11, 12, 16, 0.82)', backdropFilter: 'blur(10px)' }}
    >
      {/* Modal Container */}
      <div
        role="dialog"
        aria-labelledby="username-modal-title"
        aria-modal="true"
        className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden border border-white/10"
        style={{
          background: 'rgba(18, 20, 29, 0.92)',
          boxShadow: '0 0 48px rgba(102,252,241,0.12), 0 24px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Top neon border accent */}
        <div
          className="absolute top-0 inset-x-0 h-[1px]"
          style={{ background: 'linear-gradient(90deg, transparent, #66FCF1 50%, transparent)' }}
        />

        <div className="flex flex-col items-center text-center px-8 py-10 gap-6">

          {/* Icon Badge */}
          <div
            className="flex items-center justify-center w-16 h-16 rounded-full border"
            style={{
              background: 'rgba(102,252,241,0.08)',
              borderColor: 'rgba(102,252,241,0.25)',
              boxShadow: '0 0 24px rgba(102,252,241,0.18)',
            }}
          >
            <User className="w-7 h-7" style={{ color: '#66FCF1' }} />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2
              id="username-modal-title"
              className="text-2xl font-bold tracking-tight text-white"
            >
              Who is joining?
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Enter your display name so your collaborators know who you are on the canvas.
            </p>
          </div>

          {/* Input */}
          <div className="w-full">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={30}
              className="w-full h-12 px-4 text-white rounded-xl outline-none transition-all duration-200"
              style={{
                background: 'rgba(11,12,16,0.9)',
                border: `1px solid ${isValid ? 'rgba(102,252,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: isValid ? '0 0 12px rgba(102,252,241,0.1)' : 'none',
              }}
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="group relative flex items-center justify-center w-full h-12 gap-2 font-semibold text-sm rounded-xl transition-all duration-300"
            style={
              isValid
                ? {
                    background: '#66FCF1',
                    color: '#0B0C10',
                    boxShadow: '0 0 20px rgba(102,252,241,0.3)',
                  }
                : {
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.25)',
                    cursor: 'not-allowed',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }
            }
          >
            <span>Join Canvas</span>
            <ArrowRight
              className={`w-4 h-4 transition-transform duration-300 ${isValid ? 'group-hover:translate-x-1' : ''}`}
            />
          </button>

        </div>
      </div>
    </div>
  );
};
