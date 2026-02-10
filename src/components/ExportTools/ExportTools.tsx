import React, { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Download, FileDown, FileImage, Trash2, X } from 'lucide-react';
import Konva from 'konva';
import {
    Shape,
    isRectangle,
    isCircle,
    isEllipse,
    isLine,
    isArrow,
    isTriangle,
    RectangleShape,
    CircleShape,
    EllipseShape,
    LineShape,
    ArrowShape,
    TriangleShape
} from '../../types/shapes';

interface ExportToolsProps {
    stageRef: React.RefObject<Konva.Stage | null>;
    lines: any[]; // Replace with proper types if imported
    shapes: Shape[];
    textAnnotations: any[];
    onClear: () => void;
}

const ExportTools: React.FC<ExportToolsProps> = ({ stageRef, lines, shapes, textAnnotations, onClear }) => {
    const [isOpen, setIsOpen] = useState(false);

    // --- Helper to Generate Full SVG String ---
    const generateSVGString = (width: number, height: number): string => {
        let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

        // 1. Defs (Markes, Filters)
        svgContent += `
        <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#66FCF1" />
            </marker>
        </defs>
        <rect width="100%" height="100%" fill="#0b0c10"/>`; // Dark background matching the app theme

        // 2. Shapes (Bottom Layer)
        // Sort by zIndex if available, else default order
        const sortedShapes = [...shapes].sort((a, b) => a.zIndex - b.zIndex);

        sortedShapes.forEach(shape => {
            if (!shape.visible) return;
            const { position, transform, opacity, style } = shape;
            const fill = style.hasFill ? style.fill : 'none';
            const stroke = style.stroke;
            const strokeWidth = style.strokeWidth;

            // RECTANGLE
            if (isRectangle(shape)) {
                const s = shape as RectangleShape;
                // Center for rotation
                const cx = position.x + s.width / 2;
                const cy = position.y + s.height / 2;
                svgContent += `
                <g transform="translate(${cx}, ${cy}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY}) translate(${-s.width / 2}, ${-s.height / 2})" opacity="${opacity}">
                    <rect width="${s.width}" height="${s.height}" rx="${s.cornerRadius || 0}"
                        fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
                </g>`;
            }
            // CIRCLE
            else if (isCircle(shape)) {
                const s = shape as CircleShape;
                // Center is position
                const cx = position.x;
                const cy = position.y;
                svgContent += `
                <g transform="translate(${cx}, ${cy}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})" opacity="${opacity}">
                    <circle r="${s.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
                </g>`;
            }
            // ELLIPSE
            else if (isEllipse(shape)) {
                const s = shape as EllipseShape;
                const cx = position.x;
                const cy = position.y;
                svgContent += `
                <g transform="translate(${cx}, ${cy}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})" opacity="${opacity}">
                    <ellipse rx="${s.radiusX}" ry="${s.radiusY}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
                </g>`;
            }
            // LINE
            else if (isLine(shape)) {
                const s = shape as LineShape;
                const dx = s.endPoint.x - s.startPoint.x;
                const dy = s.endPoint.y - s.startPoint.y;
                const midX = s.startPoint.x + dx / 2;
                const midY = s.startPoint.y + dy / 2;
                svgContent += `
                <g transform="translate(${midX}, ${midY}) rotate(${transform.rotation})" opacity="${opacity}">
                    <line x1="${-dx / 2}" y1="${-dy / 2}" x2="${dx / 2}" y2="${dy / 2}"
                        stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" />
                </g>`;
            }
            // ARROW
            else if (isArrow(shape)) {
                const s = shape as ArrowShape;
                const dx = s.endPoint.x - s.startPoint.x;
                const dy = s.endPoint.y - s.startPoint.y;
                const midX = s.startPoint.x + dx / 2;
                const midY = s.startPoint.y + dy / 2;
                svgContent += `
                <g transform="translate(${midX}, ${midY}) rotate(${transform.rotation})" opacity="${opacity}">
                    <line x1="${-dx / 2}" y1="${-dy / 2}" x2="${dx / 2}" y2="${dy / 2}"
                        stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" marker-end="url(#arrowhead)" />
                </g>`;
            }
            // TRIANGLE
            else if (isTriangle(shape)) {
                const s = shape as TriangleShape;
                const cx = (s.points[0].x + s.points[1].x + s.points[2].x) / 3;
                const cy = (s.points[0].y + s.points[1].y + s.points[2].y) / 3;
                const pts = s.points.map(p => `${p.x - cx},${p.y - cy}`).join(' ');
                svgContent += `
                 <g transform="translate(${cx}, ${cy}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})" opacity="${opacity}">
                    <polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
                </g>`;
            }
        });

        // 3. Freehand Lines (Middle Layer)
        lines.forEach(line => {
            const points = line.points;
            if (points.length < 2) return;
            let path = `M ${points[0]} ${points[1]}`;
            for (let i = 2; i < points.length; i += 2) {
                path += ` L ${points[i]} ${points[i + 1]}`;
            }
            svgContent += `<path d="${path}" stroke="${line.color}" stroke-width="${line.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
        });

        // 4. Text (Top Layer)
        textAnnotations.forEach(text => {
            // HTML text uses top-left origin. SVG text 'y' is baseline. usage of dominant-baseline="hanging" aligns it to top.
            // Rotation in HTML is transform-origin: top left.
            // SVG rotate(deg, x, y) rotates around (x,y).
            // We need to ensure font styles match.
            // Escape special chars in text
            const escapedText = text.text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

            svgContent += `
            <text x="${text.x}" y="${text.y}"
                transform="rotate(${text.rotation || 0}, ${text.x}, ${text.y})"
                font-family="${text.fontFamily}"
                font-size="${text.fontSize}"
                fill="${text.color}"
                font-weight="${text.fontWeight}"
                font-style="${text.fontStyle}"
                text-decoration="${text.textDecoration}"
                dominant-baseline="hanging"
                text-anchor="${text.textAlign === 'center' ? 'middle' : text.textAlign === 'right' ? 'end' : 'start'}">
                ${escapedText}
            </text>`;
        });


        svgContent += `</svg>`;
        return svgContent;
    };

    // 6.2 Export to Image (PNG/JPG)
    const handleExportImage = (format: 'png' | 'jpeg' = 'png') => {
        if (!stageRef.current) return;
        const width = stageRef.current.width();
        const height = stageRef.current.height();

        const svgString = generateSVGString(width, height);

        const img = new Image();
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2; // Pixel Ratio
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Background for JPG (transparent for PNG if desired, but here we forced dark background in SVG)
                if (format === 'jpeg') {
                    ctx.fillStyle = '#0b0c10';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                ctx.scale(2, 2);
                ctx.drawImage(img, 0, 0);

                const dataURL = canvas.toDataURL(`image/${format}`, 1.0);
                const link = document.createElement('a');
                link.download = `whiteboard-export.${format}`;
                link.href = dataURL;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            URL.revokeObjectURL(url);
        };

        img.src = url;
    };

    // 6.3 Export to SVG
    const handleExportSVG = () => {
        if (!stageRef.current) return;
        const width = stageRef.current.width();
        const height = stageRef.current.height();

        const svgContent = generateSVGString(width, height);

        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'whiteboard-export.svg';
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // 6.4 Export Canvas to PDF
    const handleExportPDF = () => {
        if (!stageRef.current) return;
        const width = stageRef.current.width();
        const height = stageRef.current.height();

        const svgString = generateSVGString(width, height);
        const img = new Image();
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(2, 2);
                ctx.drawImage(img, 0, 0);

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'px',
                    format: [width, height]
                });

                pdf.addImage(imgData, 'PNG', 0, 0, width, height);
                pdf.save('whiteboard-export.pdf');
            }
            URL.revokeObjectURL(url);
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
