import React, { useState, useRef, useEffect } from 'react';
import { updateSessionName } from '../../../services/session.service';
import { Edit2, Check, X } from 'lucide-react';

interface ProjectNameEditorProps {
    sessionId: string;
    initialName: string;
    isOwner: boolean;
    theme?: 'light' | 'dark';
}

export const ProjectNameEditor: React.FC<ProjectNameEditorProps> = ({ sessionId, initialName, isOwner, theme = 'dark' }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(initialName || 'Untitled Board');
    const [tempName, setTempName] = useState(name);
    const inputRef = useRef<HTMLInputElement>(null);

    const isDark = theme === 'dark';
    const textColor = isDark ? '#fff' : '#1A3C40';
    const bgColor = isDark ? '#1F2833' : 'rgba(248,250,251,0.96)';

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setName(initialName || 'Untitled Board');
    }, [initialName]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (!tempName.trim()) {
            setTempName(name);
            setIsEditing(false);
            return;
        }
        setName(tempName);
        setIsEditing(false);
        try {
            await updateSessionName(sessionId, tempName);
        } catch (error) {
            console.error('Failed to update project name', error);
            // Optionally revert
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setTempName(name);
            setIsEditing(false);
        }
    };

    if (!isOwner) {
        return (
            <div className={`flex items-center px-4 py-2 rounded-xl backdrop-blur-md font-semibold text-sm shadow-sm transition-colors border max-w-[200px] sm:max-w-xs overflow-hidden text-ellipsis`}
                style={{ backgroundColor: bgColor, color: textColor, borderColor: isDark ? 'rgba(102,252,241,0.2)' : 'rgba(69,162,158,0.18)' }}>
                {name}
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="flex items-center gap-1">
                <input
                    ref={inputRef}
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold outline-none border transition-colors shadow-sm`}
                    style={{
                        backgroundColor: isDark ? '#12141D' : '#fff',
                        color: textColor,
                        borderColor: isDark ? '#66FCF1' : '#2A9D8F'
                    }}
                />
            </div>
        );
    }

    return (
        <div
            className={`group flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-md font-semibold text-sm shadow-sm cursor-pointer border transition-all hover:scale-[1.02] active:scale-95 max-w-[200px] sm:max-w-xs`}
            style={{ backgroundColor: bgColor, color: textColor, borderColor: isDark ? 'rgba(102,252,241,0.2)' : 'rgba(69,162,158,0.18)' }}
            onClick={() => {
                setTempName(name);
                setIsEditing(true);
            }}
            title="Edit project name"
        >
            <span className="truncate flex-1">{name}</span>
            <Edit2 size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${isDark ? 'text-[#66FCF1]' : 'text-[#2A9D8F]'}`} />
        </div>
    );
};

export default ProjectNameEditor;
