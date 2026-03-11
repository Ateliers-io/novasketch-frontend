import React from 'react';
import { Locate, ScanSearch } from 'lucide-react';

interface RecenterButtonProps {
    onRecenter: () => void;
    /** Called when the user clicks "Back to Content"; parent handles the animation */
    onBackToContent?: () => void;
    /** Show the Back-to-Content button only when the user has panned away */
    showBackToContent?: boolean;
}

const RecenterButton: React.FC<RecenterButtonProps> = ({
    onRecenter,
    onBackToContent,
    showBackToContent = false,
}) => {
    return (
        <div className="fixed bottom-[170px] right-4 z-50 flex flex-col gap-2 items-center">
            {/* Back to Content — only visible when panning has moved the view */}
            {showBackToContent && onBackToContent && (
                <button
                    onClick={onBackToContent}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold
                               backdrop-blur-sm border shadow-lg transition-all group
                               hover:scale-105 active:scale-95"
                    style={{
                        background: 'rgba(102,252,241,0.12)',
                        borderColor: 'rgba(102,252,241,0.35)',
                        color: '#66FCF1',
                        boxShadow: '0 0 16px rgba(102,252,241,0.15)',
                    }}
                    title="Go to Last Content — jump to the most-recently drawn area"
                >
                    <ScanSearch size={15} className="group-hover:scale-110 transition-transform" />
                    Previous Element
                </button>
            )}

            {/* Original Recenter button */}
            <button
                onClick={onRecenter}
                className="p-3 bg-black/50 backdrop-blur-sm border border-white/15 rounded-full
                           text-[#3B82F6] hover:bg-white/10 hover:text-white transition-all shadow-lg group"
                title="Return to Origin (0, 0)"
            >
                <Locate size={20} className="group-hover:scale-110 transition-transform" />
            </button>
        </div>
    );
};

export default RecenterButton;
