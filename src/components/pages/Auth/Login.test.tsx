/**
 * Login Page Component Tests
 * 
 * Tests for the Login/Auth page component including:
 * - UI elements rendering
 * - Authentication flow
 * - Navigation actions
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Login } from './Login';

// Mock GSAP
vi.mock('gsap', () => ({
    default: {
        context: vi.fn(() => ({
            add: vi.fn(),
            revert: vi.fn(),
        })),
        timeline: vi.fn(() => ({
            fromTo: vi.fn().mockReturnThis(),
        })),
        from: vi.fn(),
        to: vi.fn(),
    },
}));

// Mock canvas context
beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
        clearRect: vi.fn(),
        fillStyle: '',
        fillRect: vi.fn(),
        strokeStyle: '',
        lineWidth: 0,
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
    })) as any;
});

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock Google OAuth
vi.mock('@react-oauth/google', () => ({
    useGoogleLogin: () => vi.fn(),
}));

// Default auth context mock values
const mockLoginWithGoogle = vi.fn();
const mockClearError = vi.fn();

let mockAuthState = {
    isAuthenticated: false,
    isLoading: false,
    error: null as string | null,
};

// Mock Auth Context
vi.mock('../../../contexts', () => ({
    useAuth: () => ({
        loginWithGoogle: mockLoginWithGoogle,
        error: mockAuthState.error,
        clearError: mockClearError,
        isAuthenticated: mockAuthState.isAuthenticated,
        isLoading: mockAuthState.isLoading,
    }),
}));

describe('Login Page', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockLoginWithGoogle.mockClear();
        mockClearError.mockClear();
        mockAuthState = {
            isAuthenticated: false,
            isLoading: false,
            error: null,
        };
    });

    const renderLogin = () => {
        return render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );
    };

    describe('UI Elements', () => {
        it('should render the NovaSketch title', () => {
            renderLogin();

            expect(screen.getByText('NovaSketch')).toBeInTheDocument();
        });

        it('should render the subtitle', () => {
            renderLogin();

            expect(screen.getByText('Collaborative Whiteboard')).toBeInTheDocument();
        });

        it('should render Google login button', () => {
            renderLogin();

            expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
        });

        it('should render Back button', () => {
            renderLogin();

            expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
        });

        it('should render version indicator', () => {
            renderLogin();

            expect(screen.getByText('v2.0')).toBeInTheDocument();
        });

        it('should render status indicators', () => {
            renderLogin();

            expect(screen.getByText('Secure')).toBeInTheDocument();
            expect(screen.getByText('Online')).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('should navigate to home when Back is clicked', () => {
            renderLogin();

            const backButton = screen.getByRole('button', { name: /back/i });
            fireEvent.click(backButton);

            expect(mockNavigate).toHaveBeenCalledWith('/');
        });
    });

    describe('Button States', () => {
        it('should show normal state for Google button when not loading', () => {
            renderLogin();

            const googleButton = screen.getByRole('button', { name: /continue with google/i });
            expect(googleButton).not.toBeDisabled();
        });
    });

    describe('Accessibility', () => {
        it('should have proper button roles', () => {
            renderLogin();

            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThanOrEqual(2); // Back + Google
        });

        it('should have main heading', () => {
            renderLogin();

            const heading = screen.getByRole('heading', { level: 1 });
            expect(heading).toHaveTextContent('NovaSketch');
        });
    });

    describe('Visual Elements', () => {
        it('should have login panel structure', () => {
            renderLogin();

            // Check that the main title is present indicating the panel rendered
            expect(screen.getByText('NovaSketch')).toBeInTheDocument();
        });
    });

    describe('Responsiveness', () => {
        it('should have responsive text classes on heading', () => {
            renderLogin();

            const heading = screen.getByRole('heading', { level: 1 });
            expect(heading).toHaveClass('text-3xl');
            expect(heading).toHaveClass('md:text-4xl');
        });
    });
});

describe('Login Page - Error Display', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockLoginWithGoogle.mockClear();
        mockClearError.mockClear();
    });

    it('should display error message when error exists', () => {
        // Set error state before rendering
        mockAuthState.error = 'Authentication failed. Please try again.';

        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        expect(screen.getByText('Authentication failed. Please try again.')).toBeInTheDocument();
    });
});

describe('StatusIndicator Component', () => {
    it('should render correctly within login page', () => {
        mockAuthState = {
            isAuthenticated: false,
            isLoading: false,
            error: null,
        };

        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        // Check both status indicators are present
        expect(screen.getByText('Secure')).toBeInTheDocument();
        expect(screen.getByText('Online')).toBeInTheDocument();
    });
});
