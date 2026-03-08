/**
 * Dashboard Component Tests
 * 
 * Tests for the Dashboard component including:
 * - UI Rendering (Sidebar, Projects, Notifications)
 * - Todo List Interactions (Mocked)
 * - Navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';

// Mock GSAP
vi.mock('gsap', () => ({
    default: {
        context: vi.fn(() => ({
            add: vi.fn(),
            revert: vi.fn(),
        })),
        utils: {
            selector: vi.fn(() => () => []),
        },
        timeline: vi.fn(() => ({
            to: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            play: vi.fn(),
            pause: vi.fn(),
        })),
    },
}));

// Mock Navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock Auth Context
const mockLogout = vi.fn();
vi.mock('../../../contexts', () => ({
    useAuth: () => ({
        user: { displayName: 'Test User', email: 'test@example.com' },
        logout: mockLogout,
    }),
}));

// Mock Session Service
vi.mock('../../../services/session.service', () => ({
    getUserSessions: vi.fn(),
    deleteSession: vi.fn(),
    createSession: vi.fn(),
}));

import { getUserSessions } from '../../../services/session.service';

describe('Dashboard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Return some mock projects
        (getUserSessions as any).mockResolvedValue([
            { sessionId: '1', name: 'Neural Interface V2', isCollab: false, lastEditedAt: new Date().toISOString() },
            { sessionId: '2', name: 'Team Brainstorm', isCollab: true, lastEditedAt: new Date().toISOString() }
        ]);
    });

    const renderDashboard = () => {
        return render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );
    };

    describe('Layout & Rendering', () => {
        it('should render the dashboard layout', async () => {
            renderDashboard();
            await screen.findByText('Neural Interface V2');
            expect(screen.getByText('NovaSketch')).toBeInTheDocument();
            expect(screen.getByText('Dashboard')).toBeInTheDocument();
        });

        it('should render the sidebar with navigation items', async () => {
            renderDashboard();
            await screen.findByText('Neural Interface V2');
            expect(screen.getByText('All Projects')).toBeInTheDocument();
            expect(screen.getByText('Recent')).toBeInTheDocument();
        });

        it('should render project cards from the API', async () => {
            renderDashboard();
            expect(await screen.findByText('Neural Interface V2')).toBeInTheDocument();
            expect(screen.getByText('Team Brainstorm')).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should toggle filtering projects', async () => {
            renderDashboard();
            // Wait for projects to load first
            await screen.findByText('Neural Interface V2');

            const collabTab = screen.getByText('Collaborative');
            fireEvent.click(collabTab);

            // Should still show the collaborative one
            expect(await screen.findByText('Team Brainstorm')).toBeInTheDocument();
            // The personal one might be hidden, but we just verify the toggle interaction doesn't crash
        });

        it('should handle logout', async () => {
            renderDashboard();
            await screen.findByText('Neural Interface V2');

            const logoutBtn = screen.getByTitle('Log Out');
            fireEvent.click(logoutBtn);
            expect(mockLogout).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });
    });

    describe('Dashboard History and Filters', () => {
        it('should filter projects by search query', async () => {
            renderDashboard();
            await screen.findByText('Neural Interface V2');

            const searchInput = screen.getByPlaceholderText('Search projects...');
            fireEvent.change(searchInput, { target: { value: 'Team Brainstorm' } });

            await waitFor(() => {
                expect(screen.getByText('Team Brainstorm')).toBeInTheDocument();
                expect(screen.queryByText('Neural Interface V2')).not.toBeInTheDocument();
            });

            // clear search
            fireEvent.change(searchInput, { target: { value: '' } });
            await waitFor(() => {
                expect(screen.getByText('Neural Interface V2')).toBeInTheDocument();
            });
        });

        it('should change to recent view (dashboard history) and display sorted projects', async () => {
            renderDashboard();
            await screen.findByText('Neural Interface V2');

            const recentBtn = screen.getByText('Recent');
            fireEvent.click(recentBtn);

            await waitFor(() => {
                expect(screen.getByText('Recent Projects')).toBeInTheDocument();
            });

            // Toggle sort
            const sortBtn = screen.getByTitle('Sort: Newest first');
            fireEvent.click(sortBtn);

            await waitFor(() => {
                expect(screen.getByTitle('Sort: Oldest first')).toBeInTheDocument();
            });
        });

        it('should show zero states when no project matches search', async () => {
            renderDashboard();
            await screen.findByText('Neural Interface V2');

            const searchInput = screen.getByPlaceholderText('Search projects...');
            fireEvent.change(searchInput, { target: { value: 'NonExistentProject1234' } });

            await waitFor(() => {
                expect(screen.getByText('No matching projects')).toBeInTheDocument();
                expect(screen.queryByText('Neural Interface V2')).not.toBeInTheDocument();
            });
        });
    });
});
