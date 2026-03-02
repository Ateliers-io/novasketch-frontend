import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RemoteCursors from './RemoteCursors';

describe('RemoteCursors Component (Task 3.1.3)', () => {
    const defaultStagePos = { x: 0, y: 0 };
    const defaultStageScale = 1;

    it('should render nothing when no users have cursor positions', () => {
        const users = [
            { name: 'Alice', color: '#3B82F6' },
            { name: 'Bob', color: '#EC4899' },
        ];

        const { container } = render(
            <RemoteCursors users={users} stagePos={defaultStagePos} stageScale={defaultStageScale} />
        );

        // No cursor divs should be rendered
        expect(container.firstChild).toBeNull();
    });

    it('should render a cursor for each user with a cursor position', () => {
        const users = [
            { name: 'Karthik', color: '#3B82F6', cursor: { x: 100, y: 200 } },
            { name: 'Shakila', color: '#EC4899', cursor: { x: 300, y: 400 } },
            { name: 'NoMouse', color: '#10B981' }, // no cursor — should not render
        ];

        render(
            <RemoteCursors users={users} stagePos={defaultStagePos} stageScale={defaultStageScale} />
        );

        // Should render exactly 2 cursors (Karthik + Shakila), not NoMouse
        expect(screen.getByText('Karthik')).toBeInTheDocument();
        expect(screen.getByText('Shakila')).toBeInTheDocument();
        expect(screen.queryByText('NoMouse')).not.toBeInTheDocument();
    });

    it('should display the user name label with their profile color', () => {
        const users = [
            { name: 'Karthik', color: '#3B82F6', cursor: { x: 50, y: 50 } },
        ];

        render(
            <RemoteCursors users={users} stagePos={defaultStagePos} stageScale={defaultStageScale} />
        );

        const label = screen.getByText('Karthik');
        expect(label).toBeInTheDocument();
        expect(label.style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3B82F6
    });

    it('should correctly convert canvas coordinates to screen coordinates', () => {
        const users = [
            { name: 'TestUser', color: '#EF4444', cursor: { x: 100, y: 200 } },
        ];
        const stagePos = { x: 50, y: 30 };
        const stageScale = 2;

        const { container } = render(
            <RemoteCursors users={users} stagePos={stagePos} stageScale={stageScale} />
        );

        // screen = virtual * scale + pan → (100*2+50, 200*2+30) = (250, 430)
        const cursorDiv = container.querySelector('.absolute.top-0.left-0') as HTMLElement;
        expect(cursorDiv).toBeTruthy();
        expect(cursorDiv.style.transform).toBe('translate(250px, 430px)');
    });

    it('should correctly convert coordinates at default zoom (scale=1, no pan)', () => {
        const users = [
            { name: 'ZeroUser', color: '#06B6D4', cursor: { x: 150, y: 300 } },
        ];

        const { container } = render(
            <RemoteCursors users={users} stagePos={{ x: 0, y: 0 }} stageScale={1} />
        );

        const cursorDiv = container.querySelector('.absolute.top-0.left-0') as HTMLElement;
        expect(cursorDiv).toBeTruthy();
        // screen = 150*1+0, 300*1+0 = (150, 300)
        expect(cursorDiv.style.transform).toBe('translate(150px, 300px)');
    });

    it('should render SVG arrow cursor with the user color as fill', () => {
        const users = [
            { name: 'ArrowUser', color: '#8B5CF6', cursor: { x: 10, y: 20 } },
        ];

        const { container } = render(
            <RemoteCursors users={users} stagePos={defaultStagePos} stageScale={defaultStageScale} />
        );

        const path = container.querySelector('path');
        expect(path).toBeTruthy();
        expect(path!.getAttribute('fill')).toBe('#8B5CF6');
    });

    it('should have pointer-events-none so cursors do not block canvas interaction', () => {
        const users = [
            { name: 'GhostUser', color: '#F59E0B', cursor: { x: 0, y: 0 } },
        ];

        const { container } = render(
            <RemoteCursors users={users} stagePos={defaultStagePos} stageScale={defaultStageScale} />
        );

        const overlay = container.firstChild as HTMLElement;
        expect(overlay.className).toContain('pointer-events-none');
    });

    it('should render multiple cursors independently', () => {
        const users = [
            { name: 'User1', color: '#FF0000', cursor: { x: 10, y: 10 } },
            { name: 'User2', color: '#00FF00', cursor: { x: 200, y: 200 } },
            { name: 'User3', color: '#0000FF', cursor: { x: 500, y: 500 } },
        ];

        const { container } = render(
            <RemoteCursors users={users} stagePos={defaultStagePos} stageScale={defaultStageScale} />
        );

        // All 3 names should be visible
        expect(screen.getByText('User1')).toBeInTheDocument();
        expect(screen.getByText('User2')).toBeInTheDocument();
        expect(screen.getByText('User3')).toBeInTheDocument();

        // Each should have its own SVG path
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(3);
    });

    it('should have smooth transition style for gliding cursor movement', () => {
        const users = [
            { name: 'SmoothUser', color: '#14B8A6', cursor: { x: 50, y: 50 } },
        ];

        const { container } = render(
            <RemoteCursors users={users} stagePos={defaultStagePos} stageScale={defaultStageScale} />
        );

        const cursorDiv = container.querySelector('.absolute.top-0.left-0') as HTMLElement;
        expect(cursorDiv.style.transition).toContain('80ms');
    });

    it('should use aria-hidden on the overlay container', () => {
        const users = [
            { name: 'A11yUser', color: '#E879F9', cursor: { x: 10, y: 10 } },
        ];

        const { container } = render(
            <RemoteCursors users={users} stagePos={defaultStagePos} stageScale={defaultStageScale} />
        );

        const overlay = container.firstChild as HTMLElement;
        expect(overlay.getAttribute('aria-hidden')).toBe('true');
    });
});
