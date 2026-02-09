/**
 * Landing Page Component Tests
 * 
 * Tests for the Landing/Home page component including:
 * - Hero section rendering
 * - Navigation elements
 * - CTA buttons
 * - Feature cards
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import Landing from './Landing';

// Mock GSAP to avoid animation issues in tests
vi.mock('gsap', () => ({
    default: {
        registerPlugin: vi.fn(),
        context: vi.fn(() => ({
            add: vi.fn(),
            revert: vi.fn(),
        })),
        from: vi.fn(),
        to: vi.fn(),
        fromTo: vi.fn(),
        set: vi.fn(),
    },
    gsap: {
        registerPlugin: vi.fn(),
    },
}));

vi.mock('gsap/ScrollTrigger', () => ({
    ScrollTrigger: {
        batch: vi.fn(),
    },
}));

// Mock canvas context
beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
    })) as any;
});

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Landing Page', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
    });

    const renderLanding = () => {
        return render(
            <MemoryRouter>
                <Landing />
            </MemoryRouter>
        );
    };

    describe('Hero Section', () => {
        it('should render the main heading', () => {
            renderLanding();

            // Check for the main heading text
            expect(screen.getByText('Sketch Ideas,')).toBeInTheDocument();
            expect(screen.getByText('Together')).toBeInTheDocument();
        });

        it('should render the tagline badge', () => {
            renderLanding();

            expect(screen.getByText('Collaborative Whiteboard for Teams')).toBeInTheDocument();
        });

        it('should render the description paragraph', () => {
            renderLanding();

            expect(screen.getByText(/A real-time collaborative whiteboard/i)).toBeInTheDocument();
        });

        it('should render Try Demo button', () => {
            renderLanding();

            const demoButton = screen.getByRole('button', { name: /try demo/i });
            expect(demoButton).toBeInTheDocument();
        });

        it('should render Sign Up Free button', () => {
            renderLanding();

            const signUpButton = screen.getByRole('button', { name: /sign up free/i });
            expect(signUpButton).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('should render the NovaSketch logo text', () => {
            renderLanding();

            expect(screen.getByText('NovaSketch')).toBeInTheDocument();
        });

        it('should render Sign In button in navbar', () => {
            renderLanding();

            // There should be a Sign In button in the navbar
            const signInButtons = screen.getAllByText('Sign In');
            expect(signInButtons.length).toBeGreaterThanOrEqual(1);
        });

        it('should render Get Started button in navbar', () => {
            renderLanding();

            const getStartedButtons = screen.getAllByText('Get Started');
            expect(getStartedButtons.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Navigation Actions', () => {
        it('should navigate to /auth when Sign In is clicked', () => {
            renderLanding();

            const signInButtons = screen.getAllByText('Sign In');
            fireEvent.click(signInButtons[0]);

            expect(mockNavigate).toHaveBeenCalledWith('/auth');
        });

        it('should navigate to /auth when Get Started is clicked', () => {
            renderLanding();

            const getStartedButtons = screen.getAllByText('Get Started');
            fireEvent.click(getStartedButtons[0]);

            expect(mockNavigate).toHaveBeenCalledWith('/auth');
        });

        it('should navigate to /board/demo when Try Demo is clicked', () => {
            renderLanding();

            const demoButton = screen.getByRole('button', { name: /try demo/i });
            fireEvent.click(demoButton);

            expect(mockNavigate).toHaveBeenCalledWith('/board/demo');
        });

        it('should navigate to /auth when Sign Up Free is clicked', () => {
            renderLanding();

            const signUpButton = screen.getByRole('button', { name: /sign up free/i });
            fireEvent.click(signUpButton);

            expect(mockNavigate).toHaveBeenCalledWith('/auth');
        });
    });

    describe('Features Section', () => {
        it('should render "Everything you need" heading', () => {
            renderLanding();

            expect(screen.getByText('Everything you need')).toBeInTheDocument();
        });

        it('should render feature descriptions', () => {
            renderLanding();

            // Check for some feature titles
            expect(screen.getByText('Infinite Canvas')).toBeInTheDocument();
            expect(screen.getByText('Real-time Collaboration')).toBeInTheDocument();
        });
    });

    describe('Product Preview', () => {
        it('should render the preview window', () => {
            renderLanding();

            // Check for elements in the preview
            expect(screen.getByText('Team Project - Brainstorm Session')).toBeInTheDocument();
        });

        it('should show online users indicator', () => {
            renderLanding();

            expect(screen.getByText('3 online')).toBeInTheDocument();
        });

        it('should show sample canvas elements', () => {
            renderLanding();

            expect(screen.getByText('User Research Findings')).toBeInTheDocument();
            expect(screen.getByText(/Design Sprint/i)).toBeInTheDocument();
        });

        it('should show live cursor labels', () => {
            renderLanding();

            expect(screen.getByText('Alex')).toBeInTheDocument();
            expect(screen.getByText('Maya')).toBeInTheDocument();
        });
    });

    describe('Footer/CTA Section', () => {
        it('should render final CTA section', () => {
            renderLanding();

            expect(screen.getByText(/Ready to start sketching/i)).toBeInTheDocument();
        });

        it('should have a final Get Started button', () => {
            renderLanding();

            const startButtons = screen.getAllByText(/Get Started/i);
            expect(startButtons.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Accessibility', () => {
        it('should have proper button roles', () => {
            renderLanding();

            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('should have main heading hierarchy', () => {
            renderLanding();

            // h1 should be present
            const h1 = screen.getAllByRole('heading', { level: 1 });
            expect(h1.length).toBeGreaterThan(0);
        });
    });

    describe('Responsive Design Classes', () => {
        it('should have responsive text classes on heading', () => {
            renderLanding();

            // The h1 should have responsive classes
            const heading = screen.getByText('Sketch Ideas,').closest('h1');
            expect(heading).toHaveClass('text-5xl');
            expect(heading).toHaveClass('md:text-7xl');
        });
    });
});
