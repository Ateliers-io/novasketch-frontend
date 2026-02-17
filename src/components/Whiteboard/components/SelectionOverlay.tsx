/**
 * SelectionOverlay component for rendering bounding box, resize handles, and rotation handle.
 * Extracted from Whiteboard.tsx (lines 2296-2452).
 */
import React from 'react';
import { BoundingBox } from '../../../utils/boundingBox';

interface SelectionOverlayProps {
    selectionBoundingBox: BoundingBox;
    dimensions: { width: number; height: number };
    rotation?: number;
    showRotationHandle: boolean;
    transform?: { x: number; y: number; scale: number };
}

const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
    selectionBoundingBox,
    dimensions,
    rotation,
    showRotationHandle,
    transform = { x: 0, y: 0, scale: 1 },
}) => {
    return (
        <svg
            className="absolute inset-0 z-15"
            width={dimensions.width}
            height={dimensions.height}
            style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                <g transform={rotation !== undefined
                    ? `rotate(${rotation}, ${selectionBoundingBox.centerX}, ${selectionBoundingBox.centerY})`
                    : undefined}>
                    {/* SVG Definitions for filters */}
                    <defs>
                        {/* Drop shadow for handles */}
                        <filter id="handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.4" />
                        </filter>
                        {/* Glow effect for bounding box */}
                        <filter id="selection-glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Main bounding box with glow */}
                    <rect
                        x={selectionBoundingBox.minX - 4}
                        y={selectionBoundingBox.minY - 4}
                        width={selectionBoundingBox.width + 8}
                        height={selectionBoundingBox.height + 8}
                        fill="none"
                        stroke="#2dd4bf"
                        strokeWidth={1.5}
                        strokeDasharray="6,4"
                        rx={2}
                        filter="url(#selection-glow)"
                        opacity={0.8}
                    />

                    {/* Corner handles with shadows and cursor hints */}
                    {[
                        { x: selectionBoundingBox.minX, y: selectionBoundingBox.minY, cursor: 'nwse-resize', id: 'nw' }, // Top-left
                        { x: selectionBoundingBox.maxX, y: selectionBoundingBox.minY, cursor: 'nesw-resize', id: 'ne' }, // Top-right
                        { x: selectionBoundingBox.maxX, y: selectionBoundingBox.maxY, cursor: 'nwse-resize', id: 'se' }, // Bottom-right
                        { x: selectionBoundingBox.minX, y: selectionBoundingBox.maxY, cursor: 'nesw-resize', id: 'sw' }, // Bottom-left
                    ].map((corner, i) => (
                        <g key={`corner-${i}`} data-resize-handle={corner.id} style={{ pointerEvents: 'auto', cursor: corner.cursor }}>
                            {/* Larger invisible hit area */}
                            <rect
                                x={corner.x - 8}
                                y={corner.y - 8}
                                width={16}
                                height={16}
                                fill="transparent"
                            />
                            {/* Visible handle */}
                            <rect
                                x={corner.x - 5}
                                y={corner.y - 5}
                                width={10}
                                height={10}
                                fill="#0f1419"
                                stroke="#2dd4bf"
                                strokeWidth={1.5}
                                rx={2}
                                filter="url(#handle-shadow)"
                            />
                            {/* Inner dot */}
                            <circle
                                cx={corner.x}
                                cy={corner.y}
                                r={2}
                                fill="#2dd4bf"
                            />
                        </g>
                    ))}

                    {/* Midpoint handles with shadows */}
                    {[
                        { x: selectionBoundingBox.centerX, y: selectionBoundingBox.minY, cursor: 'ns-resize', id: 'n' }, // Top-center
                        { x: selectionBoundingBox.maxX, y: selectionBoundingBox.centerY, cursor: 'ew-resize', id: 'e' }, // Right-center
                        { x: selectionBoundingBox.centerX, y: selectionBoundingBox.maxY, cursor: 'ns-resize', id: 's' }, // Bottom-center
                        { x: selectionBoundingBox.minX, y: selectionBoundingBox.centerY, cursor: 'ew-resize', id: 'w' }, // Left-center
                    ].map((mid, i) => (
                        <g key={`mid-${i}`} data-resize-handle={mid.id} style={{ pointerEvents: 'auto', cursor: mid.cursor }}>
                            {/* Larger invisible hit area */}
                            <rect
                                x={mid.x - 8}
                                y={mid.y - 8}
                                width={16}
                                height={16}
                                fill="transparent"
                            />
                            {/* Visible handle */}
                            <rect
                                x={mid.x - 5}
                                y={mid.y - 5}
                                width={10}
                                height={10}
                                fill="#0f1419"
                                stroke="#2dd4bf"
                                strokeWidth={1.5}
                                rx={2}
                                filter="url(#handle-shadow)"
                            />
                        </g>
                    ))}

                    {/* Task 4.3: Rotation Handle */}
                    {showRotationHandle && (
                        <g data-rotation-handle="true" style={{ pointerEvents: 'auto', cursor: 'grab' }}>
                            {/* Stalk line connecting to selection box. standard convention for visual clarity. */}
                            <line
                                x1={selectionBoundingBox.centerX}
                                y1={selectionBoundingBox.minY - 4}
                                x2={selectionBoundingBox.centerX}
                                y2={selectionBoundingBox.minY - 28}
                                stroke="#2dd4bf"
                                strokeWidth={1.5}
                                strokeDasharray="3,2"
                            />
                            {/* Rotation handle circle. larger hit area handled by svg event bubbling usually, but here just visual. */}
                            <circle
                                cx={selectionBoundingBox.centerX}
                                cy={selectionBoundingBox.minY - 32}
                                r={10}
                                fill="#0f1419"
                                stroke="#2dd4bf"
                                strokeWidth={2}
                                filter="url(#handle-shadow)"
                            />
                            {/* Rotation icon (curved arrow) */}
                            <path
                                d={`M ${selectionBoundingBox.centerX - 4} ${selectionBoundingBox.minY - 35}
                 a 4 4 0 1 1 8 0`}
                                stroke="#2dd4bf"
                                strokeWidth={1.5}
                                fill="none"
                                strokeLinecap="round"
                            />
                            <path
                                d={`M ${selectionBoundingBox.centerX + 4} ${selectionBoundingBox.minY - 35}
                 l 2 -2 l 0 4 z`}
                                fill="#2dd4bf"
                            />
                        </g>
                    )}
                </g>
            </g>
        </svg>
    );
};

export default SelectionOverlay;
