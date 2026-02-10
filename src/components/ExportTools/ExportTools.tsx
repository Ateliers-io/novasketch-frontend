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

    // Helper: Generate Full SVG Content
    const generateSVGContent = () => {
        if (!stageRef.current) return '';
        const width = stageRef.current.width();
        const height = stageRef.current.height();

        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

        // 1. Background (Dark Theme)
        svg += `<rect width="100%" height="100%" fill="#0B0C10"/>`;
        // Optional: Grid dots
        // svg += `<defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#45A29E" /></pattern></defs>`;
        // svg += `<rect width="100%" height="100%" fill="url(#grid)" opacity="0.2"/>`;

        // 2. Shapes (Bottom Layer)
        shapes.map(shape => {
            // Apply transformations
            const { rotation, scaleX, scaleY } = shape.transform;
            const cx = isRectangle(shape) ? shape.position.x + (shape as any).width / 2 : shape.position.x;
            const cy = isRectangle(shape) ? shape.position.y + (shape as any).height / 2 : shape.position.y;
            const transform = `translate(${cx}, ${cy}) rotate(${rotation}) scale(${scaleX}, ${scaleY}) translate(${-cx}, ${-cy})`;

            if (isRectangle(shape)) {
                const s = shape as RectangleShape;
                // Note: fill should be 'none' if !hasFill
                const fill = s.style.hasFill ? s.style.fill : 'none';
                svg += `<rect x="${s.position.x}" y="${s.position.y}" width="${s.width}" height="${s.height}" rx="${s.cornerRadius}" stroke="${s.style.stroke}" stroke-width="${s.style.strokeWidth}" fill="${fill}" transform="${transform}" />`;
            } else if (isCircle(shape)) {
                const s = shape as CircleShape;
                const fill = s.style.hasFill ? s.style.fill : 'none';
                svg += `<circle cx="${s.position.x}" cy="${s.position.y}" r="${s.radius}" stroke="${s.style.stroke}" stroke-width="${s.style.strokeWidth}" fill="${fill}" transform="${transform}" />`;
            }
        });

        // 3. Konva Lines (Middle Layer)
        lines.forEach(line => {
            const points = line.points;
            if (points.length < 2) return;
            let d = `M ${points[0]} ${points[1]}`;
            for (let i = 2; i < points.length; i += 2) {
                d += ` L ${points[i]} ${points[i + 1]}`;
            }
            svg += `<path d="${d}" stroke="${line.color}" stroke-width="${line.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
        });

        // 4. Text Annotations (Top Layer)
        textAnnotations.forEach(text => {
            const style = `font-family: ${text.fontFamily}; font-size: ${text.fontSize}px; font-weight: ${text.fontWeight}; font-style: ${text.fontStyle}; text-decoration: ${text.textDecoration}; fill: ${text.color}; white-space: pre;`;
            // Creating foreignObject for better text rendering might be complex, sticking to simple text for now
            // Or using <text> element:
            svg += `<text x="${text.x}" y="${text.y + text.fontSize}" style="${style}">${text.text}</text>`;
        });

        svg += `</svg>`;
        return svg;
    };

    // 6.2 Export to Image (PNG/JPG) - NOW SUPPORTS SHAPES & TEXT + DARK BG
    const handleExportImage = (format: 'png' | 'jpeg' = 'png') => {
        if (!stageRef.current) return;

        const svgString = generateSVGContent();
        const width = stageRef.current.width();
        const height = stageRef.current.height();

        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2; // High DPI
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0);

            // Trigger Download
            const dataUrl = canvas.toDataURL(`image/${format}`);
            const link = document.createElement('a');
            link.download = getTimestampFilename(format === 'jpeg' ? 'jpg' : format);
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
            setIsOpen(false);
        };
        img.src = url;
    };

    // 6.3 Export to SVG
    const handleExportSVG = () => {
        const svgContent = generateSVGContent();
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

        // Similar to Image Export flow
        const svgString = generateSVGContent();
        const width = stageRef.current.width();
        const height = stageRef.current.height();

        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(2, 2);
                ctx.drawImage(img, 0, 0);
                const imgData = canvas.toDataURL('image/png');

                // eslint-disable-next-line new-cap
                const pdf = new jsPDF({
                    orientation: width > height ? 'l' : 'p',
                    unit: 'px',
                    format: [width, height]
                });
                pdf.addImage(imgData, 'PNG', 0, 0, width, height);
                pdf.save(getTimestampFilename('pdf'));
            }
            URL.revokeObjectURL(url);
            setIsOpen(false);
        };
        img.src = url;
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
