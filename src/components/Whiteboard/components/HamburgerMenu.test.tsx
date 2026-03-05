import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HamburgerMenu from './HamburgerMenu';
import React from 'react';

vi.mock('../../../services/socket.service', () => ({
    socketService: {
        getSocket: vi.fn(() => ({ id: 'test-socket-id' })),
    }
}));

describe('HamburgerMenu Component', () => {
    const mockProps = {
        lines: [],
        shapes: [],
        textAnnotations: [],
        canvasBackgroundColor: '#ffffff',
        onClearCanvas: vi.fn(),
        onToggleTheme: vi.fn(),
        theme: 'dark' as 'dark' | 'light',
        onLoadBoardState: vi.fn(),
        onCaptureCanvas: vi.fn().mockResolvedValue(new Blob()),
        isLockSessionActive: false,
        onToggleLockSession: vi.fn(),
        users: [{ id: '1', name: 'User 1', color: '#000000', cursor: { x: 0, y: 0 } }]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock URL.createObjectURL and URL.revokeObjectURL
        window.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
        window.URL.revokeObjectURL = vi.fn();
    });

    it('should render the menu button', () => {
        render(<HamburgerMenu {...mockProps} />);
        expect(screen.getByTitle('Open menu')).toBeInTheDocument();
    });

    it('should toggle menu open and closed', () => {
        render(<HamburgerMenu {...mockProps} />);
        const button = screen.getByTitle('Open menu');

        // Open
        fireEvent.click(button);
        expect(screen.getByText('Theme')).toBeInTheDocument();
        expect(screen.getByText('Live collaboration')).toBeInTheDocument();
        expect(screen.getByText('Analyze with AI')).toBeInTheDocument();
        expect(screen.getByText('Clear Canvas')).toBeInTheDocument();

        // Close. Note the title changes when open.
        const closeButton = screen.getByTitle('Close menu');
        fireEvent.click(closeButton);
        expect(screen.queryByText('Theme')).not.toBeInTheDocument();
    });

    it('should call onClearCanvas when Clear is clicked from Edit menu', async () => {
        render(<HamburgerMenu {...mockProps} />);
        fireEvent.click(screen.getByTitle('Open menu')); // Open menu

        const clearButton = screen.getByText('Clear Canvas');
        fireEvent.click(clearButton);

        expect(mockProps.onClearCanvas).toHaveBeenCalled();
    });

    it('should call onToggleTheme when Theme is clicked', () => {
        render(<HamburgerMenu {...mockProps} />);
        fireEvent.click(screen.getByTitle('Open menu')); // Open menu

        // Theme toggle is inside the menu item labeled Theme
        const themeButton = screen.getByText('Theme');
        const toggleDiv = themeButton.closest('button')?.querySelector('[role="button"]');
        expect(toggleDiv).not.toBeNull();
        fireEvent.click(toggleDiv!);

        expect(mockProps.onToggleTheme).toHaveBeenCalled();
    });

});
