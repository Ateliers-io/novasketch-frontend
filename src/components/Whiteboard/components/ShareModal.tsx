import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { Copy, X, Check, Users } from 'lucide-react';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    url: string;
    theme?: 'light' | 'dark';
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, sessionId, url, theme = 'dark' }) => {
    const [copied, setCopied] = useState(false);

    // ensure complete absolute url
    const fullUrl = url.startsWith('http') ? url : window.location.origin + url;

    // Reset copied state when url changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCopied(false);
    }, [fullUrl, isOpen]);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#12141D' : '#F8FAFB';
    const textColor = isDark ? '#fff' : '#1A3C40';
    const borderColor = isDark ? 'rgba(102,252,241,0.2)' : 'rgba(69,162,158,0.2)';
    const accentColor = isDark ? '#66FCF1' : '#2A9D8F';

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className={`relative w-full max-w-md rounded-2xl shadow-2xl flex flex-col items-center p-8 gap-6 transform transition-all animate-in zoom-in-95`}
                style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
            >
                <button
                    onClick={onClose}
                    className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors`}
                    style={{ color: isDark ? '#8b9bb4' : '#5B7F82' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                    <X size={20} />
                </button>

                <div className={`p-3 rounded-2xl`} style={{ backgroundColor: isDark ? 'rgba(102,252,241,0.1)' : 'rgba(42,157,143,0.1)' }}>
                    <Users size={32} style={{ color: accentColor }} />
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-bold" style={{ color: textColor }}>Share Project</h2>
                    <p className="text-sm mt-2" style={{ color: isDark ? '#8b9bb4' : '#5B7F82' }}>
                        Invite others to collaborate in real-time. Scanning the QR code or opening the link will add them to the session.
                    </p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-100">
                    <QRCode
                        value={fullUrl}
                        size={180}
                        bgColor="#ffffff"
                        fgColor={isDark ? '#0B0C10' : '#1A3C40'}
                        level="Q"
                    />
                </div>

                <div className="w-full mt-2">
                    <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: isDark ? '#8b9bb4' : '#5B7F82' }}>
                        Share Link
                    </label>
                    <div className="flex w-full rounded-lg overflow-hidden border" style={{ borderColor }}>
                        <input
                            readOnly
                            value={fullUrl}
                            className={`flex-1 px-4 py-3 text-sm font-mono focus:outline-none`}
                            style={{
                                backgroundColor: isDark ? '#0B0C10' : '#fff',
                                color: isDark ? '#c5c6c7' : '#1A3C40'
                            }}
                        />
                        <button
                            onClick={handleCopy}
                            className={`flex items-center gap-2 px-5 py-3 font-semibold transition-colors`}
                            style={{
                                backgroundColor: copied ? '#10B981' : (isDark ? 'rgba(102,252,241,0.1)' : 'rgba(42,157,143,0.1)'),
                                color: copied ? '#fff' : accentColor
                            }}
                        >
                            {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
