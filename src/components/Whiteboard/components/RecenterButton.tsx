import React from 'react';
import { Locate } from 'lucide-react';

interface RecenterButtonProps {
    onRecenter: () => void;
}

const RecenterButton: React.FC<RecenterButtonProps> = ({ onRecenter }) => {
    return (
        <button
            onClick={onRecenter}
            className="fixed bottom-[170px] right-4 z-50 p-3 bg-black/50 backdrop-blur-sm border border-white/15 rounded-full text-[#66FCF1] hover:bg-white/10 hover:text-white transition-all shadow-lg group"
            title="Return to Center"
        >
            <Locate size={20} className="group-hover:scale-110 transition-transform" />
        </button>
    );
};

export default RecenterButton;
