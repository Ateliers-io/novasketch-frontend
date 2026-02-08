import React, { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Download, FileDown, FileImage, Trash2, X } from 'lucide-react';
import Konva from 'konva';
import { Shape, isRectangle, isCircle, RectangleShape, CircleShape } from '../../types/shapes';
//
interface ExportToolsProps {
    stageRef: React.RefObject<Konva.Stage | null>;
    lines: any[]; // Replace with proper types if imported
    shapes: Shape[];
    textAnnotations: any[];
    onClear: () => void;
}

// Helper to generate timestamped filename
const getTimestampFilename = (ext: string) => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `novasketch-${timestamp}.${ext}`;
};

const ExportTools: React.FC<ExportToolsProps> = ({ stageRef, lines, shapes, textAnnotations, onClear }) => {
    const [isOpen, setIsOpen] = useState(false);

    // 6.2 Export to Image (PNG/JPG)
    const handleExportImage = (format: 'png' | 'jpeg' = 'png') => {
        if (!stageRef.current) return;
        const uri = stageRef.current.toDataURL({ pixelRatio: 2, mimeType: `image/${format}` });

        const link = document.createElement('a');
        link.download = getTimestampFilename(format === 'jpeg' ? 'jpg' : format);
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsOpen(false);
    };

    // 6.3 Export to SVG
    const handleExportSVG = () => {
        if (!stageRef.current) return;

        // Generate valid SVG string from state
        // Note: Konva doesn't natively export to SVG string in browser without plugins easily, 
        // but we can construct it since we have the state (lines, shapes, text).

        let svgContent = `<svg width="${stageRef.current?.width() || 800}" height="${stageRef.current?.height() || 600}" xmlns="http://www.w3.org/2000/svg">`;

        // Background (optional)
        svgContent += `<rect width="100%" height="100%" fill="white"/>`;

        // Shapes
        shapes.forEach(shape => {
            if (isRectangle(shape)) {
                const s = shape as RectangleShape;
                svgContent += `<rect x="${s.position.x}" y="${s.position.y}" width="${s.width}" height="${s.height}" stroke="${s.style.stroke}" stroke-width="${s.style.strokeWidth}" fill="${s.style.hasFill ? s.style.fill : 'none'}" />`;
            } else if (isCircle(shape)) {
                const s = shape as CircleShape;
                svgContent += `<circle cx="${s.position.x}" cy="${s.position.y}" r="${s.radius}" stroke="${s.style.stroke}" stroke-width="${s.style.strokeWidth}" fill="${s.style.hasFill ? s.style.fill : 'none'}" />`;
            }
        });

        // Lines
        lines.forEach(line => {
            const points = line.points;
            let path = `M ${points[0]} ${points[1]}`;
            for (let i = 2; i < points.length; i += 2) {
                path += ` L ${points[i]} ${points[i + 1]}`;
            }
            svgContent += `<path d="${path}" stroke="${line.color}" stroke-width="${line.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
        });

        // Text
        textAnnotations.forEach(text => {
            svgContent += `<text x="${text.x}" y="${text.y + text.fontSize}" font-family="${text.fontFamily}" font-size="${text.fontSize}" fill="${text.color}" font-weight="${text.fontWeight}" font-style="${text.fontStyle}" text-decoration="${text.textDecoration}">${text.text}</text>`;
        });

        svgContent += `</svg>`;

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = getTimestampFilename('svg');
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsOpen(false);
    };

    // 6.4 Export Canvas to PDF
    const handleExportPDF = () => {
        if (!stageRef.current) return;

        const stageWidth = stageRef.current.width();
        const stageHeight = stageRef.current.height();

        // Initialize PDF
        // eslint-disable-next-line new-cap
        const pdf = new jsPDF({
            orientation: stageWidth > stageHeight ? 'l' : 'p',
            unit: 'px',
            format: [stageWidth, stageHeight]
        });

        // Convert stage to image data
        const imgData = stageRef.current.toDataURL({ pixelRatio: 2 });

        // Add image to PDF
        pdf.addImage(imgData, 'PNG', 0, 0, stageWidth, stageHeight);
        pdf.save(getTimestampFilename('pdf'));
        setIsOpen(false);
    };

    // 6.5 Clear Canvas
    const handleClear = () => {
        if (confirm('Are you sure you want to clear the entire canvas? This cannot be undone.')) {
            onClear();
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-transparent border-2 border-[#66FCF1] text-[#66FCF1] p-3 rounded-lg shadow-[0_0_10px_rgba(102,252,241,0.3)] hover:shadow-[0_0_20px_rgba(102,252,241,0.5)] transition-all duration-300 z-50 flex items-center justify-center"
                title="Export options"
            >
                <Download size={24} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 bg-black/90 backdrop-blur-sm p-4 rounded-xl border border-[#66FCF1] shadow-[0_0_20px_rgba(102,252,241,0.15)] z-50 flex flex-col gap-2 min-w-[200px]">
            <div className="flex justify-between items-center mb-2 border-b border-[#66FCF1]/30 pb-2">
                <h3 className="font-semibold text-[#66FCF1]">Export & Actions</h3>
                <button onClick={() => setIsOpen(false)} className="text-[#66FCF1]/70 hover:text-[#66FCF1] transition-colors">
                    <X size={16} />
                </button>
            </div>

            <button
                onClick={() => handleExportImage('png')}
                className="flex items-center gap-2 p-2 hover:bg-[#1F2833] rounded text-left text-sm group"
            >
                <FileImage size={16} className="text-[#66FCF1] group-hover:text-white transition-colors" />
                <span className="text-[#c5c6c7] group-hover:text-white transition-colors">Export as PNG</span>
            </button>

            <button
                onClick={() => handleExportImage('jpeg')}
                className="flex items-center gap-2 p-2 hover:bg-[#1F2833] rounded text-left text-sm group"
            >
                <FileImage size={16} className="text-[#66FCF1] group-hover:text-white transition-colors" />
                <span className="text-[#c5c6c7] group-hover:text-white transition-colors">Export as JPG</span>
            </button>

            <button
                onClick={handleExportSVG}
                className="flex items-center gap-2 p-2 hover:bg-[#1F2833] rounded text-left text-sm group"
            >
                <FileDown size={16} className="text-[#66FCF1] group-hover:text-white transition-colors" />
                <span className="text-[#c5c6c7] group-hover:text-white transition-colors">Export as SVG</span>
            </button>

            <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 p-2 hover:bg-[#1F2833] rounded text-left text-sm group"
            >
                <FileDown size={16} className="text-[#66FCF1] group-hover:text-white transition-colors" />
                <span className="text-[#c5c6c7] group-hover:text-white transition-colors">Export as PDF</span>
            </button>

            <div className="h-px bg-[#66FCF1]/30 my-1"></div>

            <button
                onClick={handleClear}
                className="flex items-center gap-2 p-2 hover:bg-red-900/20 rounded text-left text-sm text-red-500 hover:text-red-400"
            >
                <Trash2 size={16} />
                <span>Clear Canvas</span>
            </button>
        </div>
    );
};

export default ExportTools;
