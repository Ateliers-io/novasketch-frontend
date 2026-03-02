import React, { useState } from 'react';
import { Copy, Users } from 'lucide-react';

interface LiveCollaborationMenuProps {
    roomId: string;
}

const LiveCollaborationMenu: React.FC<LiveCollaborationMenuProps> = ({ roomId }) => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [copied, setCopied] = useState(false);

    // Mock link generation - in a real app this would use window.location.origin
    const inviteLink = `https://novasketch.app/#room=${roomId}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isSessionActive) {
        return (
            <div className="flex flex-col gap-3 px-4 py-3">
                <button
                    onClick={() => setIsSessionActive(true)}
                    className="w-full py-2.5 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2"
                    style={{
                        backgroundColor: '#66FCF1',
                        color: '#0B0C10',
                        boxShadow: '0 0 10px rgba(102,252,241,0.2)'
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
                <label className="text-xs font-medium text-[#c5c6c7]">Session Link</label>
                <div className="flex items-stretch gap-2">
                    <div className="flex-grow flex items-center px-3 py-2 rounded bg-black/40 border border-[#1F2833] text-sm text-[#c5c6c7] truncate" title={inviteLink}>
                        {inviteLink}
                    </div>
                    <button
                        onClick={handleCopy}
                        className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 rounded font-medium transition-all duration-200"
                        style={{
                            backgroundColor: copied ? '#45A29E' : '#2A3441',
                            color: copied ? '#0B0C10' : '#c5c6c7',
                        }}
                    >
                        <Copy size={16} />
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-1.5">
                <label className="text-xs font-medium text-[#c5c6c7]">Scan to join</label>
                <div className="p-3 bg-white rounded-xl">
                    {/* Mock QR Code using inline SVG patterns */}
                    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="160" height="160" fill="white" />

                        {/* Top Left Square */}
                        <path fillRule="evenodd" clipRule="evenodd" d="M10 10H50V50H10V10ZM20 20V40H40V20H20Z" fill="#0B0C10" />
                        <rect x="25" y="25" width="10" height="10" fill="#0B0C10" />

                        {/* Top Right Square */}
                        <path fillRule="evenodd" clipRule="evenodd" d="M110 10H150V50H110V10ZM120 20V40H140V20H120Z" fill="#0B0C10" />
                        <rect x="125" y="25" width="10" height="10" fill="#0B0C10" />

                        {/* Bottom Left Square */}
                        <path fillRule="evenodd" clipRule="evenodd" d="M10 110H50V150H10V110ZM20 120V140H40V120H20Z" fill="#0B0C10" />
                        <rect x="25" y="125" width="10" height="10" fill="#0B0C10" />

                        {/* Random Mock Data Blocks */}
                        <rect x="65" y="15" width="15" height="15" fill="#0B0C10" />
                        <rect x="85" y="10" width="15" height="15" fill="#0B0C10" />
                        <rect x="65" y="35" width="15" height="10" fill="#0B0C10" />
                        <rect x="90" y="30" width="10" height="15" fill="#0B0C10" />

                        <rect x="10" y="65" width="15" height="15" fill="#0B0C10" />
                        <rect x="35" y="60" width="10" height="15" fill="#0B0C10" />
                        <rect x="15" y="85" width="15" height="15" fill="#0B0C10" />

                        <rect x="110" y="65" width="15" height="10" fill="#0B0C10" />
                        <rect x="135" y="60" width="15" height="15" fill="#0B0C10" />
                        <rect x="115" y="85" width="10" height="10" fill="#0B0C10" />
                        <rect x="130" y="80" width="15" height="15" fill="#0B0C10" />

                        <rect x="65" y="110" width="15" height="15" fill="#0B0C10" />
                        <rect x="85" y="115" width="10" height="15" fill="#0B0C10" />
                        <rect x="110" y="115" width="15" height="15" fill="#0B0C10" />
                        <rect x="135" y="125" width="15" height="15" fill="#0B0C10" />
                        <rect x="125" y="140" width="15" height="10" fill="#0B0C10" />

                        <rect x="60" y="60" width="40" height="40" fill="#0B0C10" />
                        <rect x="65" y="65" width="30" height="30" fill="white" />
                        <rect x="70" y="70" width="20" height="20" fill="#0B0C10" />
                    </svg>
                </div>
            </div>

            {/* Stop Session Button */}
            <button
                onClick={() => setIsSessionActive(false)}
                className="w-full mt-2 py-2.5 rounded-lg border flex items-center justify-center gap-2 transition-all duration-200"
                style={{
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                }}
            >
                <div className="w-3 h-3 rounded-sm bg-[#ef4444]" />
                <span className="font-medium">Stop session</span>
            </button>
        </div>
    );
};

export default LiveCollaborationMenu;
