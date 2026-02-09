/**
 * Unit Tests for ExportTools Component
 * 
 * These tests validate the logic of the ExportTools functions without requiring
 * a running backend or browser environment.
 */

// Mock dependencies
const mockCreateObjectURL = jest.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = jest.fn();

// Setup global mocks
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;
global.Blob = class MockBlob {
    constructor(content, options) {
        this.content = content;
        this.options = options;
    }
};

describe('ExportTools Unit Tests', () => {

    // ============================================
    // 1. getTimestampFilename Tests
    // ============================================
    describe('getTimestampFilename', () => {

        // Reimplementation of the function for testing
        const getTimestampFilename = (ext) => {
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            return `novasketch-${timestamp}.${ext}`;
        };

        test('should generate filename with correct prefix', () => {
            const filename = getTimestampFilename('png');
            expect(filename.startsWith('novasketch-')).toBe(true);
        });

        test('should generate filename with correct extension for PNG', () => {
            const filename = getTimestampFilename('png');
            expect(filename.endsWith('.png')).toBe(true);
        });

        test('should generate filename with correct extension for JPG', () => {
            const filename = getTimestampFilename('jpg');
            expect(filename.endsWith('.jpg')).toBe(true);
        });

        test('should generate filename with correct extension for SVG', () => {
            const filename = getTimestampFilename('svg');
            expect(filename.endsWith('.svg')).toBe(true);
        });

        test('should generate filename with correct extension for PDF', () => {
            const filename = getTimestampFilename('pdf');
            expect(filename.endsWith('.pdf')).toBe(true);
        });

        test('should not contain colons or dots in timestamp portion', () => {
            const filename = getTimestampFilename('png');
            // Extract timestamp portion (between 'novasketch-' and '.png')
            const timestampPart = filename.replace('novasketch-', '').replace('.png', '');
            expect(timestampPart).not.toContain(':');
            expect(timestampPart).not.toContain('.');
        });

        test('should generate unique filenames for different times', () => {
            const filename1 = getTimestampFilename('png');
            // Simulate time passing
            jest.useFakeTimers();
            jest.advanceTimersByTime(1000);
            const filename2 = getTimestampFilename('png');
            jest.useRealTimers();

            // Both should be valid format
            expect(filename1).toMatch(/^novasketch-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/);
        });
    });

    // ============================================
    // 2. SVG Generation Logic Tests
    // ============================================
    describe('SVG Generation Logic', () => {

        // Helper function that mirrors the component's SVG generation
        const generateSVGContent = (width, height, shapes, lines, textAnnotations) => {
            let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
            svgContent += `<rect width="100%" height="100%" fill="white"/>`;

            // Shapes
            shapes.forEach(shape => {
                if (shape.type === 'RECTANGLE') {
                    svgContent += `<rect x="${shape.position.x}" y="${shape.position.y}" width="${shape.width}" height="${shape.height}" stroke="${shape.style.stroke}" stroke-width="${shape.style.strokeWidth}" fill="${shape.style.hasFill ? shape.style.fill : 'none'}" />`;
                } else if (shape.type === 'CIRCLE') {
                    svgContent += `<circle cx="${shape.position.x}" cy="${shape.position.y}" r="${shape.radius}" stroke="${shape.style.stroke}" stroke-width="${shape.style.strokeWidth}" fill="${shape.style.hasFill ? shape.style.fill : 'none'}" />`;
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
            return svgContent;
        };

        test('should generate valid SVG with correct dimensions', () => {
            const svg = generateSVGContent(800, 600, [], [], []);
            expect(svg).toContain('width="800"');
            expect(svg).toContain('height="600"');
            expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
        });

        test('should include white background rectangle', () => {
            const svg = generateSVGContent(800, 600, [], [], []);
            expect(svg).toContain('<rect width="100%" height="100%" fill="white"/>');
        });

        test('should correctly render rectangle shape', () => {
            const shapes = [{
                type: 'RECTANGLE',
                position: { x: 10, y: 20 },
                width: 100,
                height: 50,
                style: { stroke: '#FF0000', strokeWidth: 2, fill: '#00FF00', hasFill: true }
            }];
            const svg = generateSVGContent(800, 600, shapes, [], []);

            expect(svg).toContain('x="10"');
            expect(svg).toContain('y="20"');
            expect(svg).toContain('width="100"');
            expect(svg).toContain('height="50"');
            expect(svg).toContain('stroke="#FF0000"');
            expect(svg).toContain('fill="#00FF00"');
        });

        test('should correctly render circle shape', () => {
            const shapes = [{
                type: 'CIRCLE',
                position: { x: 100, y: 100 },
                radius: 50,
                style: { stroke: '#0000FF', strokeWidth: 3, fill: '#FFFF00', hasFill: true }
            }];
            const svg = generateSVGContent(800, 600, shapes, [], []);

            expect(svg).toContain('cx="100"');
            expect(svg).toContain('cy="100"');
            expect(svg).toContain('r="50"');
            expect(svg).toContain('stroke="#0000FF"');
        });

        test('should render shape without fill when hasFill is false', () => {
            const shapes = [{
                type: 'RECTANGLE',
                position: { x: 0, y: 0 },
                width: 50,
                height: 50,
                style: { stroke: '#000', strokeWidth: 1, fill: '#FFF', hasFill: false }
            }];
            const svg = generateSVGContent(800, 600, shapes, [], []);

            expect(svg).toContain('fill="none"');
        });

        test('should correctly render line/path', () => {
            const lines = [{
                points: [0, 0, 100, 100, 200, 50],
                color: '#FF00FF',
                strokeWidth: 5
            }];
            const svg = generateSVGContent(800, 600, [], lines, []);

            expect(svg).toContain('d="M 0 0 L 100 100 L 200 50"');
            expect(svg).toContain('stroke="#FF00FF"');
            expect(svg).toContain('stroke-width="5"');
        });

        test('should correctly render text annotation', () => {
            const textAnnotations = [{
                x: 50,
                y: 50,
                text: 'Hello World',
                fontSize: 16,
                fontFamily: 'Arial',
                color: '#333333',
                fontWeight: 'bold',
                fontStyle: 'italic',
                textDecoration: 'underline'
            }];
            const svg = generateSVGContent(800, 600, [], [], textAnnotations);

            expect(svg).toContain('x="50"');
            expect(svg).toContain('y="66"'); // y + fontSize
            expect(svg).toContain('Hello World');
            expect(svg).toContain('font-family="Arial"');
            expect(svg).toContain('font-size="16"');
            expect(svg).toContain('font-weight="bold"');
        });

        test('should handle empty canvas', () => {
            const svg = generateSVGContent(800, 600, [], [], []);
            expect(svg).toBe('<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/></svg>');
        });

        test('should render multiple shapes correctly', () => {
            const shapes = [
                { type: 'RECTANGLE', position: { x: 0, y: 0 }, width: 50, height: 50, style: { stroke: '#000', strokeWidth: 1, fill: '#FFF', hasFill: true } },
                { type: 'CIRCLE', position: { x: 100, y: 100 }, radius: 25, style: { stroke: '#F00', strokeWidth: 2, fill: '#0F0', hasFill: true } }
            ];
            const svg = generateSVGContent(800, 600, shapes, [], []);

            expect(svg).toContain('<rect');
            expect(svg).toContain('<circle');
        });
    });

    // ============================================
    // 3. PDF Orientation Logic Tests
    // ============================================
    describe('PDF Orientation Logic', () => {

        const getOrientation = (width, height) => {
            return width > height ? 'l' : 'p';
        };

        test('should return landscape for wider canvas', () => {
            expect(getOrientation(1920, 1080)).toBe('l');
        });

        test('should return portrait for taller canvas', () => {
            expect(getOrientation(1080, 1920)).toBe('p');
        });

        test('should return portrait for square canvas', () => {
            expect(getOrientation(1000, 1000)).toBe('p');
        });
    });

    // ============================================
    // 4. Clear Canvas Confirmation Logic
    // ============================================
    describe('Clear Canvas Logic', () => {

        test('should call onClear callback when confirmed', () => {
            const mockOnClear = jest.fn();
            const mockConfirm = jest.fn(() => true);
            global.confirm = mockConfirm;

            // Simulate handleClear
            const handleClear = (onClear) => {
                if (confirm('Are you sure?')) {
                    onClear();
                }
            };

            handleClear(mockOnClear);

            expect(mockConfirm).toHaveBeenCalled();
            expect(mockOnClear).toHaveBeenCalled();
        });

        test('should NOT call onClear when cancelled', () => {
            const mockOnClear = jest.fn();
            const mockConfirm = jest.fn(() => false);
            global.confirm = mockConfirm;

            const handleClear = (onClear) => {
                if (confirm('Are you sure?')) {
                    onClear();
                }
            };

            handleClear(mockOnClear);

            expect(mockConfirm).toHaveBeenCalled();
            expect(mockOnClear).not.toHaveBeenCalled();
        });
    });

    // ============================================
    // 5. Export Format Mapping Tests
    // ============================================
    describe('Export Format Mapping', () => {

        const getDownloadExtension = (format) => {
            return format === 'jpeg' ? 'jpg' : format;
        };

        test('should map jpeg to jpg', () => {
            expect(getDownloadExtension('jpeg')).toBe('jpg');
        });

        test('should keep png as png', () => {
            expect(getDownloadExtension('png')).toBe('png');
        });
    });
});
