import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AnalyzeWithAI from './AnalyzeWithAI';
import React from 'react';

// Mock clipboard API
Object.assign(navigator, {
    clipboard: {
        write: vi.fn(),
    },
});

describe('AnalyzeWithAI Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Since we are not in an actual browser environment, we'll mock ClipboardItem
        (globalThis as any).ClipboardItem = class ClipboardItem {
            data: any;
            constructor(data: any) {
                this.data = data;
            }
        };
        window.open = vi.fn();
    });

    it('should render the component with ChatGPT and Gemini options', () => {
        render(<AnalyzeWithAI />);

        expect(screen.getByText('ChatGPT')).toBeInTheDocument();
        expect(screen.getByText('Gemini')).toBeInTheDocument();
    });

    it('should handle capturing and opening ChatGPT successfully', async () => {
        const mockBlob = new Blob(['fake image data'], { type: 'image/png' });
        const mockOnCaptureCanvas = vi.fn().mockResolvedValue(mockBlob);

        render(<AnalyzeWithAI onCaptureCanvas={mockOnCaptureCanvas} />);

        const chatGptButton = screen.getByText('ChatGPT').closest('button');
        expect(chatGptButton).toBeInTheDocument();

        fireEvent.click(chatGptButton!);

        expect(mockOnCaptureCanvas).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(navigator.clipboard.write).toHaveBeenCalledTimes(1);
            expect(window.open).toHaveBeenCalledWith('https://chatgpt.com/', '_blank');
            expect(screen.getByText('Image copied to clipboard!')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('should handle capturing and opening Gemini successfully', async () => {
        const mockBlob = new Blob(['fake image data'], { type: 'image/png' });
        const mockOnCaptureCanvas = vi.fn().mockResolvedValue(mockBlob);

        render(<AnalyzeWithAI onCaptureCanvas={mockOnCaptureCanvas} />);

        const geminiButton = screen.getByText('Gemini').closest('button');
        expect(geminiButton).toBeInTheDocument();

        fireEvent.click(geminiButton!);

        expect(mockOnCaptureCanvas).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(navigator.clipboard.write).toHaveBeenCalledTimes(1);
            expect(window.open).toHaveBeenCalledWith('https://gemini.google.com/app', '_blank');
            expect(screen.getByText('Image copied to clipboard!')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('should handle capture failure gracefully', async () => {
        const mockOnCaptureCanvas = vi.fn().mockResolvedValue(null);

        render(<AnalyzeWithAI onCaptureCanvas={mockOnCaptureCanvas} />);

        const chatGptButton = screen.getByText('ChatGPT').closest('button');
        fireEvent.click(chatGptButton!);

        expect(mockOnCaptureCanvas).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(navigator.clipboard.write).not.toHaveBeenCalled();
            expect(screen.getByText('No drawing found')).toBeInTheDocument();
        });
    });

    it('should display error if navigator.clipboard is unavailable', async () => {
        const mockBlob = new Blob(['fake image data'], { type: 'image/png' });
        const mockOnCaptureCanvas = vi.fn().mockResolvedValue(mockBlob);

        // Break clipboard mock temporarily for this test
        const originalClipboard = navigator.clipboard;
        Object.assign(navigator, {
            clipboard: { write: vi.fn().mockRejectedValue(new Error('Permission denied')) }
        });

        render(<AnalyzeWithAI onCaptureCanvas={mockOnCaptureCanvas} />);

        const chatGptButton = screen.getByText('ChatGPT').closest('button');
        fireEvent.click(chatGptButton!);

        await waitFor(() => {
            expect(screen.getByText('Copy failed')).toBeInTheDocument();
        });

        // Restore clipboard
        Object.assign(navigator, { clipboard: originalClipboard });
    });

    it('should not do anything if onCaptureCanvas prop is not provided', async () => {
        render(<AnalyzeWithAI />);

        const chatGptButton = screen.getByText('ChatGPT').closest('button');
        fireEvent.click(chatGptButton!);

        expect(navigator.clipboard.write).not.toHaveBeenCalled();
    });
});
