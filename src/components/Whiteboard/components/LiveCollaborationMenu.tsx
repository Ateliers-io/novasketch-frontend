import React, { useState, useEffect, useRef } from 'react';
import { Copy, Users, Check } from 'lucide-react';
import QRCode from 'react-qr-code';

interface LiveCollaborationMenuProps {
    roomId: string;
    theme?: string;
}

const createShareableQR = async (svgElement: SVGElement, shareText: string) => {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

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
    if (!blob) return false;

    const file = new File([blob], 'novasketch-invite-qr.png', { type: 'image/png' });
    await navigator.share({
        title: 'NovaSketch - Join My Session',
        text: shareText,
        files: [file],
    });
    return true;
};

const handleWhatsAppShare = async (inviteLink: string, qrRef: React.RefObject<HTMLDivElement | null>) => {
    const shareText = `Join my live drawing session on NovaSketch: ${inviteLink}`;

    // Try Web Share API with QR image for mobile/desktop native sharing
    if ('share' in navigator && qrRef.current) {
        try {
            const svgElement = qrRef.current.querySelector('svg');
            if (svgElement) {
                const shared = await createShareableQR(svgElement, shareText);
                if (shared) return;
            }
        } catch (err) {
            // User cancelled or share failed — fall through to wa.me link
            console.log('Web Share cancelled or failed, falling back to wa.me', err);
        }
    }

    // Fallback: open WhatsApp with text only
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
};

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
    const handleWhatsApp = () => handleWhatsAppShare(inviteLink, qrRef);

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

    let btnBg = isLight ? '#F1F5F9' : '#2A3441';
    let btnColor = isLight ? '#1A3C40' : '#c5c6c7';
    let btnBorder = isLight ? '1px solid #E6EAF0' : 'none';

    if (copied) {
        btnBg = isLight ? '#2A9D8F' : '#45A29E';
        btnColor = isLight ? '#ffffff' : '#0B0C10';
        btnBorder = isLight ? '1px solid transparent' : 'none';
    }

    const sessionLabelColor = isLight ? '#5B7F82' : '#c5c6c7';
    const linkBg = isLight ? '#ffffff' : 'rgba(0,0,0,0.4)';
    const linkBorderColor = isLight ? '#E6EAF0' : '#1F2833';
    const linkTextColor = isLight ? '#1A3C40' : '#c5c6c7';
    const shareLabelColor = isLight ? '#64748b' : '#94a3b8';
    const shareIconBorder = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)';
    const shareIconBg = isLight ? '#fff' : '#1e293b';
    const shareLabelText = isLight ? '#475569' : '#94a3b8';
    const qrLabelColor = isLight ? '#5B7F82' : '#c5c6c7';
    const stopBg = isLight ? '#fff' : 'transparent';
    const attrColor = isLight ? '#94a3b8' : '#475569';
    const attrBorder = isLight ? '#f1f5f9' : '#1e293b';

    return (
        <div className="flex flex-col gap-4 px-4 py-3 min-w-[320px]">
            {/* Link input + copy button */}
            <div className="flex flex-col gap-1.5">
                <div className="text-xs font-medium" style={{ color: sessionLabelColor }}>Session Link</div>
                <div className="flex items-stretch gap-2">
                    <div
                        className="flex-grow flex items-center px-3 py-2 rounded border text-sm truncate"
                        title={inviteLink}
                        style={{
                            backgroundColor: linkBg,
                            borderColor: linkBorderColor,
                            color: linkTextColor
                        }}
                    >
                        {inviteLink}
                    </div>
                    <button
                        onClick={handleCopy}
                        className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 rounded font-medium transition-all duration-200"
                        style={{
                            backgroundColor: btnBg,
                            color: btnColor,
                            border: btnBorder
                        }}
                    >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* Share via WhatsApp */}
            <div className="flex flex-col items-center gap-1 mt-2 mb-1 w-full">
                <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: shareLabelColor }}>
                    Share via :
                </div>
                <div className="flex items-center justify-center w-full">
                    <button onClick={handleWhatsApp} className="flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-1 active:scale-95 group">
                        <div className="w-11 h-11 bg-white rounded-[14px] shadow-sm flex items-center justify-center p-1.5 border" style={{ borderColor: shareIconBorder, background: shareIconBg }}>
                            <img src="/share-icons/whatsapp.webp" alt="WhatsApp" className="w-full h-full object-contain transition-all group-hover:scale-105" />
                        </div>
                        <span className="text-[10px] font-medium" style={{ color: shareLabelText }}>WhatsApp</span>
                    </button>
                </div>
            </div>

            {/* Real QR Code */}
            <div className="flex flex-col items-center gap-1.5 mt-2">
                <div className="text-xs font-medium" style={{ color: qrLabelColor }}>Scan to join</div>
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
                    background: stopBg,
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = stopBg;
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                }}
            >
                <div className="w-3 h-3 rounded-sm bg-[#ef4444]" />
                <span className="font-medium">Stop session</span>
            </button>

            {/* Attributions */}
            <div className="text-[9px] text-center mt-1 pt-2 border-t flex flex-col gap-0.5" style={{ color: attrColor, borderColor: attrBorder }}>
                <a href="https://www.flaticon.com/free-icons/whatsapp" title="whatsapp icons" target="_blank" rel="noreferrer" className="hover:underline">Whatsapp icons created by cobynecz - Flaticon</a>
            </div>
        </div>
    );
};

export default LiveCollaborationMenu;
