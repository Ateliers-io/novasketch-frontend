import React, { useState } from 'react';

interface AnalyzeWithAIProps {
    theme?: string;
    onCaptureCanvas?: () => Promise<Blob | null>;
}

const AnalyzeWithAI: React.FC<AnalyzeWithAIProps> = ({ theme = 'dark', onCaptureCanvas }) => {
    const [status, setStatus] = useState<string | null>(null);
    const isLight = theme === 'light';

    const captureAndOpen = async (service: 'chatgpt' | 'gemini') => {
        if (onCaptureCanvas) {
            try {
                setStatus('Capturing...');
                const blob = await onCaptureCanvas();
                if (blob) {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    setStatus('Image copied!');
                    setTimeout(() => setStatus(null), 2500);
                } else {
                    setStatus('No drawing found');
                    setTimeout(() => setStatus(null), 2000);
                }
            } catch (err) {
                console.error('Failed to capture/copy canvas:', err);
                setStatus('Copy failed');
                setTimeout(() => setStatus(null), 2000);
            }
        }

        if (service === 'chatgpt') {
            window.open('https://chatgpt.com/', '_blank');
        } else {
            window.open('https://gemini.google.com/app', '_blank');
        }
    };

    return (
        <div className="flex flex-col gap-3 px-4 py-3">
            {/* Description */}
            <div className="text-[11px] leading-relaxed" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                Capture your whiteboard and send it to AI for analysis. The drawing is copied to your clipboard — just <strong>Ctrl+V</strong> to paste it in the chat.
            </div>

            {/* AI Buttons */}
            <div className="flex items-center justify-center gap-6 w-full py-1">
                <button
                    onClick={() => captureAndOpen('chatgpt')}
                    className="flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-1 active:scale-95 group"
                >
                    <div
                        className="w-12 h-12 rounded-[14px] shadow-sm flex items-center justify-center p-2 border transition-shadow group-hover:shadow-md"
                        style={{
                            borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)',
                            background: isLight ? '#fff' : '#1e293b'
                        }}
                    >
                        <img src="/share-icons/chatgpt.webp" alt="ChatGPT" className="w-full h-full object-contain transition-all group-hover:scale-110" />
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: isLight ? '#475569' : '#94a3b8' }}>ChatGPT</span>
                </button>

                <button
                    onClick={() => captureAndOpen('gemini')}
                    className="flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-1 active:scale-95 group"
                >
                    <div
                        className="w-12 h-12 rounded-[14px] shadow-sm flex items-center justify-center p-2 border transition-shadow group-hover:shadow-md"
                        style={{
                            borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)',
                            background: isLight ? '#fff' : '#1e293b'
                        }}
                    >
                        <img src="/share-icons/gemini.webp" alt="Gemini" className="w-full h-full object-contain transition-all group-hover:scale-110" />
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: isLight ? '#475569' : '#94a3b8' }}>Gemini</span>
                </button>
            </div>

            {/* Status toast */}
            {status && (
                <div
                    className="text-center text-[11px] font-medium py-2 px-3 rounded-lg transition-all"
                    style={{
                        backgroundColor: status === 'Image copied!'
                            ? (isLight ? 'rgba(42,157,143,0.12)' : 'rgba(102,252,241,0.12)')
                            : status === 'Capturing...'
                                ? (isLight ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.12)')
                                : (isLight ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.1)'),
                        color: status === 'Image copied!'
                            ? (isLight ? '#2A9D8F' : '#66FCF1')
                            : status === 'Capturing...'
                                ? (isLight ? '#3b82f6' : '#60a5fa')
                                : '#ef4444',
                        border: `1px solid ${status === 'Image copied!' ? (isLight ? 'rgba(42,157,143,0.2)' : 'rgba(102,252,241,0.2)') : 'transparent'}`,
                    }}
                >
                    {status === 'Capturing...' && (
                        <div className="flex items-center justify-center gap-2">
                            <span className="animate-pulse">📸</span> Capturing your drawing...
                        </div>
                    )}
                    {status === 'Image copied!' && (
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1.5">
                                <span>✅</span>
                                <span className="font-bold">Image copied to clipboard!</span>
                            </div>
                            <div className="text-[10px] mt-0.5 flex items-center gap-1" style={{ opacity: 0.85 }}>
                                Now press
                                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{
                                    background: isLight ? '#e2e8f0' : '#334155',
                                    border: `1px solid ${isLight ? '#cbd5e1' : '#475569'}`,
                                }}>Ctrl</kbd>
                                <span>+</span>
                                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{
                                    background: isLight ? '#e2e8f0' : '#334155',
                                    border: `1px solid ${isLight ? '#cbd5e1' : '#475569'}`,
                                }}>V</kbd>
                                in the AI chat to paste
                            </div>
                        </div>
                    )}
                    {status !== 'Image copied!' && status !== 'Capturing...' && (
                        <div className="flex items-center justify-center gap-2">
                            <span>⚠️</span> {status}
                        </div>
                    )}
                </div>
            )}

            {/* Attributions */}
            <div className="text-[9px] text-center pt-2 border-t flex flex-col gap-0.5" style={{ color: isLight ? '#94a3b8' : '#475569', borderColor: isLight ? '#f1f5f9' : '#1e293b' }}>
                <a href="https://www.flaticon.com/free-icons/chatgpt" title="chatgpt icons" target="_blank" rel="noreferrer" className="hover:underline">Chatgpt icons created by Freepik - Flaticon</a>
            </div>
        </div>
    );
};

export default AnalyzeWithAI;
