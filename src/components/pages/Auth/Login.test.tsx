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
            to: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
        })),
        from: vi.fn(),
        to: vi.fn(),
        set: vi.fn(),
        fromTo: vi.fn(),
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
        loginWithEmail: vi.fn(),
        register: vi.fn(),
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

            // NovaSketch appears as label text in the form header
            const novaSketchTexts = screen.getAllByText('NovaSketch');
            expect(novaSketchTexts.length).toBeGreaterThanOrEqual(1);
        });

        it('should render Google login button', () => {
            renderLogin();

            // Both sign-up and sign-in forms have a Google button
            const googleButtons = screen.getAllByRole('button', { name: /continue with google/i });
            expect(googleButtons.length).toBeGreaterThanOrEqual(1);
        });

        it('should render Back button', () => {
            renderLogin();

            expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
        });

        it('should render the Create Account heading', () => {
            renderLogin();

            expect(screen.getByText('Create Account')).toBeInTheDocument();
        });

        it('should render the subtitle text', () => {
            renderLogin();

            expect(screen.getByText('Start sketching ideas with your team')).toBeInTheDocument();
        });

        it('should render security indicators', () => {
            renderLogin();

            // The sign-up form shows "256-BIT ENCRYPTED" and "LIVE"
            expect(screen.getByText('256-BIT ENCRYPTED')).toBeInTheDocument();
            expect(screen.getByText('LIVE')).toBeInTheDocument();
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

            const googleButtons = screen.getAllByRole('button', { name: /continue with google/i });
            expect(googleButtons[0]).not.toBeDisabled();
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

            // Both sign-up ("Create Account") and sign-in ("Sign In") forms have h1 elements
            const headings = screen.getAllByRole('heading', { level: 1 });
            expect(headings.length).toBeGreaterThanOrEqual(1);
            expect(headings[0]).toHaveTextContent('Create Account');
        });
    });

    describe('Visual Elements', () => {
        it('should have login panel structure', () => {
            renderLogin();

            // Check that the main NovaSketch label is present indicating the panel rendered
            const novaSketchTexts = screen.getAllByText('NovaSketch');
            expect(novaSketchTexts.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Form Elements', () => {
        it('should render input fields for sign up', () => {
            renderLogin();

            // Both sign-up and sign-in forms are rendered in the DOM (sign-in is hidden)
            // so Email address and Password placeholders appear twice
            expect(screen.getByPlaceholderText('Full name')).toBeInTheDocument();
            const emailInputs = screen.getAllByPlaceholderText('Email address');
            expect(emailInputs.length).toBeGreaterThanOrEqual(1);
            const passwordInputs = screen.getAllByPlaceholderText('Password');
            expect(passwordInputs.length).toBeGreaterThanOrEqual(1);
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

        // Check security indicators are present (sign-up form has these)
        expect(screen.getByText('256-BIT ENCRYPTED')).toBeInTheDocument();
        expect(screen.getByText('LIVE')).toBeInTheDocument();
    });
});
