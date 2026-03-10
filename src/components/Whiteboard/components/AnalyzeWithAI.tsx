import React, { useState } from 'react';

interface AnalyzeWithAIProps {
    theme?: string;
    onCaptureCanvas?: () => Promise<Blob | null>;
}

/* ── Toast styling helpers (keeps main component under Sonar's complexity threshold) ── */
function getToastStyles(status: string | null, isLight: boolean) {
    let bg = isLight ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.1)';
    let color = '#ef4444';
    let border = 'transparent';

    if (status === 'Image copied!') {
        bg = isLight ? 'rgba(42,157,143,0.12)' : 'rgba(102,252,241,0.12)';
        color = isLight ? '#3B82F6' : '#3B82F6';
        border = isLight ? 'rgba(42,157,143,0.2)' : 'rgba(102,252,241,0.2)';
    } else if (status === 'Capturing...') {
        bg = isLight ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.12)';
        color = isLight ? '#3b82f6' : '#60a5fa';
    }

    return { bg, color, border };
}

function getKbdStyle(isLight: boolean) {
    return {
        background: isLight ? '#e2e8f0' : '#334155',
        border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
    };
}

/* ── Toast content sub-component ── */
const StatusToast: React.FC<{ status: string; isLight: boolean }> = ({ status, isLight }) => {
    const { bg, color, border } = getToastStyles(status, isLight);
    const kbdStyle = getKbdStyle(isLight);

    return (
        <div
            className="text-center text-[11px] font-medium py-2 px-3 rounded-lg transition-all"
            style={{
                backgroundColor: bg,
                color,
                border: `1px solid ${border}`,
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
                        Now press{' '}
                        <kbd className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={kbdStyle}>Ctrl</kbd>
                        <span>+</span>
                        <kbd className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={kbdStyle}>V</kbd>
                        {' '}in the AI chat to paste
                    </div>
                </div>
            )}
            {status !== 'Image copied!' && status !== 'Capturing...' && (
                <div className="flex items-center justify-center gap-2">
                    <span>⚠️</span> {status}
                </div>
            )}
        </div>
    );
};

/* ── AI Button sub-component ── */
const AIButton: React.FC<{
    label: string;
    imgSrc: string;
    isLight: boolean;
    onClick: () => void;
}> = ({ label, imgSrc, isLight, onClick }) => {
    const borderColor = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)';
    const background = isLight ? '#fff' : '#1e293b';
    const labelColor = isLight ? '#475569' : '#94a3b8';

    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-1 active:scale-95 group"
        >
            <div
                className="w-12 h-12 rounded-[14px] shadow-sm flex items-center justify-center p-2 border transition-shadow group-hover:shadow-md"
                style={{ borderColor, background }}
            >
                <img src={imgSrc} alt={label} className="w-full h-full object-contain transition-all group-hover:scale-110" />
            </div>
            <span className="text-[11px] font-semibold" style={{ color: labelColor }}>{label}</span>
        </button>
    );
};

/* ── Main component ── */
const AnalyzeWithAI: React.FC<AnalyzeWithAIProps> = ({ theme = 'dark', onCaptureCanvas }) => {
    const [status, setStatus] = useState<string | null>(null);
    const isLight = theme === 'light';
    const attrColor = isLight ? '#94a3b8' : '#475569';
    const attrBorder = isLight ? '#f1f5f9' : '#1e293b';

    const captureAndOpen = async (service: 'chatgpt' | 'gemini' | 'claude') => {
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

        // Wait 2 seconds before opening so the user can see the "copied" toast
        setTimeout(() => {
            const url = service === 'chatgpt'
                ? 'https://chatgpt.com/'
                : service === 'gemini'
                    ? 'https://gemini.google.com/app'
                    : 'https://claude.ai/new';
            window.open(url, '_blank');
        }, 2000);
    };

    return (
        <div className="flex flex-col px-4 py-3">
            {/* AI Buttons */}
            <div className="flex items-center justify-center gap-4 w-full py-1">
                <AIButton label="ChatGPT" imgSrc="/share-icons/chatgpt.webp" isLight={isLight} onClick={() => captureAndOpen('chatgpt')} />
                <AIButton label="Gemini" imgSrc="/share-icons/gemini.webp" isLight={isLight} onClick={() => captureAndOpen('gemini')} />
                <AIButton label="Claude" imgSrc="/share-icons/claude.webp" isLight={isLight} onClick={() => captureAndOpen('claude')} />
            </div>

            {/* Status toast */}
            {status && <StatusToast status={status} isLight={isLight} />}

            {/* Attributions */}
            <div className="text-[10px] text-center pt-2 border-t flex flex-col gap-0.5" style={{ color: attrColor, borderColor: attrBorder }}>
                <a href="https://www.flaticon.com/free-icons/chatgpt" title="chatgpt icons" target="_blank" rel="noreferrer" className="hover:underline"></a>
            </div>
        </div>
    );
};

export default AnalyzeWithAI;
