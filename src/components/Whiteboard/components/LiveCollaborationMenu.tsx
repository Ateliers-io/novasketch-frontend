import React, { useState, useEffect, useRef } from 'react';
import { Copy, Users, Check } from 'lucide-react';
import QRCode from 'react-qr-code';

interface LiveCollaborationMenuProps {
    roomId: string;
    theme?: string;
}

const LiveCollaborationMenu: React.FC<LiveCollaborationMenuProps> = ({ roomId, theme = 'dark' }) => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [copied, setCopied] = useState(false);
    const [currentOrigin, setCurrentOrigin] = useState('https://novasketch.app');
    const qrRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Enforce the vercel production URL over window.location.origin so mobile 
        // phones don't accidentally scan a captive localhost URL
        setCurrentOrigin('https://novasketch.vercel.app');
    }, []);

    const inviteLink = `${currentOrigin}/#room=${roomId}`;
    const isLight = theme === 'light';

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsApp = async () => {
        const shareText = `Join my live drawing session on NovaSketch: ${inviteLink}`;

        // Try Web Share API with QR image for mobile/desktop native sharing
        if (navigator.share && qrRef.current) {
            try {
                const svgElement = qrRef.current.querySelector('svg');
                if (svgElement) {
                    // Convert SVG to canvas then to PNG blob
                    const svgData = new XMLSerializer().serializeToString(svgElement);
                    const canvas = document.createElement('canvas');
                    canvas.width = 400;
                    canvas.height = 400;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        // White background
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, 400, 400);

                        const img = new Image();
                        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                        const url = URL.createObjectURL(svgBlob);

                        await new Promise<void>((resolve, reject) => {
                            img.onload = () => {
                                ctx.drawImage(img, 0, 0, 400, 400);
                                URL.revokeObjectURL(url);
                                resolve();
                            };
                            img.onerror = reject;
                            img.src = url;
                        });

                        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                        if (blob) {
                            const file = new File([blob], 'novasketch-invite-qr.png', { type: 'image/png' });
                            await navigator.share({
                                title: 'NovaSketch - Join My Session',
                                text: shareText,
                                files: [file],
                            });
                            return;
                        }
                    }
                }
            } catch (err) {
                // User cancelled or share failed — fall through to wa.me link
                console.log('Web Share cancelled or failed, falling back to wa.me', err);
            }
        }

        // Fallback: open WhatsApp with text only
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    };

    if (!isSessionActive) {
        return (
            <div className="flex flex-col gap-3 px-4 py-3">
                <button
                    onClick={() => setIsSessionActive(true)}
                    className="w-full py-2.5 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                        backgroundColor: isLight ? '#2A9D8F' : '#66FCF1',
                        color: isLight ? '#ffffff' : '#0B0C10',
                        boxShadow: isLight ? '0 4px 12px rgba(42,157,143,0.3)' : '0 0 10px rgba(102,252,241,0.2)'
                    }}
                >
                    <Users size={16} />
                    <span>Start Live Session</span>
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 px-4 py-3 min-w-[320px]">
            {/* Link input + copy button */}
            <div className="flex flex-col gap-1.5">
                <div className="text-xs font-medium" style={{ color: isLight ? '#5B7F82' : '#c5c6c7' }}>Session Link</div>
                <div className="flex items-stretch gap-2">
                    <div
                        className="flex-grow flex items-center px-3 py-2 rounded border text-sm truncate"
                        title={inviteLink}
                        style={{
                            backgroundColor: isLight ? '#ffffff' : 'rgba(0,0,0,0.4)',
                            borderColor: isLight ? '#E6EAF0' : '#1F2833',
                            color: isLight ? '#1A3C40' : '#c5c6c7'
                        }}
                    >
                        {inviteLink}
                    </div>
                    <button
                        onClick={handleCopy}
                        className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 rounded font-medium transition-all duration-200"
                        style={{
                            backgroundColor: copied
                                ? (isLight ? '#2A9D8F' : '#45A29E')
                                : (isLight ? '#F1F5F9' : '#2A3441'),
                            color: copied
                                ? (isLight ? '#ffffff' : '#0B0C10')
                                : (isLight ? '#1A3C40' : '#c5c6c7'),
                            border: isLight ? (copied ? '1px solid transparent' : '1px solid #E6EAF0') : 'none'
                        }}
                    >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* Share via WhatsApp */}
            <div className="flex flex-col items-center gap-1 mt-2 mb-1 w-full">
                <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                    Share via :
                </div>
                <div className="flex items-center justify-center w-full">
                    <button onClick={handleWhatsApp} className="flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-1 active:scale-95 group">
                        <div className="w-11 h-11 bg-white rounded-[14px] shadow-sm flex items-center justify-center p-1.5 border" style={{ borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)', background: isLight ? '#fff' : '#1e293b' }}>
                            <img src="/share-icons/whatsapp.webp" alt="WhatsApp" className="w-full h-full object-contain transition-all group-hover:scale-105" />
                        </div>
                        <span className="text-[10px] font-medium" style={{ color: isLight ? '#475569' : '#94a3b8' }}>WhatsApp</span>
                    </button>
                </div>
            </div>

            {/* Real QR Code */}
            <div className="flex flex-col items-center gap-1.5 mt-2">
                <div className="text-xs font-medium" style={{ color: isLight ? '#5B7F82' : '#c5c6c7' }}>Scan to join</div>
                <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center" ref={qrRef}>
                    <QRCode
                        value={inviteLink}
                        size={140}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="Q"
                    />
                </div>
            </div>

            {/* Stop Session Button */}
            <button
                onClick={() => setIsSessionActive(false)}
                className="w-full mt-2 py-2.5 rounded-lg border flex items-center justify-center gap-2 transition-all duration-200"
                style={{
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    background: isLight ? '#fff' : 'transparent',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isLight ? '#fff' : 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                }}
            >
                <div className="w-3 h-3 rounded-sm bg-[#ef4444]" />
                <span className="font-medium">Stop session</span>
            </button>

            {/* Attributions */}
            <div className="text-[9px] text-center mt-1 pt-2 border-t flex flex-col gap-0.5" style={{ color: isLight ? '#94a3b8' : '#475569', borderColor: isLight ? '#f1f5f9' : '#1e293b' }}>
                <a href="https://www.flaticon.com/free-icons/whatsapp" title="whatsapp icons" target="_blank" rel="noreferrer" className="hover:underline">Whatsapp icons created by cobynecz - Flaticon</a>
            </div>
        </div>
    );
};

export default LiveCollaborationMenu;
