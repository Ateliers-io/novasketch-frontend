import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, Link as LinkIcon, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ImageUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImageInsert: (src: string, width: number, height: number) => void;
}

/**
 * Modal for uploading images from the user's device or pasting a URL.
 * Returns a base64 string (for uploads) or URL (for external links) along
 * with the natural dimensions so the caller can create an ImageShape.
 */
const ImageUploadModal: React.FC<ImageUploadModalProps> = ({ isOpen, onClose, onImageInsert }) => {
    const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
    const [urlInput, setUrlInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = useCallback(() => {
        setUrlInput('');
        setError('');
        setIsLoading(false);
        setDragOver(false);
    }, []);

    const handleClose = useCallback(() => {
        resetState();
        onClose();
    }, [onClose, resetState]);

    /**
     * Loads a File object, converts it to a base64 data-URL, and resolves
     * its natural width/height so the canvas inserts it at the correct size.
     */
    const processFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Please select a valid image file (PNG, JPG, SVG, GIF, WebP).');
            return;
        }

        // 10 MB cap – keeps Yjs doc size sane
        if (file.size > 10 * 1024 * 1024) {
            setError('Image must be smaller than 10 MB.');
            return;
        }

        setIsLoading(true);
        setError('');

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const img = new Image();
            img.onload = () => {
                // Cap dimensions so huge images don't blow up the viewport
                let w = img.naturalWidth;
                let h = img.naturalHeight;
                const MAX_DIM = 800;
                if (w > MAX_DIM || h > MAX_DIM) {
                    const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                onImageInsert(dataUrl, w, h);
                handleClose();
            };
            img.onerror = () => {
                setError('Failed to load the image. The file may be corrupted.');
                setIsLoading(false);
            };
            img.src = dataUrl;
        };
        reader.onerror = () => {
            setError('Failed to read the file.');
            setIsLoading(false);
        };
        reader.readAsDataURL(file);
    }, [onImageInsert, handleClose]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    }, [processFile]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, [processFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    /**
     * URL flow: load the image from a remote URL and extract dimensions.
     * If the URL is cross-origin, the browser may still render it in SVG
     * via <image href> even if the Image() constructor fails, so we set
     * fallback dimensions.
     */
    const handleUrlInsert = useCallback(() => {
        const url = urlInput.trim();
        if (!url) {
            setError('Please enter a valid URL.');
            return;
        }

        setIsLoading(true);
        setError('');

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            const MAX_DIM = 800;
            if (w > MAX_DIM || h > MAX_DIM) {
                const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            onImageInsert(url, w, h);
            handleClose();
        };
        img.onerror = () => {
            // Even if Image() fails (CORS), we can still pass the URL
            // because SVG <image> doesn't have the same-origin restriction
            onImageInsert(url, 400, 300);
            handleClose();
        };
        img.src = url;
    }, [urlInput, onImageInsert, handleClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={handleClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-[480px] max-w-[90vw] rounded-2xl overflow-hidden"
                style={{
                    background: 'linear-gradient(145deg, #1a1f2e, #0f1318)',
                    border: '1px solid rgba(102, 252, 241, 0.15)',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(102,252,241,0.05)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#66FCF1]/10 border border-[#66FCF1]/20">
                            <ImageIcon size={18} className="text-[#66FCF1]" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Insert Image</h2>
                            <p className="text-[11px] text-[#8b9bb4] mt-0.5">Upload from device or paste a URL</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-[#8b9bb4] hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 pt-4 gap-2">
                    <button
                        onClick={() => { setActiveTab('upload'); setError(''); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'upload'
                                ? 'bg-[#66FCF1]/15 text-[#66FCF1] border border-[#66FCF1]/30'
                                : 'text-[#8b9bb4] hover:text-white hover:bg-white/5 border border-transparent'
                            }`}
                    >
                        <Upload size={14} /> Upload File
                    </button>
                    <button
                        onClick={() => { setActiveTab('url'); setError(''); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'url'
                                ? 'bg-[#66FCF1]/15 text-[#66FCF1] border border-[#66FCF1]/30'
                                : 'text-[#8b9bb4] hover:text-white hover:bg-white/5 border border-transparent'
                            }`}
                    >
                        <LinkIcon size={14} /> From URL
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    {activeTab === 'upload' ? (
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                            className={`relative flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed cursor-pointer transition-all ${dragOver
                                    ? 'border-[#66FCF1] bg-[#66FCF1]/10'
                                    : 'border-white/20 hover:border-[#66FCF1]/50 hover:bg-white/5'
                                }`}
                        >
                            {isLoading ? (
                                <Loader2 size={32} className="text-[#66FCF1] animate-spin" />
                            ) : (
                                <>
                                    <div className="w-14 h-14 rounded-full bg-[#1F2833] border border-white/10 flex items-center justify-center mb-4">
                                        <Upload size={24} className="text-[#66FCF1]" />
                                    </div>
                                    <p className="text-sm font-medium text-white mb-1">
                                        Drop your image here or <span className="text-[#66FCF1]">browse</span>
                                    </p>
                                    <p className="text-xs text-[#8b9bb4]">
                                        PNG, JPG, SVG, GIF, WebP — max 10 MB
                                    </p>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-[#8b9bb4] uppercase tracking-wider mb-2 block">
                                    Image URL
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUrlInsert()}
                                        placeholder="https://example.com/shape.svg"
                                        className="flex-1 h-10 bg-[#0B0C10] border border-white/15 rounded-lg px-4 text-sm text-white focus:outline-none focus:border-[#66FCF1] transition-colors placeholder:text-[#5a6d7e]"
                                    />
                                    <button
                                        onClick={handleUrlInsert}
                                        disabled={isLoading || !urlInput.trim()}
                                        className="h-10 px-5 bg-[#66FCF1] hover:bg-[#45A29E] text-black font-bold text-sm rounded-lg flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            'Insert'
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                                <p className="text-xs text-[#8b9bb4]">
                                    <span className="text-[#66FCF1] font-semibold">Tip:</span>{' '}
                                    You can paste URLs for SVG shapes, icons from sites like Flaticon, or any publicly accessible image URL.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageUploadModal;
