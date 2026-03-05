import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LiveCollaborationMenu from './LiveCollaborationMenu';
import React from 'react';

// Mock navigator.share and clipbord
Object.assign(navigator, {
    share: vi.fn(),
    clipboard: {
        writeText: vi.fn()
    }
});

vi.mock('../../../services/socket.service', () => ({
    socketService: {
        getSocket: vi.fn(() => ({ id: 'test-socket-id' })),
    }
}));

vi.mock('react-qr-code', () => ({
    default: () => <div data-testid="qr-mock" />
}));

describe('LiveCollaborationMenu Component', () => {
    const mockProps = {
        theme: 'dark',
        roomId: 'test-room',
        isLockSessionActive: false,
        onToggleLockSession: vi.fn(),
        users: [{ id: '1', name: 'User 1', color: '#000000', cursor: { x: 0, y: 0 } }]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Return successful share by default
        (navigator.share as any).mockResolvedValue(undefined);
    });

    it('should render the QR code when session is started', () => {
        render(<LiveCollaborationMenu {...mockProps} />);

        // Start session first
        const startBtn = screen.getByText('Start Live Session');
        fireEvent.click(startBtn);

        expect(screen.getByTestId('qr-mock')).toBeInTheDocument();
        expect(screen.getByText('Scan to join')).toBeInTheDocument();
    });

    it('should show success icon when link is copied', () => {
        render(<LiveCollaborationMenu {...mockProps} />);

        // Start session first
        const startBtn = screen.getByText('Start Live Session');
        fireEvent.click(startBtn);

        const copyLinkBtn = screen.getByRole('button', { name: /copy/i });
        expect(copyLinkBtn).toBeInTheDocument();

        // Mock success output
        fireEvent.click(copyLinkBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('novasketch.vercel.app'));
    });

    it('should open WhatsApp link when Share via WhatsApp is clicked', () => {
        const originalOpen = window.open;
        window.open = vi.fn();

        render(<LiveCollaborationMenu {...mockProps} />);

        // Start session first
        const startBtn = screen.getByText('Start Live Session');
        fireEvent.click(startBtn);

        const whatsappBtn = screen.getByText('WhatsApp');
        fireEvent.click(whatsappBtn);

        expect(window.open).toHaveBeenCalled();
        const urlArgs = (window.open as any).mock.calls[0][0];
        expect(urlArgs).toContain('wa.me');

        window.open = originalOpen;
    });
});
