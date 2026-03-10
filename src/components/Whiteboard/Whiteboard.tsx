import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Stage, Layer, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Lock } from 'lucide-react';
import Toolbar, { ActiveTool, EraserMode } from '../Toolbar/Toolbar';
import {
  ToolType,
  BrushType,
  StrokeStyle,
  Shape,
  createRectangle,
  createCircle,
  createEllipse,
  createLine,
  createArrow,
  createTriangle,
  createFrame,
  createImage,
  isRectangle,
  isCircle,
  isEllipse,
  isLine,
  isArrow,
  isTriangle,
  isFrame,
  isImage,
  RectangleShape,
  CircleShape,
  EllipseShape,
  LineShape,
  ArrowShape,
  TriangleShape,
  FrameShape,
  Position,
} from '../../types/shapes';
import SVGShapeRenderer from './SVGShapeRenderer';
import { findNearestAnchorPoint, getAnchorPoints, computeAnchorPosition, AnchorPoint } from '../../utils/connectorUtils';
import { AnchorType } from '../../types/shapes';
import {
  getShapeBoundingBox,
  getTransformedBoundingBox,
  isPointInBoundingBox,
  BoundingBox,
} from '../../utils/boundingBox';
import Konva from 'konva';
import { useSync } from '../../services/useSync';
import { StrokeLine } from '../../services/sync.service';

// -- Extracted modules --
import { TextAnnotation, Action } from './types';
import {
  distSq,
  eraseAtPosition,
  isPointInShape,
  moveForward,
  moveBackward,
  getFontFamilyWithFallback,
  getBrushProperties,
  getStrokeDashArray,
} from './utils';
import FloatingInput from './components/FloatingInput';
import SelectionOverlay from './components/SelectionOverlay';
import EraserCursor from './components/EraserCursor';
import Stroke from './components/Stroke';
import { GridConfig, DEFAULT_GRID_CONFIG } from '../../types/grid';
import GridRenderer from './GridRenderer';
import MiniMap from './components/MiniMap';
import RecenterButton from './components/RecenterButton';
import { UsernameModal } from './components/UsernameModal';
import PresenceBadge from './components/PresenceBadge';
import HamburgerMenu from './components/HamburgerMenu';
import RemoteCursors from './components/RemoteCursors';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSelectionBounds } from './hooks/useSelectionBounds';
import ImageUploadModal from './components/ImageUploadModal';
import ProjectNameEditor from './components/ProjectNameEditor';
import ReplayOverlay from './components/ReplayOverlay';
import * as Y from 'yjs';

// hardcoded sync endpoint. needs env var override for prod.
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

import { useAuth } from '../../contexts';
import { SessionInfo, toggleSessionLock } from '../../services/session.service';

// magical constants.
const DEFAULT_STROKE_COLOR = '#66FCF1';

// Helper functions for capturing the canvas to SVG/PNG
const calculateContentBounds = (shapes: any[], lines: any[], textAnnotations: any[]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasContent = false;
  shapes.forEach((s: any) => {
    if (!s.visible) return;
    const p = s.position;
    if (s.width !== undefined) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + s.width); maxY = Math.max(maxY, p.y + s.height);
    } else if (s.radius !== undefined) {
      minX = Math.min(minX, p.x - s.radius); minY = Math.min(minY, p.y - s.radius);
      maxX = Math.max(maxX, p.x + s.radius); maxY = Math.max(maxY, p.y + s.radius);
    } else if (s.radiusX !== undefined) {
      minX = Math.min(minX, p.x - s.radiusX); minY = Math.min(minY, p.y - s.radiusY);
      maxX = Math.max(maxX, p.x + s.radiusX); maxY = Math.max(maxY, p.y + s.radiusY);
    } else if (s.startPoint) {
      minX = Math.min(minX, s.startPoint.x, s.endPoint.x); minY = Math.min(minY, s.startPoint.y, s.endPoint.y);
      maxX = Math.max(maxX, s.startPoint.x, s.endPoint.x); maxY = Math.max(maxY, s.startPoint.y, s.endPoint.y);
    } else if (s.points) {
      s.points.forEach((pt: any) => {
        minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
      });
    }
    hasContent = true;
  });
  lines.forEach((l: any) => {
    const pts = l.points;
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]); minY = Math.min(minY, pts[i + 1]);
      maxX = Math.max(maxX, pts[i]); maxY = Math.max(maxY, pts[i + 1]);
    }
    if (pts.length >= 2) hasContent = true;
  });
  textAnnotations.forEach((t: any) => {
    const tw = t.text.length * (t.fontSize || 18) * 0.6;
    const th = (t.fontSize || 18) * 1.2;
    minX = Math.min(minX, t.x); minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + tw); maxY = Math.max(maxY, t.y + th);
    hasContent = true;
  });
  return { minX, minY, maxX, maxY, hasContent };
};

const generateSvgContent = (shapes: any[], lines: any[], textAnnotations: any[], bg: string, w: number, h: number, offX: number, offY: number) => {
  let svg = `<svg width="${w}" height="${h}" viewBox="${offX} ${offY} ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<defs><marker id="ah" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#66FCF1"/></marker></defs>`;
  svg += `<rect x="${offX}" y="${offY}" width="${w}" height="${h}" fill="${bg}"/>`;

  [...shapes].sort((a, b) => a.zIndex - b.zIndex).forEach(shape => {
    if (!shape.visible) return;
    const { position, transform: t, opacity, style } = shape;
    const fill = style.hasFill ? style.fill : 'none';
    const stroke = style.stroke;
    const sw = style.strokeWidth;
    let inner = '', tr = '', cx = position.x, cy = position.y;

    if (shape.type === 'rectangle') {
      const s = shape as any;
      cx = position.x + s.width / 2; cy = position.y + s.height / 2;
      tr = `translate(${cx},${cy}) rotate(${t.rotation}) scale(${t.scaleX},${t.scaleY}) translate(${-s.width / 2},${-s.height / 2})`;
      inner = `<rect width="${s.width}" height="${s.height}" rx="${s.cornerRadius || 0}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    } else if (shape.type === 'circle') {
      const s = shape as any;
      tr = `translate(${cx},${cy}) rotate(${t.rotation}) scale(${t.scaleX},${t.scaleY})`;
      inner = `<circle r="${s.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    } else if (shape.type === 'ellipse') {
      const s = shape as any;
      tr = `translate(${cx},${cy}) rotate(${t.rotation}) scale(${t.scaleX},${t.scaleY})`;
      inner = `<ellipse rx="${s.radiusX}" ry="${s.radiusY}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    } else if (shape.type === 'line' || shape.type === 'arrow') {
      const s = shape as any;
      const dx = s.endPoint.x - s.startPoint.x, dy = s.endPoint.y - s.startPoint.y;
      cx = s.startPoint.x + dx / 2; cy = s.startPoint.y + dy / 2;
      tr = `translate(${cx},${cy}) rotate(${t.rotation})`;
      const marker = shape.type === 'arrow' ? ' marker-end="url(#ah)"' : '';
      const cpX = (s.controlPoint?.x ?? cx) - cx;
      const cpY = (s.controlPoint?.y ?? cy) - cy;
      const pathData = `M ${-dx / 2} ${-dy / 2} Q ${cpX} ${cpY} ${dx / 2} ${dy / 2}`;
      inner = `<path d="${pathData}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"${marker}/>`;
    } else if (shape.type === 'triangle') {
      const s = shape as any;
      cx = (s.points[0].x + s.points[1].x + s.points[2].x) / 3; cy = (s.points[0].y + s.points[1].y + s.points[2].y) / 3;
      const pts = s.points.map((p: any) => `${p.x - cx},${p.y - cy}`).join(' ');
      tr = `translate(${cx},${cy}) rotate(${t.rotation}) scale(${t.scaleX},${t.scaleY})`;
      inner = `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    } else if (shape.type === 'image') {
      const s = shape as any;
      cx = position.x + s.width / 2; cy = position.y + s.height / 2;
      tr = `translate(${cx},${cy}) rotate(${t.rotation}) scale(${t.scaleX},${t.scaleY}) translate(${-s.width / 2},${-s.height / 2})`;
      inner = `<image href="${s.src}" width="${s.width}" height="${s.height}" preserveAspectRatio="none"/>`;
    }
    if (inner && tr) svg += `<g transform="${tr}" opacity="${opacity}">${inner}</g>`;
  });

  lines.forEach((line: any) => {
    const pts = line.points;
    if (pts.length < 2) return;
    let d = `M ${pts[0]} ${pts[1]}`;
    for (let i = 2; i < pts.length; i += 2) d += ` L ${pts[i]} ${pts[i + 1]}`;
    svg += `<path d="${d}" stroke="${line.color}" stroke-width="${line.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  });

  textAnnotations.forEach((txt: any) => {
    const escaped = txt.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    let anchor = 'start';
    if (txt.textAlign === 'center') anchor = 'middle';
    else if (txt.textAlign === 'right') anchor = 'end';
    svg += `<text x="${txt.x}" y="${txt.y}" transform="rotate(${txt.rotation || 0},${txt.x},${txt.y})" font-family="${txt.fontFamily}" font-size="${txt.fontSize}" fill="${txt.color}" font-weight="${txt.fontWeight}" font-style="${txt.fontStyle}" text-decoration="${txt.textDecoration}" dominant-baseline="hanging" text-anchor="${anchor}">${escaped}</text>`;
  });

  svg += `</svg>`;
  return svg;
};

const renderSvgToBlob = (svg: string, bg: string, w: number, h: number): Promise<Blob | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * 2; canvas.height = h * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(resolve, 'image/png');
      } else resolve(null);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
};

// Monolithic whiteboard component. needs splitting up.
export default function Whiteboard({
  initialLocked = false,
  sessionInfo
}: {
  initialLocked?: boolean;
  sessionInfo?: SessionInfo | null;
}) {
  const { id: boardId } = useParams<{ id: string }>();
  const roomId = boardId || 'default-room';

  const { user } = useAuth();

  // Checking local storage fallback due to missing backend session ownership logic
  const ownedBoards = (() => {
    try { return JSON.parse(localStorage.getItem('novasketch_owned_boards') || '[]'); }
    catch { return []; }
  })();
  const isOwner = (user?.id === sessionInfo?.createdBy) || ownedBoards.includes(roomId);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Track username - null means modal is shown
  const [userName, setUserName] = useState<string | null>(
    () => localStorage.getItem('novasketch_userName')
  );

  // Guest Assignment Toast State
  const [guestToastMessage, setGuestToastMessage] = useState<string | null>(null);

  // Assign Guests Modal State
  const [isAssignGuestsModalOpen, setIsAssignGuestsModalOpen] = useState(false);
  const [assignGuestsFrameId, setAssignGuestsFrameId] = useState<string | null>(null);

  // Assign a unique color based on the username so each
  // collaborator always gets a distinct cursor/avatar color.
  const [userColor] = useState<string>(() => {
    // Expanded palette with 16 visually distinct colors
    const PALETTE = [
      '#3B82F6', '#EC4899', '#10B981', '#F59E0B',
      '#8B5CF6', '#EF4444', '#06B6D4', '#F97316',
      '#14B8A6', '#E879F9', '#84CC16', '#FB923C',
      '#6366F1', '#F43F5E', '#22D3EE', '#A3E635',
    ];
    // Use a simple hash of the username to deterministically pick a color
    const name = localStorage.getItem('novasketch_userName') || 'Anonymous';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = Math.trunc((hash << 5) - hash + (name.codePointAt(i) || 0));
    }
    const color = PALETTE[Math.abs(hash) % PALETTE.length];
    localStorage.setItem('novasketch_userColor', color);
    return color;
  });

  // Task 1.3.3-A: Compose the user metadata object (name + color)
  const userMetadata = useMemo(() => ({
    name: userName ?? 'Anonymous',
    color: userColor,
  }), [userName, userColor]);

  // Theme settings
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('novasketch-theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('novasketch-theme', theme);
  }, [theme]);

  // syncing everything with yjs.
  // this hook does all the heavy lifting for real-time collab.
  const {
    lines,
    shapes,
    textAnnotations,
    isConnected,
    isLoading: isLoadingCanvas,
    addLine,
    setLines: syncSetLines,
    setShapes: syncSetShapes,
    setTexts: syncSetTexts,
    undo: performUndo,
    redo: performRedo,
    canUndo,
    canRedo,
    clearAll,
    canvasBackgroundColor,
    setCanvasBackgroundColor,
    users,
    updateUserMetadata,
    updateCursorPosition,
    isLocked,
    setIsLocked,
    setSessionLocked,
    batch,
    hasPendingChanges,
    groupIntoFrame,
    ungroupFrame,
    updateShape,
  } = useSync({ roomId, wsUrl: WS_URL, initialLocked });

  // Task 1.5 fix: Owner should NEVER be locked. Only guests see the lock.
  const isEffectivelyLocked = isLocked && !isOwner;

  // Draggable Lock Session badge position

  // Task 1.3.3-B: Broadcast our identity to collaborators as soon as we connect
  useEffect(() => {
    if (isConnected && userName) {
      updateUserMetadata({ ...userMetadata, id: user?.id || 'anonymous' });
    }
  }, [isConnected, userName, userMetadata, updateUserMetadata, user?.id]);

  // local ref to avoid staleness in event handlers.
  // local ref to avoid staleness in event handlers.

  useEffect(() => {
    console.log('[AWARENESS] Connected users in room:', users);
  }, [users]);

  useEffect(() => {
    // Keep the board's isCollab flag in sync with the current participant count.
    // Promotes personal boards to collaborative when others join, and reverts when they leave.
    if (typeof window === 'undefined') return;
    try {
      const boards = JSON.parse(localStorage.getItem('novasketch_boards') || '[]');
      const idx = boards.findIndex((b: any) => b.sessionId === roomId);
      if (idx >= 0) {
        const nowCollab = users.length > 1;
        if (boards[idx].isCollab !== nowCollab) {
          boards[idx].isCollab = nowCollab;
          localStorage.setItem('novasketch_boards', JSON.stringify(boards));
        }
      }
    } catch { /* ignore */ }
  }, [users.length, roomId]);
  // Task 6: Save local thumbnail for Dashboard history
  useEffect(() => {
    if (isLoadingCanvas) return;
    const saveThumbnail = () => {
      try {
        const bg = canvasBackgroundColor || (theme === 'light' ? '#F7F9FC' : '#121212');
        const s = shapesRef.current;
        const l = linesRef.current;
        const t = textAnnotationsRef.current;

        const { minX, minY, maxX, maxY, hasContent } = calculateContentBounds(s, l, t);
        if (!hasContent) return;

        const PAD = 40;
        const offX = minX - PAD;
        const offY = minY - PAD;
        const w = Math.max((maxX - minX) + PAD * 2, 200);
        const h = Math.max((maxY - minY) + PAD * 2, 200);

        const svg = generateSvgContent(s, l, t, bg, w, h, offX, offY);
        const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
        localStorage.setItem(`novasketch_thumbnail_${roomId}`, dataUrl);
      } catch (e) {
        console.warn('Failed to capture thumbnail', e);
      }
    };
    // Save once after a short delay
    const initialT = setTimeout(saveThumbnail, 3000);
    // Then every 10 seconds
    const interval = setInterval(saveThumbnail, 10000);

    return () => {
      clearTimeout(initialT);
      clearInterval(interval);
      saveThumbnail(); // Try to save on unmount
    };
  }, [roomId, isLoadingCanvas, theme, canvasBackgroundColor]);

  const linesRef = useRef(lines);
  const shapesRef = useRef(shapes);
  const textAnnotationsRef = useRef(textAnnotations);

  // Throttle cursor broadcasts to ~20 updates/sec (every 50ms)
  const lastCursorBroadcastRef = useRef(0);

  // Sync refs during render so event handlers always read the latest state
  linesRef.current = lines;
  shapesRef.current = shapes;
  textAnnotationsRef.current = textAnnotations;

  // Optimistic UI Local Rendering
  // Temporarily hold newly drawn lines to render locally before sending via WS
  const [optimisticLine, setOptimisticLine] = useState<StrokeLine | null>(null);
  const optimisticLineRef = useRef<StrokeLine | null>(null);

  // Monitor incoming shapes to trigger "Assigned as Guest" toasts
  const previousShapesRef = useRef(shapes);
  useEffect(() => {
    if (!user?.id) return;

    // Find frames that were updated
    const newFrames = shapes.filter(s => s.type === 'frame');
    const oldFrames = previousShapesRef.current.filter(s => s.type === 'frame');

    newFrames.forEach(nFrame => {
      const oFrame = oldFrames.find(o => o.id === nFrame.id);

      // If I am newly added to the assignedUserIds array AND I am not the owner
      const wasAssigned = oFrame?.assignedUserIds?.includes(user.id) || false;
      const isAssigned = nFrame.assignedUserIds?.includes(user.id) || false;

      if (!wasAssigned && isAssigned && nFrame.ownerId !== user.id) {
        // Trigger toast
        setGuestToastMessage(`You have been assigned to ${nFrame.name || 'a Frame'}`);
        setTimeout(() => setGuestToastMessage(null), 4000);
      }
    });

    previousShapesRef.current = shapes;
  }, [shapes, user?.id]);

  // Snapshot for Eraser Diffing
  const [initialEraserLines, setInitialEraserLines] = useState<StrokeLine[] | null>(null);

  // legacy adaptors. hijacking state setters to route through yjs sync engine.
  const setLines = useCallback((updater: StrokeLine[] | ((prev: StrokeLine[]) => StrokeLine[])) => {
    if (typeof updater === 'function') {
      const newLines = updater(linesRef.current);
      syncSetLines(newLines);
      linesRef.current = newLines; // ensure immediate reads see changes within the same event
    } else {
      syncSetLines(updater);
      linesRef.current = updater;
    }
  }, [syncSetLines]);

  const setShapes = useCallback((updater: Shape[] | ((prev: Shape[]) => Shape[])) => {
    if (typeof updater === 'function') {
      const newShapes = updater(shapesRef.current);
      syncSetShapes(newShapes);
      // eslint-disable-next-line react-hooks/immutability
      shapesRef.current = newShapes;
    } else {
      syncSetShapes(updater);
      shapesRef.current = updater;
    }
  }, [syncSetShapes]);

  const setTextAnnotations = useCallback((updater: TextAnnotation[] | ((prev: TextAnnotation[]) => TextAnnotation[])) => {
    if (typeof updater === 'function') {
      const newTexts = updater(textAnnotationsRef.current);
      syncSetTexts(newTexts);
      // eslint-disable-next-line react-hooks/immutability
      textAnnotationsRef.current = newTexts;
    } else {
      syncSetTexts(updater);
      textAnnotationsRef.current = updater;
    }
  }, [syncSetTexts]);

  // yjs handles history internally via UndoManager.
  // keeping this no-op signature to avoid breaking legacy calls scattered in event handlers.
  // TODO: refactor all callsites to use syncService directly and remove this shim.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addToHistory = useCallback((_action: Action) => {
    // no-op.
  }, []);

  // -- 2. INTERACTION STATE --
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  // Grid Config (Task 5.5)
  const [gridConfig, setGridConfig] = useState<GridConfig>(DEFAULT_GRID_CONFIG);
  const [snapGuides, setSnapGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [snapPointIndicators, setSnapPointIndicators] = useState<{ x: number; y: number }[]>([]);

  // Initialize tool state
  const [activeTool, setActiveTool] = useState<ActiveTool>('select'); // Default to select

  // Line & Arrow Styles
  const [currentLineType, setCurrentLineType] = useState<'straight' | 'curved' | 'stepped'>('curved');
  const [currentArrowAtStart, setCurrentArrowAtStart] = useState<boolean>(false);
  const [currentArrowAtEnd, setCurrentArrowAtEnd] = useState<boolean>(false);

  // Task 1.5.2: If the session locks AND this user is a guest, fall back to Hand tool.
  useEffect(() => {
    if (isEffectivelyLocked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTool(ToolType.HAND);
    }
  }, [isEffectivelyLocked]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isToolLocked, setIsToolLocked] = useState(false); // Lock tool for multiple drawings
  // Task 4.2.1: State for calculating drag delta
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const lastPointerPosRef = useRef<Position | null>(null);
  const [isHoveringSelection, setIsHoveringSelection] = useState(false); // Task 4.2.4: Track hover for cursor
  const dragStartRef = useRef<Position | null>(null);

  // Resizing State
  const [isResizing, setIsResizing] = useState(false);

  // Track which frame the user has "entered" (double-click is edit mode).
  // When activeFrameId is set, findElementAtPoint returns individual children of that frame
  // instead of always returning the frame itself.
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [initialResizeState, setInitialResizeState] = useState<{
    box: BoundingBox;
    shapes: Map<string, Shape>;
    lines: Map<string, StrokeLine>;
    texts: Map<string, TextAnnotation>;
  } | null>(null);

  // Rotation State
  const [isRotating, setIsRotating] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState<number>(0);
  const [initialShapeRotations, setInitialShapeRotations] = useState<Map<string, number>>(new Map());
  // Task 4.3: Store initial positions for group rotation
  const [initialShapePositions, setInitialShapePositions] = useState<Map<string, Position>>(new Map());
  const [initialShapePoints, setInitialShapePoints] = useState<Map<string, Position[]>>(new Map()); // For lines/tris
  const [selectionCenter, setSelectionCenter] = useState<Position | null>(null);
  const [initialSelectionBoundingBox, setInitialSelectionBoundingBox] = useState<BoundingBox | null>(null);
  const [currentGroupRotation, setCurrentGroupRotation] = useState<number>(0);
  const [selectionRotation, setSelectionRotation] = useState<number>(0);

  // Shape Creation
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [previewShape, setPreviewShape] = useState<Shape | null>(null);

  // Smart Connectors: snap state while drawing a line/arrow
  const [connectorSnapState, setConnectorSnapState] = useState<{
    start?: { shapeId: string; anchorType: AnchorType; position: Position };
    end?: { shapeId: string; anchorType: AnchorType; position: Position };
  } | null>(null);
  const [connectorAnchorOverlays, setConnectorAnchorOverlays] = useState<{ shape: Shape; anchors: AnchorPoint[] }[]>([]);

  // Dragging State Snapshot (for History)
  const [initialDragState, setInitialDragState] = useState<{
    box?: BoundingBox;
    shapes: Map<string, Shape>;
    lines: Map<string, StrokeLine>;
    texts: Map<string, TextAnnotation>;
  } | null>(null);

  // Selection State (Task 4.1) - Track all selected items
  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set());
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [selectedTextIds, setSelectedTextIds] = useState<Set<string>>(new Set());
  // selectionBoundingBox computed by useSelectionBounds hook
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Image Upload Modal
  const [showImageUpload, setShowImageUpload] = useState(false);

  // Timeline Replay
  const [showReplay, setShowReplay] = useState(false);

  // Arrow Bending State
  const [isBendingArrow, setIsBendingArrow] = useState<string | null>(null);
  const [isEditingArrowEnd, setIsEditingArrowEnd] = useState<{ id: string, end: 'start' | 'end' } | null>(null);

  // Reset selection rotation and initial states when selection changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectionRotation(0);
    setInitialShapeRotations(new Map());
    setInitialShapePositions(new Map());
    setInitialShapePoints(new Map());
  }, [selectedShapeIds, selectedLineIds, selectedTextIds]);

  // UI State

  // Helper to assign newly drawn elements to a frame if drawn inside it
  const getTargetFrame = useCallback((x: number, y: number) => {
    const allFrames = shapes.filter(s => s.type === 'frame').sort((a, b) => b.zIndex - a.zIndex);
    for (const frame of allFrames) {
      if (isPointInShape(frame, x, y, 0)) {
        const f = frame as any;
        if (f.ownerId === user?.id || f.assignedUserIds?.includes(user?.id || '')) {
          return frame;
        }
      }
    }
    return null;
  }, [shapes, user?.id]);

  // Epic 7.6.4: Helper to check if selection can be modified based on frame permissions
  const canModifySelection = useCallback(() => {
    const selectedShapes = shapes.filter(s => selectedShapeIds.has(s.id));
    const selectedLines = lines.filter(l => selectedLineIds.has(l.id));
    const selectedTexts = textAnnotations.filter(t => selectedTextIds.has(t.id));

    if (selectedShapes.length === 0 && selectedLines.length === 0 && selectedTexts.length === 0) return true;

    // Check shapes and frames
    for (const shape of selectedShapes) {
      if (shape.type === 'frame') {
        const frame = shape as any;
        if (frame.ownerId !== user?.id && !frame.assignedUserIds?.includes(user?.id || '')) return false;
      }
      if (shape.parentId) {
        const parentFrame = shapes.find(s => s.id === shape.parentId) as any;
        if (parentFrame && parentFrame.ownerId !== user?.id && !parentFrame.assignedUserIds?.includes(user?.id || '')) return false;
      }
    }

    // Check lines inside frames
    for (const line of selectedLines) {
      if (line.parentId) {
        const parentFrame = shapes.find(s => s.id === line.parentId) as any;
        if (parentFrame && parentFrame.ownerId !== user?.id && !parentFrame.assignedUserIds?.includes(user?.id || '')) return false;
      }
    }

    // Check texts inside frames
    for (const text of selectedTexts) {
      if (text.parentId) {
        const parentFrame = shapes.find(s => s.id === text.parentId) as any;
        if (parentFrame && parentFrame.ownerId !== user?.id && !parentFrame.assignedUserIds?.includes(user?.id || '')) return false;
      }
    }

    return true;
  }, [shapes, lines, textAnnotations, selectedShapeIds, selectedLineIds, selectedTextIds, user?.id]);
  const [activeTextInput, setActiveTextInput] = useState<{ x: number, y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState(''); // Hoisted state
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // -- 3. STYLE STATE --
  const [brushSize, setBrushSize] = useState(3);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [fillColor, setFillColor] = useState('transparent');
  const [cornerRadius, setCornerRadius] = useState(0); // For rounded corners
  const [eraserSize, setEraserSize] = useState(20);
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [brushType, setBrushType] = useState<BrushType>(BrushType.BRUSH);
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>('solid');
  // const [canvasBackgroundColor, setCanvasBackgroundColor] = useState('#0B0C10'); // Managed by useSync now

  const [fontStyles, setFontStyles] = useState({
    family: 'Arial', // Default to Arial (system font)
    size: 18, // Default to M preset
    bold: false,
    italic: false,

    underline: false,
    textAlign: 'left' as 'left' | 'center' | 'right'
  });


  const [isStageDragging, setIsStageDragging] = useState(false);

  // Task 5.4.2 + 5.4.3: Animate Viewport Offset back to (0,0) and Zoom to 100%
  const recenterAnimRef = useRef<number | null>(null);

  const handleRecenter = useCallback(() => {
    // Cancel any in-flight recenter animation
    if (recenterAnimRef.current !== null) {
      cancelAnimationFrame(recenterAnimRef.current);
      recenterAnimRef.current = null;
    }

    const DURATION = 400; // ms
    const startX = stagePos.x;
    const startY = stagePos.y;
    const startScale = stageScale;
    const startTime = performance.now();

    // easeOutCubic for a natural deceleration feel
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = ease(progress);

      // Animate pan back to origin
      setStagePos({
        x: startX + (0 - startX) * eased,
        y: startY + (0 - startY) * eased,
      });

      // Task 5.4.3: Animate zoom back to 100%
      setStageScale(startScale + (1 - startScale) * eased);

      if (progress < 1) {
        recenterAnimRef.current = requestAnimationFrame(animate);
      } else {
        recenterAnimRef.current = null;
      }
    };

    recenterAnimRef.current = requestAnimationFrame(animate);
  }, [stagePos, stageScale]);

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent browser back/forward navigation via two-finger horizontal swipe.
  // Must use native listener with passive:false as React's onWheel can't call preventDefault.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventNavGesture = (e: WheelEvent) => {
      // Block browser zoom (Ctrl+Scroll / pinch) and horizontal swipe navigation
      if (e.ctrlKey || Math.abs(e.deltaX) > 0) {
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', preventNavGesture, { passive: false });
    return () => el.removeEventListener('wheel', preventNavGesture);
  }, []);

  // Spacebar Panning Mode Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !activeTextInput) {
        setIsPanning(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsPanning(false);
        setIsStageDragging(false); // Stop dragging if space released
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTextInput]);

  // NOTE: Canvas loading and saving is now handled automatically by the SyncService
  // via Yjs + WebSocket (for MongoDB persistence) and IndexedDB (for offline support)


  // Keyboard shortcuts extracted to hook
  useKeyboardShortcuts({
    shapes,
    lines,
    textAnnotations,
    selectedShapeIds,
    selectedLineIds,
    selectedTextIds,
    activeTextInput,
    activeTool,
    setSelectedShapeIds,
    setSelectedLineIds,
    setSelectedTextIds,
    setActiveTextInput,
    setActiveTool,
    setShapes,
    setLines,
    setTextAnnotations,
    addToHistory,
    performUndo,
    performRedo,
    isLocked: isEffectivelyLocked,
  });

  // Task 5.2: Keyboard Zoom Shortcuts (Ctrl+= / Ctrl+- / Ctrl+0)
  useEffect(() => {
    const handleZoomKeys = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      const MIN_SCALE = 0.1;
      const MAX_SCALE = 5;
      const ZOOM_STEP = 0.1;

      let newScale: number | null = null;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        newScale = Math.min(MAX_SCALE, stageScale + ZOOM_STEP);
      } else if (e.key === '-') {
        e.preventDefault();
        newScale = Math.max(MIN_SCALE, stageScale - ZOOM_STEP);
      } else if (e.key === '0') {
        e.preventDefault();
        newScale = 1;
      }

      if (newScale !== null && newScale !== stageScale) {
        // Zoom toward screen center
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        const worldX = (centerX - stagePos.x) / stageScale;
        const worldY = (centerY - stagePos.y) / stageScale;
        setStagePos({
          x: centerX - worldX * newScale,
          y: centerY - worldY * newScale,
        });
        setStageScale(newScale);
      }
    };

    window.addEventListener('keydown', handleZoomKeys);
    return () => window.removeEventListener('keydown', handleZoomKeys);
  }, [stageScale, stagePos, dimensions]);

  // -- 4a. SNAP HELPERS --
  // Snaps a shape's geometry anchor to the nearest grid point.
  // For rects/triangles: snaps position (top-left).
  // For circles/ellipses: snaps center (position).
  // For lines/arrows: snaps both startPoint and endPoint.
  const snapShapeToGrid = useCallback((shape: Shape): Shape => {
    if (!gridConfig.snapEnabled || gridConfig.snapType === 'none') return shape;
    const size = gridConfig.size;
    const snapType = gridConfig.snapType;
    const canSnapX = ['all', 'vertical_lines', 'lines', 'points'].includes(snapType);
    const canSnapY = ['all', 'horizontal_lines', 'lines', 'points'].includes(snapType);
    const snapVal = (v: number) => Math.round(v / size) * size;
    const sx = (v: number) => canSnapX ? snapVal(v) : v;
    const sy = (v: number) => canSnapY ? snapVal(v) : v;

    if (isRectangle(shape)) {
      return { ...shape, position: { x: sx(shape.position.x), y: sy(shape.position.y) } };
    } else if (isCircle(shape)) {
      return { ...shape, position: { x: sx(shape.position.x), y: sy(shape.position.y) } };
    } else if (isEllipse(shape)) {
      return { ...shape, position: { x: sx(shape.position.x), y: sy(shape.position.y) } };
    } else if (isLine(shape)) {
      const ls = shape as LineShape;
      const snappedStart = { x: sx(ls.startPoint.x), y: sy(ls.startPoint.y) };
      const snappedEnd = { x: sx(ls.endPoint.x), y: sy(ls.endPoint.y) };
      return { ...shape, position: snappedStart, startPoint: snappedStart, endPoint: snappedEnd } as LineShape;
    } else if (isArrow(shape)) {
      const as_ = shape as ArrowShape;
      const snappedStart = { x: sx(as_.startPoint.x), y: sy(as_.startPoint.y) };
      const snappedEnd = { x: sx(as_.endPoint.x), y: sy(as_.endPoint.y) };
      return { ...shape, position: snappedStart, startPoint: snappedStart, endPoint: snappedEnd } as ArrowShape;
    } else if (isTriangle(shape)) {
      const ts = shape as TriangleShape;
      const dx = sx(ts.position.x) - ts.position.x;
      const dy = sy(ts.position.y) - ts.position.y;
      return {
        ...shape,
        position: { x: ts.position.x + dx, y: ts.position.y + dy },
        points: ts.points.map(p => ({ x: p.x + dx, y: p.y + dy })) as [Position, Position, Position],
      } as TriangleShape;
    }
    return shape;
  }, [gridConfig.snapEnabled, gridConfig.size, gridConfig.snapType]);

  // -- 4. HELPERS --
  const getPointerPos = (e: any) => {
    // Try to get perfect coordinates from Konva's stage transform inversion
    if (stageRef.current) {
      const stage = stageRef.current;
      const pos = stage.getPointerPosition();
      if (pos) {
        const transform = stage.getAbsoluteTransform().copy().invert();
        return transform.point(pos);
      }
    }

    // fallback: robustly get client coordinates
    const nativeEvent = e.nativeEvent || e;
    const clientX = e.clientX ?? nativeEvent.clientX ?? e.evt?.clientX;
    const clientY = e.clientY ?? nativeEvent.clientY ?? e.evt?.clientY;

    if (containerRef.current && typeof clientX === 'number' && typeof clientY === 'number') {
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      // Convert Screen to Virtual: (Screen - Pan) / Scale
      return {
        x: (screenX - stagePos.x) / stageScale,
        y: (screenY - stagePos.y) / stageScale
      };
    }

    // Fallback should rarely handle active interactions
    return { x: 0, y: 0 };
  };

  // isPointInShape is imported from ./utils (eraserUtils)

  // Hit test for selection: find item (text, line, shape) at clicked point
  function findElementAtPoint(x: number, y: number): { id: string; type: 'shape' | 'line' | 'text' } | null {
    function getGlobalTransform(parentId: string | undefined): { x: number, y: number, sx: number, sy: number } {
      const m = { x: 0, y: 0, sx: 1, sy: 1 };
      let curr = parentId;
      const path: Shape[] = [];
      for (let depth = 0; depth < 5 && curr; depth++) {
        const p = shapes.find(sh => sh.id === curr);
        if (p) {
          path.unshift(p);
          curr = p.parentId;
        } else break;
      }
      for (const p of path) {
        m.x += p.position.x * m.sx;
        m.y += p.position.y * m.sy;
        m.sx *= p.transform.scaleX || 1;
        m.sy *= p.transform.scaleY || 1;
      }
      return m;
    }

    // 1. Text (Top Layer)
    for (let i = textAnnotations.length - 1; i >= 0; i--) {
      const t = textAnnotations[i];
      const w = t.text.length * (t.fontSize * 0.6);
      const h = t.fontSize * 1.2;
      const m = getGlobalTransform(t.parentId);
      const tx = (x - m.x) / m.sx;
      const ty = (y - m.y) / m.sy;

      if (tx >= t.x && tx <= t.x + w && ty >= t.y && ty <= t.y + h) {
        // If this text lives in the currently active (entered) frame,
        // return the text itself so the user can select/edit it directly.
        if (t.parentId && t.parentId !== activeFrameId) return { id: t.parentId, type: 'shape' };
        return { id: t.id, type: 'text' };
      }
    }

    // 2. Lines (Middle Layer)
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let j = 0; j < l.points.length; j += 2) {
        minX = Math.min(minX, l.points[j]);
        minY = Math.min(minY, l.points[j + 1]);
        maxX = Math.max(maxX, l.points[j]);
        maxY = Math.max(maxY, l.points[j + 1]);
      }
      const buf = (l.strokeWidth || 5) / 2 + 5;
      const m = getGlobalTransform(l.parentId);
      const tx = (x - m.x) / m.sx;
      const ty = (y - m.y) / m.sy;

      if (tx >= minX - buf && tx <= maxX + buf && ty >= minY - buf && ty <= maxY + buf) {
        // If this freehand line lives in the currently active frame,
        // return it directly so the user can select/edit it.
        if (l.parentId && l.parentId !== activeFrameId) return { id: l.parentId, type: 'shape' };
        return { id: l.id, type: 'line' };
      }
    }

    // 3. Shapes
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      const m = getGlobalTransform(s.parentId);
      const tx = (x - m.x) / m.sx;
      const ty = (y - m.y) / m.sy;

      if (isPointInShape(s, tx, ty, 5 / Math.max(m.sx, m.sy))) {
        // Clicking a child selects the parent Frame.
        // If the child belongs to the currently active (entered) frame,
        // return the child directly so the user can individually select/drag it.
        if (s.parentId) {
          if (s.parentId === activeFrameId) return { id: s.id, type: 'shape' };
          // Find the top-level parent (Frame)
          let currentParentId = s.parentId;
          for (let depth = 0; depth < 5; depth++) {
            const parent = shapes.find(sh => sh.id === currentParentId);
            if (!parent?.parentId) break;
            currentParentId = parent.parentId;
          }
          return { id: currentParentId, type: 'shape' };
        }
        return { id: s.id, type: 'shape' };
      }
    }
    return null;
  }

  // Selection bounding box computed by hook
  const selectionBoundingBox = useSelectionBounds({
    selectedShapeIds,
    selectedLineIds,
    selectedTextIds,
    shapes,
    lines,
    textAnnotations,
  });

  // Synchronize Toolbar with Text Selection
  useEffect(() => {
    if (selectedTextIds.size === 1) {
      const textId = Array.from(selectedTextIds)[0];
      const text = textAnnotations.find(t => t.id === textId);
      if (text) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFontStyles(prev => ({
          ...prev,
          family: text.fontFamily,
          size: text.fontSize,
          bold: text.fontWeight === 'bold',
          italic: text.fontStyle === 'italic',
          underline: text.textDecoration === 'underline',
          textAlign: text.textAlign || 'left'
        }));
        setStrokeColor(text.color);
      }
    }
  }, [selectedTextIds, textAnnotations]);

  // Synchronize Toolbar with Shape Selection (Property Reflection)
  useEffect(() => {
    if (selectedShapeIds.size === 1 && selectedTextIds.size === 0 && selectedLineIds.size === 0) {
      const shapeId = Array.from(selectedShapeIds)[0];
      const shape = shapes.find(s => s.id === shapeId);
      if (shape) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStrokeColor(shape.style.stroke);
        setFillColor(shape.style.hasFill ? shape.style.fill : '#45A29E');
        setBrushSize(shape.style.strokeWidth);
      }
    }
  }, [selectedShapeIds, shapes, selectedTextIds, selectedLineIds]);

  // Synchronize Toolbar with Line Selection (Property Reflection)
  useEffect(() => {
    if (selectedLineIds.size === 1 && selectedShapeIds.size === 0 && selectedTextIds.size === 0) {
      const lineId = Array.from(selectedLineIds)[0];
      const line = lines.find(l => l.id === lineId);
      if (line) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStrokeColor(line.color);
        setBrushSize(line.strokeWidth);
      }
    }
  }, [selectedLineIds, lines, selectedShapeIds, selectedTextIds]);
  // getBrushProperties and getStrokeDashArray are now imported from ./utils/brushUtils

  const performErase = (x: number, y: number) => {

    // 1. Lines
    // Vector erasure is computationally expensive as it requires splitting paths.
    // We detect intersection points and slice the line segments accordingly.
    if (eraserMode === 'stroke') {

      const currentLines = linesRef.current;
      // Find lines that would be removed
      const linesHit = currentLines.filter(l => {
        for (let i = 0; i < l.points.length; i += 2) {
          if (distSq({ x: l.points[i], y: l.points[i + 1] }, { x, y }) < eraserSize ** 2) {
            return true;
          }
        }
        return false;
      });

      if (linesHit.length > 0) {
        // Record History
        linesHit.forEach(l => {
          const index = currentLines.findIndex(cl => cl.id === l.id);
          console.log('[Eraser] Deleting Line:', l.id, 'Index:', index);
          addToHistory({
            type: 'DELETE',
            objectType: 'line',
            id: l.id,
            previousState: l,
            newState: null,
            userId: 'local',
            index
          });
        });

        // Update State
        const newLines = currentLines.filter(l => !linesHit.some(hit => hit.id === l.id));
        setLines(newLines);
        // Sync ref immediately to ensure PointerUp sees latest state for partial logic usage elsewhere (consistency)
        linesRef.current = newLines;
      }
    } else {
      // Partial Eraser
      // Calculate new lines using current Ref to ensure we build on latest known state
      // (This avoids functional update delay causing history mismatch)
      const newLines = eraseAtPosition(x, y, linesRef.current, eraserSize);
      setLines(newLines);
      linesRef.current = newLines; // SYNC REF for proper history capture in PointerUp
    }

    // 2. Shapes
    const shapesHit = shapes.filter(s => isPointInShape(s, x, y, eraserSize));
    if (shapesHit.length > 0) {
      shapesHit.forEach(s => {
        console.log('[Eraser] Deleting Shape:', s.id);
        addToHistory({
          type: 'DELETE',
          objectType: 'shape',
          id: s.id,
          previousState: s,
          newState: null,
          userId: 'local'
        });
      });
      setShapes(prev => prev.filter(s => !shapesHit.some(hit => hit.id === s.id)));
    }

    // 3. Text
    const textsHit = textAnnotations.filter(t => {
      // Approximate text hit (top-left anchor)
      const dx = t.x - x;
      const dy = t.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist <= eraserSize + 20; // 20px buffer for text body (INVERSE logic from original filter)
    });

    if (textsHit.length > 0) {
      textsHit.forEach(t => {
        console.log('[Eraser] Deleting Text:', t.id);
        addToHistory({
          type: 'DELETE',
          objectType: 'text',
          id: t.id,
          previousState: t,
          newState: null,
          userId: 'local'
        });
      });
      setTextAnnotations(prev => prev.filter(t => !textsHit.some(hit => hit.id === t.id)));
    }
  };




  // -- Task 4.4: Layer Management --
  const handleBringForward = () => {
    // manipulating local state arrays.
    // layers are strictly separated by type currently (shapes, lines, texts).
    // TODO: implement unified display list to allow interleaving types (e.g. text behind a line).
    let newShapes = shapes;
    let newLines = lines;
    let newTexts = textAnnotations;

    if (selectedShapeIds.size > 0) newShapes = moveForward(shapes, selectedShapeIds);
    if (selectedLineIds.size > 0) newLines = moveForward(lines, selectedLineIds);
    if (selectedTextIds.size > 0) newTexts = moveForward(textAnnotations, selectedTextIds);

    // Task 3.4.2-B: Batch layer reordering
    batch(() => {
      if (newShapes !== shapes) setShapes(newShapes);
      if (newLines !== lines) setLines(newLines);
      if (newTexts !== textAnnotations) setTextAnnotations(newTexts);
    });

    // Task 3: Collaboration Broadcast
    // sending full ID list might be heavy if >1000 items. consider sending only moved indices later.
    if (newShapes !== shapes || newLines !== lines || newTexts !== textAnnotations) {
      console.log('[Broadcast] Layer Reorder:', {
        type: 'LAYER_REORDER',
        shapeOrder: newShapes.map(s => s.id),
        lineOrder: newLines.map(l => l.id),
        textOrder: newTexts.map(t => t.id)
      });
      // socket.emit('layer-update', { ... });
    }
  };

  const handleSendBackward = () => {
    let newShapes = shapes;
    let newLines = lines;
    let newTexts = textAnnotations;

    if (selectedShapeIds.size > 0) newShapes = moveBackward(shapes, selectedShapeIds);
    if (selectedLineIds.size > 0) newLines = moveBackward(lines, selectedLineIds);
    if (selectedTextIds.size > 0) newTexts = moveBackward(textAnnotations, selectedTextIds);

    batch(() => {
      if (newShapes !== shapes) setShapes(newShapes);
      if (newLines !== lines) setLines(newLines);
      if (newTexts !== textAnnotations) setTextAnnotations(newTexts);
    });

    // Task 3: Collaboration Broadcast
    if (newShapes !== shapes || newLines !== lines || newTexts !== textAnnotations) {
      console.log('[Broadcast] Layer Reorder:', {
        type: 'LAYER_REORDER',
        shapeOrder: newShapes.map(s => s.id),
        lineOrder: newLines.map(l => l.id),
        textOrder: newTexts.map(t => t.id)
      });
      // socket.emit('layer-update', { ... });
    }
  };

  // -- Delete Selected Items --
  const handleDeleteSelected = () => {
    const actions: Action[] = [];

    // Task 3.4.2-B: Use batch to compress deletion of multiple items across multiple layers
    batch(() => {
      if (selectedShapeIds.size > 0) {
        shapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
          actions.push({ type: 'DELETE', objectType: 'shape', id: s.id, previousState: s, newState: null, userId: 'local' });
        });
        setShapes(prev => prev.filter(s => !selectedShapeIds.has(s.id)));
      }

      if (selectedLineIds.size > 0) {
        lines.filter(l => selectedLineIds.has(l.id)).forEach(l => {
          actions.push({ type: 'DELETE', objectType: 'line', id: l.id, previousState: l, newState: null, userId: 'local' });
        });
        setLines(prev => prev.filter(l => !selectedLineIds.has(l.id)));
      }

      if (selectedTextIds.size > 0) {
        textAnnotations.filter(t => selectedTextIds.has(t.id)).forEach(t => {
          actions.push({ type: 'DELETE', objectType: 'text', id: t.id, previousState: t, newState: null, userId: 'local' });
        });
        setTextAnnotations(prev => prev.filter(t => !selectedTextIds.has(t.id)));
      }
    });

    if (actions.length > 0) {
      addToHistory({ type: 'BATCH', userId: 'local', actions });
    }

    setSelectedShapeIds(new Set());
    setSelectedLineIds(new Set());
    setSelectedTextIds(new Set());
  };

  // -- 5. ACTION HANDLERS --

  const commitText = () => {
    if (activeTextInput) {
      if (textInputValue.trim()) {
        if (editingTextId) {
          // updating existing text node. simple map replace.
          setTextAnnotations(prev => prev.map(t => {
            if (t.id === editingTextId) {
              const updatedT = {
                ...t,
                text: textInputValue,
                color: strokeColor,
                fontSize: fontStyles.size,
                fontFamily: fontStyles.family,
                fontWeight: fontStyles.bold ? 'bold' : 'normal',
                fontStyle: fontStyles.italic ? 'italic' : 'normal',
                textDecoration: fontStyles.underline ? 'underline' : 'none',
                textAlign: fontStyles.textAlign
              };
              addToHistory({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: updatedT, userId: 'local' });
              return updatedT;
            }
            return t;
          }));
        } else {
          // fresh text node creation.
          let targetX = activeTextInput.x;
          let targetY = activeTextInput.y;
          const targetFrame = getTargetFrame(targetX, targetY);
          let parentId = undefined;

          if (targetFrame) {
            parentId = targetFrame.id;
            targetX -= targetFrame.position.x;
            targetY -= targetFrame.position.y;
          }

          const newTextId = `text-${Date.now()}`;
          const newText = {
            id: newTextId,
            parentId,
            x: targetX,
            y: targetY,
            text: textInputValue,
            color: strokeColor,
            fontSize: fontStyles.size,
            fontFamily: fontStyles.family,
            fontWeight: fontStyles.bold ? 'bold' : 'normal',
            fontStyle: fontStyles.italic ? 'italic' : 'normal',
            textDecoration: fontStyles.underline ? 'underline' : 'none',
            textAlign: fontStyles.textAlign,
            rotation: 0
          };
          setTextAnnotations(prev => [...prev, newText]);
          addToHistory({
            type: 'ADD',
            objectType: 'text',
            id: newTextId,
            previousState: null,
            newState: newText,
            userId: 'local'
          });

          // auto-select the new text to allow immediate moving/resizing.
          // unless user locked the tool to 'text' mode for rapid entry.
          if (!isToolLocked) {
            setActiveTool('select');
            setSelectedTextIds(new Set([newTextId]));
          }
        }
      } else if (editingTextId) {
        // user cleared the input (empty string), interpret this as a delete intent.
        const textToDelete = textAnnotations.find(t => t.id === editingTextId);
        if (textToDelete) {
          setTextAnnotations(prev => prev.filter(t => t.id !== editingTextId));
          addToHistory({ type: 'DELETE', objectType: 'text', id: editingTextId, previousState: textToDelete, newState: null, userId: 'local' });
        }
      }
    }
    // cleanup temp state
    setActiveTextInput(null);
    setTextInputValue('');
    setEditingTextId(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Task 1.5.3: Block text editing when locked (guests only)
    if (isEffectivelyLocked) return;

    const { x, y } = getPointerPos(e);
    const clickedItem = findElementAtPoint(x, y);

    // Double-clicking a frame enters edit mode.
    // Only the frame owner or assigned participants may enter.
    if (clickedItem && clickedItem.type === 'shape') {
      const clickedShape = shapes.find(s => s.id === clickedItem.id);
      if (clickedShape && isFrame(clickedShape)) {
        const frame = clickedShape as FrameShape;
        const hasAccess = (frame as any).ownerId === user?.id ||
          (frame as any).assignedUserIds?.includes(user?.id || '');
        if (hasAccess) {
          setActiveFrameId(frame.id);
          // Clear the frame's own selection so the bounding box disappears.
          // Without this, the next click inside the frame would hit the
          // selection bounding box check in handlePointerDown and enter drag
          // mode instead of calling findElementAtPoint to select the child.
          setSelectedShapeIds(new Set());
          setSelectedLineIds(new Set());
          setSelectedTextIds(new Set());
          // Also check if a text child is directly under the cursor so we can
          // open it for editing in the same gesture (avoids requiring a second double-click).
          const frameRelX = x - frame.position.x;
          const frameRelY = y - frame.position.y;
          const textChild = textAnnotations.find(t => {
            if (t.parentId !== frame.id) return false;
            const w = t.text.length * (t.fontSize * 0.6);
            const h = t.fontSize * 1.2;
            return frameRelX >= t.x && frameRelX <= t.x + w &&
                   frameRelY >= t.y && frameRelY <= t.y + h;
          });
          if (textChild) {
            setEditingTextId(textChild.id);
            setActiveTextInput({
              x: textChild.x + frame.position.x,
              y: textChild.y + frame.position.y,
            });
            setTextInputValue(textChild.text);
            setFontStyles({
              family: textChild.fontFamily,
              size: textChild.fontSize,
              bold: textChild.fontWeight === 'bold',
              italic: textChild.fontStyle === 'italic',
              underline: textChild.textDecoration === 'underline',
              textAlign: textChild.textAlign || 'left' as 'left' | 'center' | 'right'
            });
            setStrokeColor(textChild.color);
          }
        }
        return;
      }
    }

    if (clickedItem && clickedItem.type === 'text') {
      const text = textAnnotations.find(t => t.id === clickedItem.id);
      if (text) {
        // hydrate the modal state with existing text props so they don't reset to defaults.
        setEditingTextId(text.id);
        // text.x/y are frame-relative for frame-child texts.
        // FloatingInput lives inside the CSS-transformed overlay and expects world coords.
        const editParentFrame = text.parentId ? shapes.find(s => s.id === text.parentId) : null;
        const editWorldX = editParentFrame ? text.x + (editParentFrame as any).position.x : text.x;
        const editWorldY = editParentFrame ? text.y + (editParentFrame as any).position.y : text.y;
        setActiveTextInput({ x: editWorldX, y: editWorldY });
        setTextInputValue(text.text);

        setFontStyles({
          family: text.fontFamily,
          size: text.fontSize,
          bold: text.fontWeight === 'bold',
          italic: text.fontStyle === 'italic',
          underline: text.textDecoration === 'underline',
          textAlign: text.textAlign || 'left' as 'left' | 'center' | 'right'
        });
        setStrokeColor(text.color);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent | KonvaEventObject<WheelEvent>) => {
    const evt = (e as any).evt || e;
    evt.preventDefault();

    const dx = evt.deltaX;
    const dy = evt.deltaY;

    if (evt.ctrlKey) {
      // Task 5.2: Zoom toward cursor on Ctrl+Scroll / pinch
      const zoomSensitivity = 0.002;
      const minScale = 0.1;  // 10%
      const maxScale = 5;    // 500%

      // Calculate new scale — scroll up (negative deltaY) zooms in
      const scaleDelta = -dy * zoomSensitivity;
      const newScale = Math.min(maxScale, Math.max(minScale, stageScale + scaleDelta));

      // Get mouse position in screen space relative to container
      const rect = containerRef.current?.getBoundingClientRect();
      const mouseScreenX = (evt.clientX ?? 0) - (rect?.left ?? 0);
      const mouseScreenY = (evt.clientY ?? 0) - (rect?.top ?? 0);

      // Zoom toward cursor: keep the world point under the mouse fixed
      // worldPoint = (screenPoint - stagePos) / oldScale
      // After zoom: screenPoint = worldPoint * newScale + newStagePos
      // So: newStagePos = screenPoint - worldPoint * newScale
      const worldX = (mouseScreenX - stagePos.x) / stageScale;
      const worldY = (mouseScreenY - stagePos.y) / stageScale;
      const newPosX = mouseScreenX - worldX * newScale;
      const newPosY = mouseScreenY - worldY * newScale;

      setStageScale(newScale);
      setStagePos({ x: newPosX, y: newPosY });
      return;
    }

    // Panning
    if (evt.shiftKey && dy !== 0) {
      setStagePos(prev => ({ ...prev, x: prev.x - dy }));
    } else {
      setStagePos(prev => ({ x: prev.x - dx, y: prev.y - dy }));
    }
  };

  // this function handles all the clicking logic.
  // it's getting kinda big, maybe i should split it up later.
  // Core handler for pointer down events. 
  // currently manages multiple interaction modes; candidate for refactoring into smaller handlers.
  const handlePointerDown = (e: KonvaEventObject<PointerEvent> | React.MouseEvent) => {
    // Task 1.3.1-B: Block canvas interactions until username is set
    if (!userName) return;

    // Check if clicking on UI (Toolbar)
    if ((e.target as HTMLElement).closest?.('[data-component="toolbar"]')) {
      if (activeTextInput) commitText();
      return;
    }

    // Panning / Hand Tool (Spacebar or explicit tool)
    if (isPanning || activeTool === ToolType.HAND) {
      const nativeEvent = (e as any).nativeEvent || (e as any).evt;
      const clientX = nativeEvent?.clientX ?? (e as any).clientX;
      const clientY = nativeEvent?.clientY ?? (e as any).clientY;

      if (typeof clientX === 'number' && typeof clientY === 'number') {
        setIsStageDragging(true);
        lastPointerPosRef.current = { x: clientX, y: clientY };
      }
      return;
    }

    // Task 1.5.3: Block ALL other interactions if locked (guests only)
    if (isEffectivelyLocked) return;

    // Check if clicking resize handles
    const nativeTarget = ('nativeEvent' in e ? e.nativeEvent.target : e.target) as Element;
    const resizeHandleEl = nativeTarget.closest?.('[data-resize-handle]');
    const rotationHandleEl = nativeTarget.closest?.('[data-rotation-handle]');
    const bendHandleEl = nativeTarget.closest?.('[data-bend-handle]');
    const arrowHandleEl = nativeTarget.closest?.('[data-arrow-handle]');

    // Get pointer position for handle interactions
    const { x, y } = getPointerPos(e);

    // Task 8: Check if clicking line/arrow edge handles
    if (activeTool === 'select' && arrowHandleEl) {
      if ('stopPropagation' in e) e.stopPropagation();

      if (!isOwner && !canModifySelection()) {
        alert("Permission Denied: You do not have access to modify this frame.");
        return;
      }

      const shapeId = arrowHandleEl.getAttribute('data-arrow-id');
      const endMarker = arrowHandleEl.getAttribute('data-arrow-handle') as 'start' | 'end';
      if (shapeId && endMarker) {
        setIsEditingArrowEnd({ id: shapeId, end: endMarker });

        // Store initial state for history
        setInitialDragState({
          shapes: new Map(shapes.filter(s => s.id === shapeId).map(s => [s.id, s] as [string, Shape]))
        } as any);
        return;
      }
    }

    // Task 8: Check if clicking line/arrow bend handle
    if (activeTool === 'select' && bendHandleEl) {
      if ('stopPropagation' in e) e.stopPropagation();

      if (!isOwner && !canModifySelection()) {
        alert("Permission Denied: You do not have access to modify this frame.");
        return;
      }

      const shapeId = bendHandleEl.getAttribute('data-bend-handle');
      if (shapeId) {
        setIsBendingArrow(shapeId);
        return;
      }
    }

    // Task 4.3: Check if clicking rotation handle
    if (activeTool === 'select' && rotationHandleEl && selectionBoundingBox) {
      if ('stopPropagation' in e) e.stopPropagation();

      // Epic 7.6.4: Guard against unauthorized modification
      if (!isOwner && !canModifySelection()) {
        alert("Permission Denied: You do not have access to modify this frame.");
        return;
      }

      setIsRotating(true);

      const centerX = selectionBoundingBox.centerX;
      const centerY = selectionBoundingBox.centerY;
      setSelectionCenter({ x: centerX, y: centerY });

      const startAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
      setRotationStartAngle(startAngle);

      // Store initial state for all selected items
      const initialRotations = new Map<string, number>();
      const initialPositions = new Map<string, Position>();
      const initialPoints = new Map<string, Position[]>();

      shapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
        initialRotations.set(s.id, s.transform.rotation);
        initialPositions.set(s.id, { x: s.position.x, y: s.position.y });

        // Capture points for point-based shapes
        if (isTriangle(s)) {
          initialPoints.set(s.id, (s as TriangleShape).points);
        } else if (isLine(s) || isArrow(s)) {
          // Store start/end and optional controlPoint as an array of points
          const ls = s as LineShape;
          const pts = [ls.startPoint, ls.endPoint];
          if (ls.controlPoint) pts.push(ls.controlPoint);
          initialPoints.set(s.id, pts);
        }
      });

      // Lines need special handling for points
      lines.filter(l => selectedLineIds.has(l.id)).forEach(l => {
        // Convert flat array to Position[] for easier rotation math
        const pts: Position[] = [];
        for (let i = 0; i < l.points.length; i += 2) {
          pts.push({ x: l.points[i], y: l.points[i + 1] });
        }
        initialPoints.set(l.id, pts);
      });

      textAnnotations.filter(t => selectedTextIds.has(t.id)).forEach(t => {
        initialRotations.set(t.id, t.rotation || 0);
        initialPositions.set(t.id, { x: t.x, y: t.y });
      });

      setInitialShapeRotations(initialRotations);
      setInitialShapePositions(initialPositions);
      setInitialShapePoints(initialPoints);

      // Store initial bounding box for stable visual rotation
      if (selectionBoundingBox) {
        setInitialSelectionBoundingBox(selectionBoundingBox);
      }
      setCurrentGroupRotation(0);

      return;
    }

    // Check if clicking resize handles (ignore if an edge/bend handle was targeted instead)
    if (activeTool === 'select' && resizeHandleEl && selectionBoundingBox && !arrowHandleEl && !bendHandleEl) {
      if ('stopPropagation' in e) e.stopPropagation();

      // Epic 7.6.4: Guard against unauthorized modification
      if (!isOwner && !canModifySelection()) {
        alert("You do not have permission to modify this selection (Frame Access Restricted).");
        return;
      }

      const handleId = resizeHandleEl.getAttribute('data-resize-handle');
      if (handleId) {
        setIsResizing(true);
        setResizeHandle(handleId);
        const selectedFrames = shapes.filter(s => selectedShapeIds.has(s.id) && isFrame(s));
        const frameChildrenIds = new Set(selectedFrames.flatMap(f => (f as any).childrenIds || []));

        setInitialResizeState({
          box: { ...selectionBoundingBox },
          shapes: new Map([
            ...shapes.filter(s => selectedShapeIds.has(s.id)).map(s => [s.id, s] as [string, Shape]),
            ...shapes.filter(s => s.parentId && selectedShapeIds.has(s.parentId)).map(s => [s.id, s] as [string, Shape])
          ]),
          lines: new Map([
            ...lines.filter(l => selectedLineIds.has(l.id)).map(l => [l.id, l]),
            ...lines.filter(l => l.parentId && selectedShapeIds.has(l.parentId)).map(l => [l.id, l])
          ] as [string, StrokeLine][]),
          texts: new Map([
            ...textAnnotations.filter(t => selectedTextIds.has(t.id)).map(t => [t.id, t] as [string, TextAnnotation]),
            ...textAnnotations.filter(t => t.parentId && selectedShapeIds.has(t.parentId)).map(t => [t.id, t] as [string, TextAnnotation])
          ])
        });
        return;
      }
    }

    // If text input is open, commit it first (unless we are clicking ON the input, which is handled by stopPropagation)
    if (activeTextInput) {
      commitText();
      // Don't return, allow specific tool actions (like starting a new text elsewhere)
    }

    // A. SELECTION TOOL
    if (activeTool === 'select') {
      // Task 4.2.1: Drag Logic - Check bounding box first
      // Complete manipulations
      if (isBendingArrow || isEditingArrowEnd) {
        setIsBendingArrow(null);
        setIsEditingArrowEnd(null);
        return;
      }

      // If we have a selection and click inside its bounding box, start dragging
      if (selectionBoundingBox && isPointInBoundingBox({ x, y }, selectionBoundingBox)) {
        // Epic 7.6.4: Guard against unauthorized modification
        if (!isOwner && !canModifySelection()) {
          alert("You do not have permission to modify this selection (Frame Access Restricted).");
          return;
        }

        setIsDraggingSelection(true);
        lastPointerPosRef.current = { x, y };
        dragStartRef.current = { x, y };
        // Snapshot for Undo
        setInitialDragState({
          box: selectionBoundingBox,
          shapes: new Map(shapes.filter(s => selectedShapeIds.has(s.id)).map(s => [s.id, s])),
          lines: new Map(lines.filter(l => selectedLineIds.has(l.id)).map(l => [l.id, l])),
          texts: new Map(textAnnotations.filter(t => selectedTextIds.has(t.id)).map(t => [t.id, t]))
        });
        return;
      }

      const clickedItem = findElementAtPoint(x, y);
      const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as any).evt;
      const isShiftClick = nativeEvent?.shiftKey || false;

      // Exit frame edit mode if the click is outside the active frame.
      if (activeFrameId) {
        const activeFrame = shapes.find(s => s.id === activeFrameId);
        if (activeFrame && isFrame(activeFrame)) {
          const f = activeFrame as FrameShape;
          const scaleX = f.transform?.scaleX || 1;
          const scaleY = f.transform?.scaleY || 1;
          const insideFrame = x >= f.position.x && x <= f.position.x + f.width * scaleX &&
                              y >= f.position.y && y <= f.position.y + f.height * scaleY;
          if (!insideFrame) {
            setActiveFrameId(null);
          }
        } else {
          setActiveFrameId(null);
        }
      }

      if (clickedItem) {
        if (isShiftClick) {
          // Multi-select: toggle selection
          if (clickedItem.type === 'shape') {
            setSelectedShapeIds(prev => {
              const next = new Set(prev);
              if (next.has(clickedItem.id)) next.delete(clickedItem.id); else next.add(clickedItem.id);
              return next;
            });
          } else if (clickedItem.type === 'line') {
            setSelectedLineIds(prev => {
              const next = new Set(prev);
              if (next.has(clickedItem.id)) next.delete(clickedItem.id); else next.add(clickedItem.id);
              return next;
            });
          } else if (clickedItem.type === 'text') {
            setSelectedTextIds(prev => {
              const next = new Set(prev);
              if (next.has(clickedItem.id)) next.delete(clickedItem.id); else next.add(clickedItem.id);
              return next;
            });
          }
        } else {
          // Single select: replace selection (clear others)
          setSelectedShapeIds(clickedItem.type === 'shape' ? new Set([clickedItem.id]) : new Set());
          setSelectedLineIds(clickedItem.type === 'line' ? new Set([clickedItem.id]) : new Set());
          setSelectedTextIds(clickedItem.type === 'text' ? new Set([clickedItem.id]) : new Set());
          // When inside an active frame, immediately arm drag so the user can
          // click-hold-drag the child element in a single gesture.
          if (activeFrameId) {
            setIsDraggingSelection(true);
            lastPointerPosRef.current = { x, y };
            dragStartRef.current = { x, y };
            setInitialDragState({
              shapes: new Map(
                clickedItem.type === 'shape'
                  ? shapes.filter(s => s.id === clickedItem.id).map(s => [s.id, s] as [string, Shape])
                  : []
              ),
              lines: new Map(
                clickedItem.type === 'line'
                  ? lines.filter(l => l.id === clickedItem.id).map(l => [l.id, l] as [string, StrokeLine])
                  : []
              ),
              texts: new Map(
                clickedItem.type === 'text'
                  ? textAnnotations.filter(t => t.id === clickedItem.id).map(t => [t.id, t] as [string, TextAnnotation])
                  : []
              ),
            });
          }
        }
      } else {
        // Clicked on empty space: start marquee selection
        setSelectedShapeIds(new Set());
        setSelectedLineIds(new Set());
        setSelectedTextIds(new Set());
        setDragStart({ x, y });
        setMarqueeRect({ x, y, width: 0, height: 0 });
        setIsDrawing(true);
      }
      return;
    }

    // B. TEXT TOOL
    if (activeTool === 'text') {
      // Start new text input
      setActiveTextInput({ x, y });
      setTextInputValue('');
      return;
    }

    // C. ERASER TOOL
    if (activeTool === 'eraser') {
      // DEBUG: Log coordinates to verify fix
      const native = (e as any).nativeEvent || (e as any).evt;
      console.log('[Eraser Down] Raw:', { x: native.clientX, y: native.clientY }, 'Canvas:', { x, y });

      // Snapshot lines for diffing later
      setInitialEraserLines(lines);
      performErase(x, y);
      setIsDrawing(true);
      return;
    }

    // C. FILL BUCKET TOOL
    if (activeTool === ToolType.FILL_BUCKET) {
      // Check if clicking on a shape — fill it
      let filled = false;
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (isPointInShape(shape, x, y, 5)) {
          // If shape is a frame, fill its background AND its child shapes
          let shapesToUpdate = [shape];
          if (shape.type === 'frame') {
            shapesToUpdate = [shape, ...shapes.filter(s => s.parentId === shape.id)];
          }

          const updates: any[] = [];
          setShapes(prev => prev.map(s => {
            if (shapesToUpdate.some(su => su.id === s.id)) {
              const prevS = s;
              const newS = { ...s, style: { ...s.style, fill: fillColor, hasFill: true } };
              updates.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: prevS, newState: newS, userId: 'local' });
              return newS;
            }
            return s;
          }));

          if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          filled = true;
          break;
        }
      }
      // If no shape clicked, change canvas background (Synced)
      if (!filled) {
        setCanvasBackgroundColor(fillColor);
        // Hint: addToHistory is handled by SyncService metadata tracking automatically
      }
      return;
    }

    // D. DRAWING/SHAPE TOOLS
    setIsDrawing(true);

    // Snap the starting point to grid for shape creation tools
    let startX = x;
    let startY = y;
    if (gridConfig.snapEnabled && gridConfig.snapType !== 'none' && activeTool !== ToolType.PEN && activeTool !== ToolType.HIGHLIGHTER) {
      const size = gridConfig.size;
      const snapType = gridConfig.snapType;
      const canSnapX = ['all', 'vertical_lines', 'lines', 'points'].includes(snapType);
      const canSnapY = ['all', 'horizontal_lines', 'lines', 'points'].includes(snapType);
      if (canSnapX) startX = Math.round(x / size) * size;
      if (canSnapY) startY = Math.round(y / size) * size;
    }
    setDragStart({ x: startX, y: startY });

    if (activeTool === ToolType.PEN) {
      const brushProps = getBrushProperties(brushType, brushSize, strokeColor);
      const newLineId = `stroke-${Date.now()}`;
      const newPoints = [x, y];

      // Store in ref for immediate access in pointerMove (Optimistic UI)
      const lineConfig: StrokeLine = {
        id: newLineId,
        points: newPoints,
        color: strokeColor,
        strokeWidth: brushSize,
        brushType: brushType,
        ...brushProps, // Apply all enhanced properties (shadows, opacity, etc.)
      };

      optimisticLineRef.current = lineConfig;
      setOptimisticLine(lineConfig);
      // Wait to call addLine until pointer up to prevent WS spam
    } else if (activeTool === ToolType.HIGHLIGHTER) {
      const highlighterColor = strokeColor + '66';
      const newLineId = `highlight-${Date.now()}`;
      const newPoints = [x, y];

      const lineConfig: StrokeLine = {
        id: newLineId,
        points: newPoints,
        color: highlighterColor,
        strokeWidth: brushSize * 3,
        brushType: BrushType.MARKER,
        opacity: 0.5,
        lineCap: 'square',
        lineJoin: 'miter',
        tension: 0.4,
      };

      optimisticLineRef.current = lineConfig;
      setOptimisticLine(lineConfig);
    } else if (activeTool === ToolType.RECTANGLE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createRectangle(startX, startY, 0, 0, {
        cornerRadius,
        style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: fillColor !== 'transparent', strokeDashArray: dashArr }
      }));
    } else if (activeTool === ToolType.CIRCLE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createCircle(startX, startY, 0, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: true, strokeDashArray: dashArr } }));
    } else if (activeTool === ToolType.ELLIPSE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createEllipse(startX, startY, 0, 0, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: true, strokeDashArray: dashArr } }));
    } else if (activeTool === ToolType.LINE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      // Smart Connectors: snap start point to nearest anchor
      const snapStart = findNearestAnchorPoint({ x: startX, y: startY }, shapes, 40);
      const sx = snapStart ? snapStart.anchor.position.x : startX;
      const sy = snapStart ? snapStart.anchor.position.y : startY;
      setPreviewShape(createLine(sx, sy, sx, sy, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: 'none', hasFill: false, strokeDashArray: dashArr } }));
      setConnectorSnapState(snapStart
        ? { start: { shapeId: snapStart.shape.id, anchorType: snapStart.anchor.type, position: snapStart.anchor.position } }
        : null);
    } else if (activeTool === ToolType.ARROW) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      // Smart Connectors: snap start point to nearest anchor
      const snapStart = findNearestAnchorPoint({ x: startX, y: startY }, shapes, 40);
      const sx = snapStart ? snapStart.anchor.position.x : startX;
      const sy = snapStart ? snapStart.anchor.position.y : startY;
      setPreviewShape(createArrow(sx, sy, sx, sy, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: 'none', hasFill: false, strokeDashArray: dashArr } }));
      setConnectorSnapState(snapStart
        ? { start: { shapeId: snapStart.shape.id, anchorType: snapStart.anchor.type, position: snapStart.anchor.position } }
        : null);
    } else if (activeTool === ToolType.TRIANGLE) {
      const dashArr = getStrokeDashArray(strokeStyle, brushSize);
      setPreviewShape(createTriangle(startX, startY, 0, { style: { stroke: strokeColor, strokeWidth: brushSize, fill: fillColor, hasFill: true, strokeDashArray: dashArr } }));
    } else if (activeTool === ToolType.FRAME) {
      setPreviewShape(createFrame(startX, startY, 0, 0, { ownerId: user?.id || 'unknown' }));
    }
  };

  // Calculate Sub-Lines
  // This logic is complex. 'eraseAtPosition' splits lines.
  // Instead of recalculating here, we should rely on the state update inside 'performErase'.
  // But 'performErase' can call 'setLines'.
  // We need to capture the pointer move events.
  // Simpler: Just rely on 'eraseAtPosition' inside 'performErase' to update state, 
  // and PointerUp to diff.
  // Pointer Move Handler.
  // Logic here runs every frame during drag interactions. Optimized to minimize allocation and avoid lag.
  const handlePointerMove = (e: KonvaEventObject<PointerEvent> | React.MouseEvent) => {
    // Panning Logic
    if (isStageDragging && lastPointerPosRef.current) {
      const nativeEvent = (e as any).nativeEvent || (e as any).evt;
      const clientX = nativeEvent?.clientX ?? (e as any).clientX;
      const clientY = nativeEvent?.clientY ?? (e as any).clientY;

      if (typeof clientX === 'number' && typeof clientY === 'number') {
        const dx = clientX - lastPointerPosRef.current.x;
        const dy = clientY - lastPointerPosRef.current.y;
        setStagePos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        lastPointerPosRef.current = { x: clientX, y: clientY };
      }
      return;
    }

    const { x, y } = getPointerPos(e);
    setCursorPos({ x, y });

    // Throttle cursor broadcast to every 50ms (~20 updates/sec)
    const now = Date.now();
    if (now - lastCursorBroadcastRef.current > 50) {
      updateCursorPosition(x, y);
      lastCursorBroadcastRef.current = now;
    }

    // Hover detection
    if (activeTool === 'select' && !isDraggingSelection && !isDrawing) {
      let hovering = false;
      if (selectionBoundingBox && isPointInBoundingBox({ x, y }, selectionBoundingBox)) {
        hovering = true;
      }
      setIsHoveringSelection(hovering);
    } else if (activeTool !== 'select') {
      setIsHoveringSelection(false);
    }

    // Handle Rotation Logic
    if (isRotating && selectionCenter && (initialShapeRotations.size > 0 || initialShapePoints.size > 0)) {
      const { x: centerX, y: centerY } = selectionCenter;

      const currentAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
      let deltaAngle = currentAngle - rotationStartAngle;

      const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as any).evt;
      if (nativeEvent?.shiftKey) {
        deltaAngle = Math.round(deltaAngle / 15) * 15;
      }

      setCurrentGroupRotation(deltaAngle); // Update visual rotation state

      const rad = (deltaAngle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Rotate Point Helper
      const rotatePoint = (px: number, py: number) => ({
        x: centerX + (px - centerX) * cos - (py - centerY) * sin,
        y: centerY + (px - centerX) * sin + (py - centerY) * cos
      });

      // Update all selected shapes
      setShapes(prev => prev.map(s => {
        if (!selectedShapeIds.has(s.id)) return s;
        if (s.parentId && selectedShapeIds.has(s.parentId)) return s; // Child inherits rotation from parent visually

        const initS = initialShapePositions.get(s.id);
        const initPos = initS;
        const initRot = initialShapeRotations.get(s.id) || 0;
        if (!initPos) return s;

        if (isRectangle(s) || isCircle(s) || isEllipse(s) || isFrame(s) || isImage(s)) {
          // Rigid Body Rotation for Centered Shapes (Rect, Circle, Ellipse, Frame, Image)

          // Calculate Initial Center/Pivot
          let itemCx = initPos.x;
          let itemCy = initPos.y;

          if (isRectangle(s) || isFrame(s) || isImage(s)) {
            itemCx += (s as any).width / 2;
            itemCy += (s as any).height / 2;
          }

          // Rotate the pivot point around the selection center
          const newCenter = rotatePoint(itemCx, itemCy);
          const newRot = initRot + deltaAngle;

          // Convert back to Top-Left if necessary
          const newPos = { x: newCenter.x, y: newCenter.y };

          if (isRectangle(s) || isFrame(s) || isImage(s)) {
            newPos.x -= (s as any).width / 2;
            newPos.y -= (s as any).height / 2;
          }

          return {
            ...s,
            position: newPos,
            transform: { ...s.transform, rotation: newRot }
          };
        } else if (isLine(s) || isArrow(s)) {
          // For Lines/Arrows, we rotate the Start and End points physically.
          // We DO NOT change the transform.rotation, as the geometry rotation covers the "group" rotation.
          // Existing local rotation (initRot) is preserved.

          const points = initialShapePoints.get(s.id);
          if (!points || points.length < 2) return s;

          const p1 = rotatePoint(points[0].x, points[0].y);
          const p2 = rotatePoint(points[1].x, points[1].y);
          let p3;
          if (points.length >= 3) {
            p3 = rotatePoint(points[2].x, points[2].y);
          }

          return {
            ...s,
            startPoint: p1,
            endPoint: p2,
            ...(p3 ? { controlPoint: p3 } : {}),
            transform: { ...s.transform, rotation: initRot } // Keep initial local rotation! 
          } as Shape;
        } else if (isTriangle(s)) {
          // For Triangles, rotate all points physically.
          const points = initialShapePoints.get(s.id);
          if (!points) return s;

          const newPoints = points.map(p => rotatePoint(p.x, p.y));

          return {
            ...s,
            points: newPoints,
            transform: { ...s.transform, rotation: initRot } // Keep initial local rotation
          } as TriangleShape;
        }

        // Fallback
        return s;
      }));

      // Update Lines (Freehand)
      if (selectedLineIds.size > 0) {
        setLines(prev => prev.map(l => {
          if (selectedLineIds.has(l.id)) {
            const initPts = initialShapePoints.get(l.id);
            if (!initPts) return l;

            const newPts: number[] = [];
            initPts.forEach(pt => {
              const newPt = rotatePoint(pt.x, pt.y);
              newPts.push(newPt.x, newPt.y);
            });
            return { ...l, points: newPts };
          }
          return l;
        }));
      }

      // Update all selected text
      setTextAnnotations(prev => prev.map(t => {
        if (selectedTextIds.has(t.id)) {
          const initPos = initialShapePositions.get(t.id);
          const initRot = initialShapeRotations.get(t.id) || 0;
          if (!initPos) return t;

          // Text rotates around top-left
          // To rotate group properly, we rotate the top-left anchor?
          // Or center?
          // Text is rendered: transform: rotate(). transform-origin: top left.
          // So we should rotate the Top-Left Postion around Selection, then rotate Text.

          const newPos = rotatePoint(initPos.x, initPos.y);
          return {
            ...t,
            x: newPos.x,
            y: newPos.y,
            rotation: initRot + deltaAngle
          };
        }
        return t;
      }));
      return;
    }

    if (isDrawing && activeTool === 'eraser') {
      performErase(x, y);
      return;
    }




    if (isEditingArrowEnd) {
      setShapes(prev => prev.map(s => {
        if (s.id === isEditingArrowEnd.id && (isArrow(s) || isLine(s))) {
          const parentFrame = s.parentId ? shapesRef.current.find(sh => sh.id === s.parentId) : null;
          const localX = parentFrame ? x - (parentFrame as any).position.x : x;
          const localY = parentFrame ? y - (parentFrame as any).position.y : y;
          return {
            ...s,
            [isEditingArrowEnd.end === 'start' ? 'startPoint' : 'endPoint']: { x: localX, y: localY }
          };
        }
        return s;
      }));
      return;
    }

    if (isBendingArrow) {
      setShapes(prev => prev.map(s => {
        if (s.id === isBendingArrow && (isArrow(s) || isLine(s))) {
          const parentFrame = s.parentId ? shapesRef.current.find(sh => sh.id === s.parentId) : null;
          const localX = parentFrame ? x - (parentFrame as any).position.x : x;
          const localY = parentFrame ? y - (parentFrame as any).position.y : y;
          return {
            ...s,
            controlPoint: { x: localX, y: localY }
          } as any;
        }
        return s;
      }));
      return;
    }

    // Handle Resizing Logic
    if (isResizing && initialResizeState && resizeHandle) {
      const { box } = initialResizeState;
      let newX = box.x;
      let newY = box.y;
      let newWidth = box.width;
      let newHeight = box.height;

      // Calculate new bounds based on handle
      // Standard delta from initial pointer usually better, but here we can compute from current mouse to initial bounds edges
      // Current Mouse: {x, y}

      // Determine new edges
      // Note: This logic assumes axis-aligned bounding box (AABB).
      // If we support rotated resizing in future, this entire block needs a matrix rewrite.

      let targetX = x;
      let targetY = y;

      if (gridConfig.snapEnabled) {
        const size = gridConfig.size;
        const snapType = gridConfig.snapType || 'all';
        const threshold = 10 / stageScale;

        const snapX = Math.round(targetX / size) * size;
        const snapY = Math.round(targetY / size) * size;

        const canSnapX = ['all', 'vertical_lines', 'lines', 'points'].includes(snapType);
        const canSnapY = ['all', 'horizontal_lines', 'lines', 'points'].includes(snapType);

        let glX = null;
        let glY = null;

        if (canSnapX && Math.abs(targetX - snapX) < threshold) {
          targetX = snapX;
          glX = snapX;
        }
        if (canSnapY && Math.abs(targetY - snapY) < threshold) {
          targetY = snapY;
          glY = snapY;
        }

        // Only show guides if we actually snapped
        // But we need to filter based on handle?
        // E.g. pulling 'East' handle should only show Vertical guide (X).
        // Pulling 'South' should show Horizontal (Y).
        // It's fine to show both if we snapped both (corner).

        setSnapGuides({ x: glX, y: glY });
      }

      if (resizeHandle.includes('e')) newWidth = Math.max(10, targetX - box.x);
      if (resizeHandle.includes('w')) {
        const right = box.x + box.width;
        newWidth = Math.max(10, right - targetX);
        newX = right - newWidth;
      }
      if (resizeHandle.includes('s')) newHeight = Math.max(10, targetY - box.y);
      if (resizeHandle.includes('n')) {
        const bottom = box.y + box.height;
        newHeight = Math.max(10, bottom - targetY);
        newY = bottom - newHeight;
      }

      // Aspect Ratio Lock (Shift)
      const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as any).evt;
      if (nativeEvent?.shiftKey && ['nw', 'ne', 'se', 'sw'].includes(resizeHandle)) {
        const ratio = box.width / box.height;

        // constraint solver: force height to obey width ratio.
        // simpler than checking dominant axis delta, covers 90% of use cases.
        if (resizeHandle === 'se' || resizeHandle === 'nw') {
          const projectedHeight = newWidth / ratio;

          // prevent shape from flipping or collapsing if user drags "past" the origin.
          if (newHeight < projectedHeight) {
            newHeight = projectedHeight;
            if (resizeHandle === 'nw') newY = (box.y + box.height) - newHeight;
          } else {
            newWidth = newHeight * ratio;
            if (resizeHandle === 'nw') newX = (box.x + box.width) - newWidth;
          }
        } else {
          // NE / SW handles.
          // math gets weird here because growing width usually means shrinking height visual.
          // stick to width-first constraint for consistency.
          newHeight = newWidth / ratio;

          // Adjust position anchor points.
          if (resizeHandle.includes('n')) {
            newY = (box.y + box.height) - newHeight;
          }
          // specific edge-case: dragging SW needs no X adjustment, but we might need Y.
          // kept logic minimal here to avoid jitter.
        }
      }

      // Scale Factors
      const scaleX = newWidth / box.width;
      const scaleY = newHeight / box.height;

      // Task 3.4.2-B: Batch resize updates to reduce network payload when dragging multiple objects
      batch(() => {
        // A. Update Shapes
        if (initialResizeState.shapes.size > 0) {
          setShapes(prev => prev.map(s => {
            const initS = initialResizeState.shapes.get(s.id);
            if (initS) {
              if (initS.parentId && initialResizeState.shapes.has(initS.parentId)) return s; // Child inherits scale from parent visually

              // New pos
              let finalX: number, finalY: number;

              if (initS.parentId && initialResizeState.shapes.has(initS.parentId)) {
                // The parent is also being resized, the parent's scale transform will handle scaling this child visually.
                // We don't need to manually update position or size of this child during group resize.
                return s;
              }

              if (initS.parentId) {
                // If it's a child, position is relative to parent.
                // We scale it proportionally within the parent's coordinate space.
                finalX = initS.position.x * scaleX;
                finalY = initS.position.y * scaleY;
              } else {
                // Global object logic
                const relX = initS.position.x - box.x;
                const relY = initS.position.y - box.y;
                finalX = newX + relX * scaleX;
                finalY = newY + relY * scaleY;
              }

              if (isRectangle(initS) || isImage(initS)) {
                return { ...s, position: { x: finalX, y: finalY }, width: (initS as any).width * scaleX, height: (initS as any).height * scaleY } as Shape;
              } else if (isCircle(initS)) {
                let scale: number;
                if (['n', 's'].includes(resizeHandle)) scale = scaleY;
                else if (['e', 'w'].includes(resizeHandle)) scale = scaleX;
                else scale = Math.max(scaleX, scaleY);

                return { ...s, position: { x: finalX, y: finalY }, radius: (initS as CircleShape).radius * scale } as Shape;
                const ls = initS as LineShape;
                return {
                  ...s,
                  position: { x: finalX, y: finalY },
                  startPoint: {
                    x: newX + (ls.startPoint.x - box.x) * scaleX,
                    y: newY + (ls.startPoint.y - box.y) * scaleY,
                  },
                  endPoint: {
                    x: newX + (ls.endPoint.x - box.x) * scaleX,
                    y: newY + (ls.endPoint.y - box.y) * scaleY,
                  },
                  ...(ls.controlPoint ? {
                    controlPoint: {
                      x: newX + (ls.controlPoint!.x - box.x) * scaleX,
                      y: newY + (ls.controlPoint!.y - box.y) * scaleY,
                    }
                  } : {})
                } as Shape;
              } else if (isFrame(initS)) {
                return {
                  ...s,
                  position: { x: finalX, y: finalY },
                  transform: {
                    ...initS.transform,
                    scaleX: initS.transform.scaleX * scaleX,
                    scaleY: initS.transform.scaleY * scaleY
                  }
                } as Shape;
              } else if (isEllipse(initS)) {
                const es = initS as EllipseShape;
                // Proper Ellipse Resize
                const scaleX = newWidth / box.width;
                const scaleY = newHeight / box.height;

                return {
                  ...s,
                  position: { x: finalX, y: finalY },
                  radiusX: es.radiusX * scaleX,
                  radiusY: es.radiusY * scaleY
                } as Shape;
              } else if (isTriangle(initS)) {
                const ts = initS as TriangleShape;
                return {
                  ...s,
                  position: { x: finalX, y: finalY },
                  points: ts.points.map((p: Position) => ({
                    x: newX + (p.x - box.x) * scaleX,
                    y: newY + (p.y - box.y) * scaleY,
                  })),
                } as Shape;
              }
              return { ...s, position: { x: finalX, y: finalY } };
            }
            return s;
          }));
        }

        // B. Update Lines
        if (initialResizeState.lines.size > 0) {
          setLines(prev => prev.map(l => {
            const initL = initialResizeState.lines.get(l.id);
            if (initL) {
              const newPoints = [];
              const isRelative = !!initL.parentId;

              for (let i = 0; i < initL.points.length; i += 2) {
                const px = initL.points[i];
                const py = initL.points[i + 1];
                let nx: number, ny: number;

                if (isRelative) {
                  nx = px * scaleX;
                  ny = py * scaleY;
                } else {
                  nx = newX + (px - box.x) * scaleX;
                  ny = newY + (py - box.y) * scaleY;
                }
                newPoints.push(nx, ny);
              }
              return { ...l, points: newPoints };
            }
            return l;
          }));
        }

        // C. Update Text
        if (initialResizeState.texts.size > 0) {
          setTextAnnotations(prev => prev.map(t => {
            const initT = initialResizeState.texts.get(t.id);
            if (initT) {
              if (initT.parentId && initialResizeState.shapes.has(initT.parentId)) return t; // Inherit parent scale
              let nx: number, ny: number;
              if (initT.parentId) {
                nx = initT.x * scaleX;
                ny = initT.y * scaleY;
              } else {
                nx = newX + (initT.x - box.x) * scaleX;
                ny = newY + (initT.y - box.y) * scaleY;
              }

              let fontScale = scaleY;
              if (['e', 'w'].includes(resizeHandle)) fontScale = scaleX;

              const nFontSize = initT.fontSize * fontScale;
              return { ...t, x: nx, y: ny, fontSize: nFontSize };
            }
            return t;
          }));
        }
      });
      return;
    }

    // Task 4.2.1: Calculate Delta during drag using absolute positions to prevent drift
    if (isDraggingSelection && dragStartRef.current && initialDragState) {
      let totalDx = x - dragStartRef.current.x;
      let totalDy = y - dragStartRef.current.y;

      // Task 5.5.2: Grid Snapping Logic (Magnetic Snapping)
      if (gridConfig.snapEnabled && selectionBoundingBox) {
        const size = gridConfig.size;
        const snapType = gridConfig.snapType || 'all';
        const threshold = 10 / stageScale;

        // Try to snap based on the ORIGINAL bounding box + totalDx/totalDy
        // To do this simply, we use the original bounding box stored in initialDragState
        let anchorX = initialDragState.box ? initialDragState.box.minX : selectionBoundingBox.minX;
        let anchorY = initialDragState.box ? initialDragState.box.minY : selectionBoundingBox.minY;

        // If we want the snap anchor to be based on geometry, we find one from initial state
        if (selectedShapeIds.size > 0) {
          const sId = Array.from(selectedShapeIds)[0];
          const s = initialDragState.shapes.get(sId);
          if (s) {
            if (s.type === 'line' || s.type === 'arrow') {
              anchorX = (s as any).startPoint.x; anchorY = (s as any).startPoint.y;
            } else if (s.type === 'triangle') {
              anchorX = (s as any).points[0].x; anchorY = (s as any).points[0].y;
            } else {
              anchorX = s.position.x; anchorY = s.position.y;
            }
          }
        } else if (selectedTextIds.size > 0) {
          const tId = Array.from(selectedTextIds)[0];
          const t = initialDragState.texts.get(tId);
          if (t) { anchorX = t.x; anchorY = t.y; }
        } else if (selectedLineIds.size > 0) {
          const lId = Array.from(selectedLineIds)[0];
          const l = initialDragState.lines.get(lId);
          if (l && l.points.length >= 2) { anchorX = l.points[0]; anchorY = l.points[1]; }
        }

        const proposedX = anchorX + totalDx;
        const proposedY = anchorY + totalDy;

        const snapX = Math.round(proposedX / size) * size;
        const snapY = Math.round(proposedY / size) * size;

        const canSnapX = ['all', 'vertical_lines', 'lines', 'points'].includes(snapType);
        const canSnapY = ['all', 'horizontal_lines', 'lines', 'points'].includes(snapType);

        let activeGuideX = null;
        let activeGuideY = null;

        if (snapType === 'points') {
          const nearX = Math.abs(proposedX - snapX) < threshold;
          const nearY = Math.abs(proposedY - snapY) < threshold;
          if (nearX || nearY) {
            totalDx = snapX - anchorX;
            totalDy = snapY - anchorY;
            activeGuideX = snapX;
            activeGuideY = snapY;
          }

          // Compute nearby grid points for "+" crosshair indicators
          const range = 3; // Show 3x3 grid of indicator points around anchor
          const pts: { x: number; y: number }[] = [];
          const centerGridX = Math.round(proposedX / size);
          const centerGridY = Math.round(proposedY / size);
          for (let gx = centerGridX - range; gx <= centerGridX + range; gx++) {
            for (let gy = centerGridY - range; gy <= centerGridY + range; gy++) {
              pts.push({ x: gx * size, y: gy * size });
            }
          }
          setSnapPointIndicators(pts);
        } else {
          if (canSnapX && Math.abs(proposedX - snapX) < threshold) {
            totalDx = snapX - anchorX;
            activeGuideX = snapX;
          }
          if (canSnapY && Math.abs(proposedY - snapY) < threshold) {
            totalDy = snapY - anchorY;
            activeGuideY = snapY;
          }
        }
        setSnapGuides({ x: activeGuideX, y: activeGuideY });
      } else {
        setSnapGuides({ x: null, y: null });
        setSnapPointIndicators([]);
      }

      // Task 4.2.2: Update object coordinates locally in real-time
      // Task 3.4.2-B: Batch local movement updates
      batch(() => {
        // 1. Move Shapes
        if (selectedShapeIds.size > 0) {
          setShapes(prev => prev.map(s => {
            if (selectedShapeIds.has(s.id)) {
              const initS = initialDragState.shapes.get(s.id);
              if (!initS) return s;
              if (initS.parentId && selectedShapeIds.has(initS.parentId)) return s; // Inherit parent drag

              let updated = {
                ...s,
                position: { x: initS.position.x + totalDx, y: initS.position.y + totalDy }
              };
              if (isLine(initS) || isArrow(initS)) {
                const ls = initS as LineShape;
                updated = {
                  ...updated,
                  startPoint: { x: ls.startPoint.x + totalDx, y: ls.startPoint.y + totalDy },
                  endPoint: { x: ls.endPoint.x + totalDx, y: ls.endPoint.y + totalDy },
                  ...(ls.controlPoint ? { controlPoint: { x: ls.controlPoint.x + totalDx, y: ls.controlPoint.y + totalDy } } : {})
                } as typeof updated;
              }
              if (isTriangle(initS)) {
                updated = {
                  ...updated,
                  points: (initS as TriangleShape).points.map((p: Position) => ({ x: p.x + totalDx, y: p.y + totalDy })),
                } as typeof updated;
              }
              return updated as Shape;
            }
            return s;
          }));
        }

        // 2. Move Lines
        if (selectedLineIds.size > 0) {
          setLines(prev => prev.map(l => {
            if (selectedLineIds.has(l.id)) {
              const initL = initialDragState.lines.get(l.id);
              if (!initL) return l;

              const newPoints = initL.points.map((val, i) => {
                return i % 2 === 0 ? val + totalDx : val + totalDy;
              });
              return { ...l, points: newPoints };
            }
            return l;
          }));
        }

        // 3. Move Text
        if (selectedTextIds.size > 0) {
          setTextAnnotations(prev => prev.map(t => {
            if (selectedTextIds.has(t.id)) {
              const initT = initialDragState.texts.get(t.id);
              if (!initT) return t;
              if (initT.parentId && selectedShapeIds.has(initT.parentId)) return t; // Inherit parent drag

              return { ...t, x: initT.x + totalDx, y: initT.y + totalDy };
            }
            return t;
          }));
        }

        // 4. Smart Connectors: re-position endpoints of lines attached to moved shapes
        if (selectedShapeIds.size > 0) {
          setShapes(prev => prev.map(s => {
            if (selectedShapeIds.has(s.id)) return s; // the moved shape itself is handled above
            if (!isLine(s) && !isArrow(s)) return s;
            const ls = s as LineShape;
            const updated: any = { ...s };
            let changed = false;
            if (ls.startConnection && selectedShapeIds.has(ls.startConnection.shapeId)) {
              const initShape = initialDragState.shapes.get(ls.startConnection.shapeId);
              if (initShape) {
                const moved = {
                  ...initShape,
                  position: { x: initShape.position.x + totalDx, y: initShape.position.y + totalDy },
                  ...(isTriangle(initShape) ? { points: (initShape as TriangleShape).points.map((p: Position) => ({ x: p.x + totalDx, y: p.y + totalDy })) } : {}),
                } as Shape;
                const pos = computeAnchorPosition(moved, ls.startConnection.anchorType);
                if (pos) { updated.startPoint = pos; updated.position = pos; changed = true; }
              }
            }
            if (ls.endConnection && selectedShapeIds.has(ls.endConnection.shapeId)) {
              const initShape = initialDragState.shapes.get(ls.endConnection.shapeId);
              if (initShape) {
                const moved = {
                  ...initShape,
                  position: { x: initShape.position.x + totalDx, y: initShape.position.y + totalDy },
                  ...(isTriangle(initShape) ? { points: (initShape as TriangleShape).points.map((p: Position) => ({ x: p.x + totalDx, y: p.y + totalDy })) } : {}),
                } as Shape;
                const pos = computeAnchorPosition(moved, ls.endConnection.anchorType);
                if (pos) { updated.endPoint = pos; changed = true; }
              }
            }
            return changed ? (updated as Shape) : s;
          }));
        }
      });

      lastPointerPosRef.current = { x, y };
      return;
    }

    if (!isDrawing) return;

    // A. MARQUEE SELECTION
    if (activeTool === 'select' && dragStart && marqueeRect) {
      const newX = Math.min(dragStart.x, x);
      const newY = Math.min(dragStart.y, y);
      const newWidth = Math.abs(x - dragStart.x);
      const newHeight = Math.abs(y - dragStart.y);
      setMarqueeRect({ x: newX, y: newY, width: newWidth, height: newHeight });
      return;
    }

    // B. ERASING
    if (activeTool === 'eraser') {
      performErase(x, y);
      return;
    }

    // B. DRAWING PEN / HIGHLIGHTER
    if (activeTool === ToolType.PEN || activeTool === ToolType.HIGHLIGHTER) {
      if (optimisticLineRef.current) {
        const pts = optimisticLineRef.current.points;
        // Skip points that are too close together to reduce noise and improve curve smoothness
        if (pts.length >= 2) {
          const lastX = pts[pts.length - 2];
          const lastY = pts[pts.length - 1];
          const dist = Math.sqrt((x - lastX) ** 2 + (y - lastY) ** 2);
          if (dist < 3) return; // minimum 3px between points
        }
        // Efficiently append new point and render optimistically
        const newPoints = [...pts, x, y];
        optimisticLineRef.current.points = newPoints;

        // Update local React state to draw immediately (optimistic render)
        setOptimisticLine({ ...optimisticLineRef.current, points: newPoints });
        // NOTE: We do NOT sync to Yjs here to avoid network round-trip delays and spam
      }
    }
    // C. RESIZING PREVIEW SHAPE
    else if (dragStart && previewShape) {
      const width = x - dragStart.x;
      const height = y - dragStart.y;
      if (activeTool === ToolType.RECTANGLE) {
        setPreviewShape({
          ...previewShape,
          position: { x: width < 0 ? x : dragStart.x, y: height < 0 ? y : dragStart.y },
          width: Math.abs(width),
          height: Math.abs(height)
        } as RectangleShape);
      } else if (activeTool === ToolType.CIRCLE) {
        const radius = Math.sqrt(width ** 2 + height ** 2);
        setPreviewShape({ ...previewShape, radius } as CircleShape);
      } else if (activeTool === ToolType.ELLIPSE) {
        const radiusX = Math.abs(width);
        const radiusY = Math.abs(height);
        setPreviewShape({
          ...previewShape,
          position: { x: dragStart.x, y: dragStart.y },
          radiusX,
          radiusY,
        } as EllipseShape);
      } else if (activeTool === ToolType.LINE || activeTool === ToolType.ARROW) {
        // Smart Connectors: snap end point to nearest anchor
        const SNAP_THRESHOLD = 40;
        const snapEnd = findNearestAnchorPoint({ x, y }, shapes, SNAP_THRESHOLD, previewShape?.id);
        const endPt = snapEnd ? snapEnd.anchor.position : { x, y };
        const startPt = connectorSnapState?.start?.position ?? { x: dragStart.x, y: dragStart.y };
        setPreviewShape({
          ...(previewShape as any),
          startPoint: startPt,
          endPoint: endPt,
          controlPoint: { x: (startPt.x + endPt.x) / 2, y: (startPt.y + endPt.y) / 2 },
          lineType: currentLineType,
          arrowAtStart: currentArrowAtStart,
          arrowAtEnd: currentArrowAtEnd,
        });
        // Update end snap state
        if (snapEnd) {
          setConnectorSnapState(prev => ({ ...prev, end: { shapeId: snapEnd.shape.id, anchorType: snapEnd.anchor.type, position: snapEnd.anchor.position } }));
        } else {
          setConnectorSnapState(prev => prev ? { ...prev, end: undefined } : null);
        }
        // Show anchor overlays for all snapable shapes
        const overlays = shapes
          .map(s => ({ shape: s, anchors: getAnchorPoints(s) }))
          .filter(o => o.anchors.length > 0);
        setConnectorAnchorOverlays(overlays);
      } else if (activeTool === ToolType.TRIANGLE) {
        const size = Math.max(Math.abs(width), Math.abs(height));
        const h = (Math.sqrt(3) / 2) * size;
        const baseX = width < 0 ? dragStart.x - size : dragStart.x;
        const baseY = height < 0 ? dragStart.y - h : dragStart.y;
        setPreviewShape({
          ...previewShape,
          position: { x: baseX, y: baseY },
          points: [
            { x: baseX + size / 2, y: baseY },
            { x: baseX + size, y: baseY + h },
            { x: baseX, y: baseY + h },
          ],
        } as TriangleShape);
      } else if (activeTool === ToolType.FRAME) {
        setPreviewShape({
          ...previewShape,
          position: { x: width < 0 ? x : dragStart.x, y: height < 0 ? y : dragStart.y },
          width: Math.abs(width),
          height: Math.abs(height),
        } as FrameShape);
      }
    }
  };

  const handlePointerUp = () => {
    // Task 3.4.1-A: Commit optimistic UI line to the network
    if (optimisticLineRef.current) {
      addLine(optimisticLineRef.current);
      optimisticLineRef.current = null;
      setOptimisticLine(null);
    }

    if (isEditingArrowEnd || isBendingArrow) {
      const shapeId = isBendingArrow || isEditingArrowEnd?.id;
      setIsBendingArrow(null);
      setIsEditingArrowEnd(null);
      if (shapeId) {
        const bentShape = shapesRef.current.find(s => s.id === shapeId);
        if (bentShape) {
          const prevState = initialDragState?.shapes.get(shapeId) || { ...bentShape };
          addToHistory({ type: 'UPDATE', objectType: 'shape', id: shapeId, previousState: prevState, newState: bentShape, userId: 'local' });
        }
      }
    }

    // Task 5.1: Stop Panning when mouse released
    setIsStageDragging(false);
    if (!isDraggingSelection) {
      lastPointerPosRef.current = null;
    }
    setSnapGuides({ x: null, y: null });
    setSnapPointIndicators([]);


    // 1. History & Logic for Eraser (MUST BE BEFORE EARLY RETURNS)
    // Task 4.5.3 Partial Eraser Logic: Detect Changes
    if (activeTool === 'eraser' && initialEraserLines) {
      const deletedLines = initialEraserLines.filter(initL => !linesRef.current.some(currL => currL.id === initL.id));
      const addedLines = linesRef.current.filter(currL => !initialEraserLines.some(initL => initL.id === currL.id));

      const actions: Action[] = [];

      // Detect Splits (Update) vs Full Deletion
      deletedLines.forEach(deletedL => {
        // Find fragments derived from this line
        // Fragments will have IDs like `originalId-randomNum`
        // We match by checking if fragment ID starts with original ID + '-'
        const fragments = addedLines.filter(addedL => addedL.id.startsWith(deletedL.id + '-'));

        if (fragments.length > 0) {
          // This is a partial erase (Split) -> UPDATE
          console.log('[Eraser] Partial Erase (Update Path):', deletedL.id, '->', fragments.length, 'fragments');
          actions.push({
            type: 'UPDATE',
            objectType: 'line',
            id: deletedL.id,
            previousState: deletedL,
            newState: fragments,
            userId: 'local'
          });
          // Mark fragments as handled so we don't treat them as separate ADDs (though logic below for Added Lines relies on `addedLines` array)
          // But we don't process addedLines separately if we map them here.
          // Wait, we need to ensure we don't double-count them.
        } else {
          // Full Deletion -> DELETE
          const index = initialEraserLines?.findIndex(l => l.id === deletedL.id);
          console.log('[Eraser] Full Deletion:', deletedL.id, 'Index:', index);
          actions.push({
            type: 'DELETE',
            objectType: 'line',
            id: deletedL.id,
            previousState: deletedL,
            newState: null,
            userId: 'local',
            index: index !== -1 ? index : undefined
          });
        }
      });

      // NOTE: Any addedLines that are NOT fragments of deleted lines?
      // In eraser tool, user only erases. So added lines MUST be fragments.
      // So we don't need to process `addedLines` separately if we assume all added lines are fragments of suppressed lines.

      if (actions.length > 0) {
        console.log('[Eraser] Batch Action Count:', actions.length);
        addToHistory({ type: 'BATCH', userId: 'local', actions: actions });
      }
      setInitialEraserLines(null);
    }

    // Task 3.1: Handle Rotation End
    if (isRotating) {
      const affectedShapes = shapes.filter(s => selectedShapeIds.has(s.id));
      const affectedLines = lines.filter(l => selectedLineIds.has(l.id));
      const affectedTexts = textAnnotations.filter(t => selectedTextIds.has(t.id));

      if (affectedShapes.length > 0 || affectedLines.length > 0 || affectedTexts.length > 0) {
        // broadcast final rotation angle only on mouseup.
        console.log('[Broadcast] Rotation Update:', {
          type: 'rotate',
          shapes: affectedShapes.map(s => ({
            id: s.id,
            rotation: s.transform.rotation
          })),
          lines: affectedLines.map(l => ({
            id: l.id,
            points: l.points
          })),
          texts: affectedTexts.map(t => ({
            id: t.id,
            rotation: t.rotation
          }))
        });

        const actions: Action[] = [];

        // History for Rotation
        affectedShapes.forEach(s => {
          const initRotation = initialShapeRotations.get(s.id);
          // prevent history spam if user clicked but didn't drag.
          if (initRotation !== undefined && initRotation !== s.transform.rotation) {
            const prevState = { ...s, transform: { ...s.transform, rotation: initRotation } };
            actions.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: prevState, newState: s, userId: 'local' });
          }
        });

        affectedLines.forEach(l => {
          const initPts = initialShapePoints.get(l.id);
          if (initPts) {
            // Restore flat array for previous state
            const oldPts = [];
            for (const pt of initPts) { oldPts.push(pt.x, pt.y); }
            const prevState = { ...l, points: oldPts };
            actions.push({ type: 'UPDATE', objectType: 'line', id: l.id, previousState: prevState, newState: l, userId: 'local' });
          }
        });

        affectedTexts.forEach(t => {
          const initRotation = initialShapeRotations.get(t.id);
          const initPos = initialShapePositions.get(t.id);
          if (initRotation !== undefined && initPos !== undefined) {
            const prevState = { ...t, x: initPos.x, y: initPos.y, rotation: initRotation };
            actions.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: prevState, newState: t, userId: 'local' });
          }
        });

        if (actions.length > 0) {
          addToHistory({ type: 'BATCH', userId: 'local', actions });
        }
      }
      setSelectionRotation(prev => prev + currentGroupRotation);
      setIsRotating(false);
      setRotationStartAngle(0);
      setInitialShapeRotations(new Map());
      setInitialSelectionBoundingBox(null);
      setCurrentGroupRotation(0);
      return;
    }

    // Task 3: Broadcast properties (resize or drag)
    if (isResizing || isDraggingSelection) {
      // History for Resize
      if (isResizing && initialResizeState) {
        const resizeUpdates: Action[] = [];
        shapes.filter(s => initialResizeState.shapes.has(s.id)).forEach(s => {
          const prev = initialResizeState.shapes.get(s.id);
          if (prev) {
            const hasMoved = prev.position.x !== s.position.x || prev.position.y !== s.position.y;
            const hasResized = (s as any).width !== (prev as any).width || (s as any).height !== (prev as any).height || (s as any).radius !== (prev as any).radius || (s as any).radiusX !== (prev as any).radiusX;
            const hasScaled = s.transform.scaleX !== prev.transform.scaleX || s.transform.scaleY !== prev.transform.scaleY;
            const hasRotated = s.transform.rotation !== prev.transform.rotation;

            if (hasMoved || hasResized || hasScaled || hasRotated || JSON.stringify((s as any).points) !== JSON.stringify((prev as any).points)) {
              resizeUpdates.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: prev, newState: s, userId: 'local' });
            }
          }
        });
        lines.filter(l => initialResizeState.lines.has(l.id)).forEach(l => {
          const prev = initialResizeState.lines.get(l.id);
          if (prev && JSON.stringify(prev.points) !== JSON.stringify(l.points)) {
            resizeUpdates.push({ type: 'UPDATE', objectType: 'line', id: l.id, previousState: prev, newState: l, userId: 'local' });
          }
        });
        textAnnotations.filter(t => initialResizeState.texts.has(t.id)).forEach(t => {
          const prev = initialResizeState.texts.get(t.id);
          if (prev && (prev.x !== t.x || prev.y !== t.y || prev.fontSize !== t.fontSize || prev.rotation !== t.rotation)) {
            resizeUpdates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: prev, newState: t, userId: 'local' });
          }
        });
        if (resizeUpdates.length > 0) {
          addToHistory({ type: 'BATCH', userId: 'local', actions: resizeUpdates });
        }
      }

      // History for Drag
      if (isDraggingSelection && initialDragState) {

        // Task 5.5.3 Optimization: Snap-On-Release (Polished UX)
        // If we ended the drag in a "Dead Zone" (Magnetic), strictly snap to grid now.
        let finalSnapDx = 0;
        let finalSnapDy = 0;

        if (gridConfig.snapEnabled) {
          const size = gridConfig.size;
          const snapType = gridConfig.snapType || 'all';

          // Find Anchor (Same logic as handlePointerMove)
          let anchorX = selectionBoundingBox?.minX || 0;
          let anchorY = selectionBoundingBox?.minY || 0;

          // Attempt to find a concrete geometry anchor from selection
          if (selectedShapeIds.size > 0) {
            const s = shapes.find(s => selectedShapeIds.has(s.id));
            if (s) {
              if (s.type === 'line' || s.type === 'arrow') { const ls = s as any; anchorX = ls.startPoint.x; anchorY = ls.startPoint.y; }
              else if (s.type === 'triangle') { const ts = s as any; anchorX = ts.points[0].x; anchorY = ts.points[0].y; }
              else { anchorX = s.position.x; anchorY = s.position.y; }
            }
          } else if (selectedTextIds.size > 0) {
            const t = textAnnotations.find(t => selectedTextIds.has(t.id));
            if (t) { anchorX = t.x; anchorY = t.y; }
          } else if (selectedLineIds.size > 0) {
            const l = lines.find(l => selectedLineIds.has(l.id));
            if (l && l.points.length >= 2) { anchorX = l.points[0]; anchorY = l.points[1]; }
          }

          const snapX = Math.round(anchorX / size) * size;
          const snapY = Math.round(anchorY / size) * size;

          const canSnapX = ['all', 'vertical_lines', 'lines', 'points'].includes(snapType);
          const canSnapY = ['all', 'horizontal_lines', 'lines', 'points'].includes(snapType);

          if (canSnapX) finalSnapDx = snapX - anchorX;
          if (canSnapY) finalSnapDy = snapY - anchorY;
        }

        // Apply Final Snap to State
        if (finalSnapDx !== 0 || finalSnapDy !== 0) {
          // Task 3.4.2-B: Batch snap operations
          batch(() => {
            // Update Shapes
            if (selectedShapeIds.size > 0) {
              setShapes(prev => prev.map(s => {
                if (selectedShapeIds.has(s.id)) {
                  const base: any = { ...s, position: { x: s.position.x + finalSnapDx, y: s.position.y + finalSnapDy } };
                  if (isLine(s) || isArrow(s)) {
                    const ls = s as LineShape;
                    base.startPoint = { x: ls.startPoint.x + finalSnapDx, y: ls.startPoint.y + finalSnapDy };
                    base.endPoint = { x: ls.endPoint.x + finalSnapDx, y: ls.endPoint.y + finalSnapDy };
                  } else if (isTriangle(s)) {
                    const ts = s as TriangleShape;
                    base.points = ts.points.map((p: Position) => ({ x: p.x + finalSnapDx, y: p.y + finalSnapDy }));
                  }
                  return base as Shape;
                }
                return s;
              }));
            }
            if (selectedLineIds.size > 0) {
              setLines(prev => prev.map(l => {
                if (selectedLineIds.has(l.id)) {
                  return { ...l, points: l.points.map((v, i) => v + (i % 2 === 0 ? finalSnapDx : finalSnapDy)) };
                }
                return l;
              }));
            }
            if (selectedTextIds.size > 0) {
              setTextAnnotations(prev => prev.map(t => {
                if (selectedTextIds.has(t.id)) return { ...t, x: t.x + finalSnapDx, y: t.y + finalSnapDy };
                return t;
              }));
            }
          });
        }

        shapes.filter(s => selectedShapeIds.has(s.id)).forEach(s => {
          const prev = initialDragState.shapes.get(s.id);
          const finalS: any = { ...s };
          if (finalSnapDx !== 0 || finalSnapDy !== 0) {
            finalS.position = { x: s.position.x + finalSnapDx, y: s.position.y + finalSnapDy };
            if (isLine(s) || isArrow(s)) {
              const ls = s as LineShape;
              finalS.startPoint = { x: ls.startPoint.x + finalSnapDx, y: ls.startPoint.y + finalSnapDy };
              finalS.endPoint = { x: ls.endPoint.x + finalSnapDx, y: ls.endPoint.y + finalSnapDy };
            } else if (isTriangle(s)) {
              const ts = s as TriangleShape;
              finalS.points = ts.points.map((p: Position) => ({ x: p.x + finalSnapDx, y: p.y + finalSnapDy }));
            }
          }

          if (prev && (prev.position.x !== finalS.position.x || prev.position.y !== finalS.position.y)) {
            addToHistory({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: prev, newState: finalS, userId: 'local' });
          }
        });

        lines.filter(l => selectedLineIds.has(l.id)).forEach(l => {
          const prev = initialDragState.lines.get(l.id);
          let finalL = { ...l };
          if (finalSnapDx !== 0 || finalSnapDy !== 0) {
            finalL = { ...finalL, points: l.points.map((v, i) => v + (i % 2 === 0 ? finalSnapDx : finalSnapDy)) };
          }
          if (prev) addToHistory({ type: 'UPDATE', objectType: 'line', id: l.id, previousState: prev, newState: finalL, userId: 'local' });
        });

        textAnnotations.filter(t => selectedTextIds.has(t.id)).forEach(t => {
          const prev = initialDragState.texts.get(t.id);
          let finalT = { ...t };
          if (finalSnapDx !== 0 || finalSnapDy !== 0) {
            finalT = { ...finalT, x: t.x + finalSnapDx, y: t.y + finalSnapDy };
          }
          if (prev && (prev.x !== finalT.x || prev.y !== finalT.y)) {
            addToHistory({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: prev, newState: finalT, userId: 'local' });
          }
        });
      }

      // Logic to prepare data for broadcast
      const affectedShapes = shapes.filter(s => selectedShapeIds.has(s.id));
      const affectedLines = lines.filter(l => selectedLineIds.has(l.id));
      const affectedText = textAnnotations.filter(t => selectedTextIds.has(t.id));

      if (affectedShapes.length > 0 || affectedLines.length > 0 || affectedText.length > 0) {
        // deferred broadcast. we don't spam the socket on every mousemove.
        // wait until drag ends, then send final state.
        console.log('[Broadcast] Object Update:', {
          type: isResizing ? 'resize' : 'move',
          shapes: affectedShapes.map(s => ({
            id: s.id,
            position: s.position,
            // rotation: s.rotation, // Re-add when rotation is implemented
            ...(isRectangle(s) ? { width: (s as RectangleShape).width, height: (s as RectangleShape).height } : {}),
            ...(isCircle(s) ? { radius: (s as CircleShape).radius } : {})
          })),
          lines: affectedLines.map(l => ({ id: l.id, points: l.points })),
          texts: affectedText.map(t => ({ id: t.id, position: { x: t.x, y: t.y }, fontSize: t.fontSize }))
        });
        // In a real app: socket.emit('update-objects', { ... });
      }

      if (isResizing) {
        setIsResizing(false);
        setResizeHandle(null);
        setInitialResizeState(null);
      }
      if (isDraggingSelection) {
        setIsDraggingSelection(false);
        lastPointerPosRef.current = null;
        dragStartRef.current = null;
        setInitialDragState(null);
      }
      return;
    }

    // Auto-switch to selection after erasing (unless locked)
    if (activeTool === 'eraser' && isDrawing && !isToolLocked) {
      setIsDrawing(false);
      setActiveTool('select');
      return; // THIS WAS PREVIOUSLY CAUSING THE BUG
    }

    setIsDrawing(false);

    // Handle marquee selection completion -- MOVED UP
    if (activeTool === 'select' && marqueeRect) {
      // Find all items that intersect with the marquee
      const selectedShapeIdsNew = new Set<string>();
      const selectedLineIdsNew = new Set<string>();
      const selectedTextIdsNew = new Set<string>();

      const marqueeBox = {
        minX: marqueeRect.x,
        minY: marqueeRect.y,
        maxX: marqueeRect.x + marqueeRect.width,
        maxY: marqueeRect.y + marqueeRect.height,
      };

      // Check shapes
      shapes.forEach(shape => {
        const shapeBbox = getShapeBoundingBox(shape);
        const intersects = !(
          shapeBbox.maxX < marqueeBox.minX ||
          shapeBbox.minX > marqueeBox.maxX ||
          shapeBbox.maxY < marqueeBox.minY ||
          shapeBbox.minY > marqueeBox.maxY
        );
        if (intersects) {
          if (shape.parentId) {
            // Find root frame
            let rootId = shape.parentId;
            for (let d = 0; d < 5; d++) {
              const p = shapes.find(sh => sh.id === rootId);
              if (!p?.parentId) break;
              rootId = p.parentId;
            }
            selectedShapeIdsNew.add(rootId);
          } else {
            selectedShapeIdsNew.add(shape.id);
          }
        }
      });

      // Check lines (use bounding box of all points)
      lines.forEach(line => {
        if (line.points.length < 2) return;
        let lineMinX = Infinity, lineMinY = Infinity, lineMaxX = -Infinity, lineMaxY = -Infinity;
        for (let i = 2; i < line.points.length; i += 2) {
          const px = line.points[i];
          const py = line.points[i + 1];
          lineMinX = Math.min(lineMinX, px);
          lineMinY = Math.min(lineMinY, py);
          lineMaxX = Math.max(lineMaxX, px);
          lineMaxY = Math.max(lineMaxY, py);
        }
        const intersects = !(
          lineMaxX < marqueeBox.minX ||
          lineMinX > marqueeBox.maxX ||
          lineMaxY < marqueeBox.minY ||
          lineMinY > marqueeBox.maxY
        );
        if (intersects) {
          if (line.parentId) {
            let rootId = line.parentId;
            for (let d = 0; d < 5; d++) {
              const p = shapes.find(sh => sh.id === rootId);
              if (!p?.parentId) break;
              rootId = p.parentId;
            }
            selectedShapeIdsNew.add(rootId);
          } else {
            selectedLineIdsNew.add(line.id);
          }
        }
      });

      // Check text
      textAnnotations.forEach(text => {
        const textWidth = text.text.length * (text.fontSize * 0.6);
        const textHeight = text.fontSize * 1.2;
        const intersects = !(
          text.x + textWidth < marqueeBox.minX ||
          text.x > marqueeBox.maxX ||
          text.y + textHeight < marqueeBox.minY ||
          text.y > marqueeBox.maxY
        );
        if (intersects) {
          if (text.parentId) {
            let rootId = text.parentId;
            for (let d = 0; d < 5; d++) {
              const p = shapes.find(sh => sh.id === rootId);
              if (!p?.parentId) break;
              rootId = p.parentId;
            }
            selectedShapeIdsNew.add(rootId);
          } else {
            selectedTextIdsNew.add(text.id);
          }
        }
      });

      setSelectedShapeIds(selectedShapeIdsNew);
      setSelectedLineIds(selectedLineIdsNew);
      setSelectedTextIds(selectedTextIdsNew);
      setMarqueeRect(null);
      setDragStart(null);
      setIsDrawing(false);
      return;
    }

    // Handle Shape Creation
    if (previewShape) {
      let isValidShape = false;

      if (isRectangle(previewShape)) {
        isValidShape = (previewShape as RectangleShape).width > 5 && (previewShape as RectangleShape).height > 5;
      } else if (isCircle(previewShape)) {
        isValidShape = (previewShape as CircleShape).radius > 5;
      } else if (isEllipse(previewShape)) {
        isValidShape = (previewShape as EllipseShape).radiusX > 5 || (previewShape as EllipseShape).radiusY > 5;
      } else if (isLine(previewShape) || isArrow(previewShape)) {
        const s = previewShape as LineShape;
        const dist = Math.sqrt((s.endPoint.x - s.startPoint.x) ** 2 + (s.endPoint.y - s.startPoint.y) ** 2);
        isValidShape = dist > 5;
      } else if (isTriangle(previewShape)) {
        const s = previewShape as TriangleShape;
        const xs = s.points.map(p => p.x);
        const ys = s.points.map(p => p.y);
        isValidShape = (Math.max(...xs) - Math.min(...xs)) > 5 || (Math.max(...ys) - Math.min(...ys)) > 5;
      } else if (isFrame(previewShape)) {
        isValidShape = (previewShape as FrameShape).width > 20 && (previewShape as FrameShape).height > 20;
      }

      if (isValidShape) {
        // Task 5.5: Snap shape to grid on creation
        let newShape = snapShapeToGrid(previewShape);

        // Smart Connectors: attach ConnectionRef to start/end of line/arrow
        if ((isLine(newShape) || isArrow(newShape)) && connectorSnapState) {
          if (connectorSnapState.start) {
            (newShape as LineShape).startConnection = { shapeId: connectorSnapState.start.shapeId, anchorType: connectorSnapState.start.anchorType };
          }
          if (connectorSnapState.end) {
            (newShape as LineShape).endConnection = { shapeId: connectorSnapState.end.shapeId, anchorType: connectorSnapState.end.anchorType };
          }
        }
        setConnectorSnapState(null);
        setConnectorAnchorOverlays([]);

        const bbox = getShapeBoundingBox(newShape);
        // Frames are always top-level, never nest them inside another frame
        const targetFrame = isFrame(newShape) ? null : getTargetFrame(bbox.centerX, bbox.centerY);

        if (targetFrame) {
          newShape = {
            ...newShape,
            parentId: targetFrame.id,
            position: {
              x: newShape.position.x - targetFrame.position.x,
              y: newShape.position.y - targetFrame.position.y
            }
          };
          if (isLine(newShape) || isArrow(newShape)) {
            (newShape as LineShape).startPoint = {
              x: (newShape as LineShape).startPoint.x - targetFrame.position.x,
              y: (newShape as LineShape).startPoint.y - targetFrame.position.y
            };
            (newShape as LineShape).endPoint = {
              x: (newShape as LineShape).endPoint.x - targetFrame.position.x,
              y: (newShape as LineShape).endPoint.y - targetFrame.position.y
            };
            // ControlPoint must also be converted to frame-relative coords,
            // otherwise the bezier offset calculation (controlPoint - midPoint) produces
            // a wildly distorted curve when start/end are frame-relative but controlPoint is not.
            if ((newShape as LineShape).controlPoint) {
              (newShape as LineShape).controlPoint = {
                x: (newShape as LineShape).controlPoint!.x - targetFrame.position.x,
                y: (newShape as LineShape).controlPoint!.y - targetFrame.position.y
              };
            }
          } else if (isTriangle(newShape)) {
            (newShape as TriangleShape).points = (newShape as TriangleShape).points.map(p => ({
              x: p.x - targetFrame.position.x,
              y: p.y - targetFrame.position.y
            })) as [Position, Position, Position];
          }
        }

        setShapes(prev => [...prev, newShape]);
        addToHistory({ type: 'ADD', objectType: 'shape', id: newShape.id, previousState: null, newState: newShape, userId: 'local' });

        // Auto-switch to selection tool after drawing (unless locked)
        if (!isToolLocked) {
          setActiveTool('select');
          setSelectedShapeIds(new Set([newShape.id]));
        }
      }
      setPreviewShape(null);
      // Smart Connectors: always clear snap state when shape creation ends
      setConnectorSnapState(null);
      setConnectorAnchorOverlays([]);
    }

    // Handle Pen/Highlighter Stroke
    if ((activeTool === ToolType.PEN || activeTool === ToolType.HIGHLIGHTER) && linesRef.current.length > 0) {
      const lastLine = linesRef.current[linesRef.current.length - 1];

      const cx = lastLine.points[0];
      const cy = lastLine.points[1];
      const targetFrame = getTargetFrame(cx, cy);

      let finalLine = lastLine;
      if (targetFrame) {
        finalLine = {
          ...lastLine,
          parentId: targetFrame.id,
          points: lastLine.points.map((p, i) => i % 2 === 0 ? p - targetFrame.position.x : p - targetFrame.position.y)
        };
        setLines(prev => prev.map(l => l.id === lastLine.id ? finalLine : l));
      }

      addToHistory({ type: 'ADD', objectType: 'line', id: finalLine.id, previousState: null, newState: finalLine, userId: 'local' });
    }

    setDragStart(null);
  };



  // -- Task 5.1: Culling (Infinite Panning Optimization) --
  // Calculate visible viewport bounds in virtual coordinates
  const visibleBounds = useMemo(() => {
    // Add a buffer margin (e.g., 500px) to prevent pop-in during fast panning
    const buffer = 500;
    return {
      minX: (-stagePos.x - buffer) / stageScale,
      minY: (-stagePos.y - buffer) / stageScale,
      maxX: (dimensions.width - stagePos.x + buffer) / stageScale,
      maxY: (dimensions.height - stagePos.y + buffer) / stageScale,
    };
  }, [stagePos, stageScale, dimensions]);

  // Filter Shapes — Phase 1: find root shapes within viewport
  const visibleShapes = useMemo(() => {
    // First pass: find top-level shapes (no parent) that are in view
    const rootVisible = shapes.filter(s => {
      if (s.parentId) return false; // skip children in first pass
      const bbox = getTransformedBoundingBox(s);
      return !(bbox.maxX < visibleBounds.minX || bbox.minX > visibleBounds.maxX ||
        bbox.maxY < visibleBounds.minY || bbox.minY > visibleBounds.maxY);
    });

    // Collect IDs of all visible root shapes (including frames)
    const visibleRootIds = new Set(rootVisible.map(s => s.id));

    // Second pass: always include children whose parent is visible
    // Children have relative coords so viewport culling doesn't apply to them directly
    const childrenOfVisible = shapes.filter(s => s.parentId && visibleRootIds.has(s.parentId));

    return [...rootVisible, ...childrenOfVisible];
  }, [shapes, visibleBounds]);

  // Filter Lines (Performance: Cache bounding boxes if possible, but for now calculate on fly)
  // Optimization: Only cull if line count is high (>100), otherwise overhead of calc might outweigh render cost?
  // For now, consistent culling.
  const visibleLines = useMemo(() => {
    return lines.filter(l => {
      // Quick check: if line has no points, skip
      if (l.points.length < 2) return false;

      // Calculate bbox (simplified: just min/max of points)
      let minX = l.points[0], maxX = l.points[0], minY = l.points[1], maxY = l.points[1];
      for (let i = 2; i < l.points.length; i += 2) {
        const x = l.points[i];
        const y = l.points[i + 1];
        if (x < minX) minX = x; else if (x > maxX) maxX = x;
        if (y < minY) minY = y; else if (y > maxY) maxY = y;
      }

      // Add stroke width buffer
      const buf = (l.strokeWidth || 5) / 2;
      return !(maxX + buf < visibleBounds.minX || minX - buf > visibleBounds.maxX ||
        maxY + buf < visibleBounds.minY || minY - buf > visibleBounds.maxY);
    });
  }, [lines, visibleBounds]);

  // Filter Text
  const visibleTextAnnotations = useMemo(() => {
    return textAnnotations.filter(t => {
      // Frame-child texts have frame-relative x/y; convert to world coords
      // before testing visibility so they aren't culled incorrectly.
      const parentFrame = t.parentId ? shapes.find(s => s.id === t.parentId) : null;
      const worldX = parentFrame ? t.x + parentFrame.position.x : t.x;
      const worldY = parentFrame ? t.y + parentFrame.position.y : t.y;
      const w = t.text.length * (t.fontSize || 18) * 0.6;
      const h = (t.fontSize || 18) * 1.2;
      return !(worldX + w < visibleBounds.minX || worldX > visibleBounds.maxX ||
        worldY + h < visibleBounds.minY || worldY > visibleBounds.maxY);
    });
  }, [textAnnotations, visibleBounds, shapes]);

  const handleCaptureCanvas = (): Promise<Blob | null> => {
    if (!stageRef.current) return Promise.resolve(null);
    const bg = canvasBackgroundColor || (theme === 'light' ? '#F7F9FC' : '#121212');

    // Compute bounds of ALL content
    const { minX, minY, maxX, maxY, hasContent } = calculateContentBounds(shapes, lines, textAnnotations);
    if (!hasContent) return Promise.resolve(null);

    const PAD = 40;
    const offX = minX - PAD;
    const offY = minY - PAD;
    const w = Math.max((maxX - minX) + PAD * 2, 200);
    const h = Math.max((maxY - minY) + PAD * 2, 200);

    // Build SVG with viewBox encompassing all content
    const svg = generateSvgContent(shapes, lines, textAnnotations, bg, w, h, offX, offY);

    // Render SVG to canvas then export as PNG blob
    return renderSvgToBlob(svg, bg, w, h);
  };

  const getCursorClass = () => {
    if (isDraggingSelection || (activeTool === 'select' && isHoveringSelection) || isStageDragging || isPanning || activeTool === ToolType.HAND) {
      if (isPanning || isStageDragging || activeTool === ToolType.HAND) {
        return 'cursor-grab active:cursor-grabbing';
      }
      return 'cursor-move';
    }
    if (activeTool === 'select') return 'cursor-default';
    if (activeTool === ToolType.FILL_BUCKET) return 'cursor-cell';
    if (activeTool === 'eraser') return 'cursor-none';
    return 'cursor-crosshair';
  };

  return (
    <div
      ref={containerRef}
      data-ns-theme={theme}
      className={`relative w-screen h-screen overflow-hidden select-none ${getCursorClass()}`}
      style={{
        backgroundColor: canvasBackgroundColor,
        touchAction: 'none',
        overscrollBehaviorX: 'none' as any,
        // Theme CSS custom properties — child components use var(--ns-*)
        '--ns-toolbar-bg': theme === 'light' ? '#ffffff' : 'rgba(21,26,31,0.97)',
        '--ns-toolbar-border': theme === 'light' ? '#E6EAF0' : 'rgba(42,51,59,0.8)',
        '--ns-toolbar-text': theme === 'light' ? '#111827' : '#dde3e8',
        '--ns-toolbar-muted': theme === 'light' ? '#2F3A4A' : '#5a6d7e',
        '--ns-toolbar-hover': theme === 'light' ? 'rgba(32, 201, 195, 0.1)' : '#262e35',
        '--ns-toolbar-active-bg': theme === 'light' ? 'rgba(32, 201, 195, 0.1)' : 'rgba(45,212,191,0.15)',
        '--ns-toolbar-active-text': theme === 'light' ? '#20C9C3' : '#2dd4bf',
        '--ns-toolbar-active-ring': theme === 'light' ? '#20C9C3' : 'rgba(45,212,191,0.40)',
        '--ns-toolbar-shadow': theme === 'light' ? '0 4px 12px rgba(0,0,0,0.05)' : '0 8px 32px rgba(0,0,0,0.5)',
        '--ns-separator': theme === 'light' ? '#E6EAF0' : '#2a333b',
        '--ns-section-label': theme === 'light' ? '#64748b' : '#4a5b6a',
        '--ns-disabled': theme === 'light' ? '#cbd5e1' : '#2a333b',
        '--ns-panel-bg': theme === 'light' ? 'rgba(255, 255, 255, 0.98)' : 'rgba(11,12,16,0.85)',
        '--ns-panel-border': theme === 'light' ? '#E6EAF0' : 'rgba(255,255,255,0.15)',
        '--ns-panel-shadow': theme === 'light' ? '0 4px 12px rgba(0,0,0,0.05)' : '0 4px 20px rgba(0,0,0,0.5)',
        '--ns-accent': theme === 'light' ? '#20C9C3' : '#66FCF1',
        '--ns-accent-dim': theme === 'light' ? '#2ED3C6' : 'rgba(255,255,255,0.7)',
      } as React.CSSProperties}
      onMouseMove={handlePointerMove}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onMouseLeave={() => setCursorPos(null)}
      onWheel={handleWheel}
    >
      {/* --- FIXED UI ELEMENTS (Outside Viewport) --- */}

      {/* Loading Overlay */}
      {isLoadingCanvas && (
        <div className={`absolute inset-0 z-[200] flex items-center justify-center ${theme === 'light' ? 'bg-[#f0f2f5] text-[#45A29E]' : 'bg-[#0B0C10] text-[#66FCF1]'}`}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#1F2833] border-t-[#66FCF1] rounded-full animate-spin"></div>
            <p className="font-medium animate-pulse">Loading your masterpiece...</p>
          </div>
        </div>
      )}

      {/* Task 3.4.3-B: Sync Status — fixed top-right */}
      <div className="fixed top-4 right-4 z-40 pointer-events-none">
        <div className={`backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-500 flex items-center gap-2 shadow-lg border h-[28px] ${isLoadingCanvas
          ? 'bg-yellow-500/15 border-yellow-500/30'
          : !isConnected
            ? 'bg-red-500/15 border-red-500/30'
            : hasPendingChanges
              ? 'bg-orange-500/15 border-orange-500/30'
              : 'bg-green-500/15 border-green-500/30'
          }`}>
          {isLoadingCanvas ? (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-yellow-300">Loading...</span>
            </>
          ) : !isConnected ? (
            <>
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-red-400 animate-ping opacity-75" />
              </div>
              <span className="text-red-300">Offline</span>
            </>
          ) : hasPendingChanges ? (
            <>
              <div className="w-3 h-3 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
              <span className="text-orange-300">Syncing...</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-300">Synced</span>
            </>
          )}
        </div>
      </div>

      {/* Task 1.5.2: Read-Only Indicator (fixed, non-draggable) */}
      {isEffectivelyLocked && (
        <div className="fixed top-14 right-4 z-40 pointer-events-none">
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg flex items-center gap-1.5 backdrop-blur-md">
            <Lock size={12} className="animate-pulse" />
            Read-Only
          </div>
        </div>
      )}

      {/* Draggable Lock Session Toggle — Moved to Hamburger Menu */}

      <Toolbar
        theme={theme}
        isSessionLocked={isEffectivelyLocked || !canModifySelection()}
        isLockActive={isLocked}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        isToolLocked={isToolLocked}
        onToolLockChange={setIsToolLocked}
        brushSize={brushSize}
        onBrushSizeChange={(s) => {
          setBrushSize(s);
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(sh => {
              if (selectedShapeIds.has(sh.id)) {
                const newS = { ...sh, style: { ...sh.style, strokeWidth: s } };
                updates.push({ type: 'UPDATE', objectType: 'shape', id: sh.id, previousState: sh, newState: newS, userId: 'local' });
                return newS;
              }
              return sh;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
          if (selectedLineIds.size > 0) {
            const updates: Action[] = [];
            setLines(prev => prev.map(l => {
              if (selectedLineIds.has(l.id)) {
                const newL = { ...l, strokeWidth: s };
                updates.push({ type: 'UPDATE', objectType: 'line', id: l.id, previousState: l, newState: newL, userId: 'local' });
                return newL;
              }
              return l;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        strokeColor={strokeColor}
        onColorChange={(c) => {
          setStrokeColor(c);
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
              if (selectedShapeIds.has(s.id)) {
                const newS = { ...s, style: { ...s.style, stroke: c } };
                updates.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: s, newState: newS, userId: 'local' });
                return newS;
              }
              return s;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
          if (selectedLineIds.size > 0) {
            const updates: Action[] = [];
            setLines(prev => prev.map(l => {
              if (selectedLineIds.has(l.id)) {
                const newL = { ...l, color: c };
                updates.push({ type: 'UPDATE', objectType: 'line', id: l.id, previousState: l, newState: newL, userId: 'local' });
                return newL;
              }
              return l;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, color: c };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        fillColor={fillColor}
        onFillColorChange={(c) => {
          setFillColor(c);
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
              if (selectedShapeIds.has(s.id)) {
                const hasFill = c !== 'transparent';
                const newS = { ...s, style: { ...s.style, fill: c, hasFill } };
                updates.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: s, newState: newS, userId: 'local' });
                return newS;
              }
              return s;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        cornerRadius={cornerRadius}
        onCornerRadiusChange={(r) => {
          setCornerRadius(r);
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
              if (selectedShapeIds.has(s.id) && s.type === 'rectangle') {
                const newS = { ...s, cornerRadius: r } as RectangleShape;
                updates.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: s, newState: newS, userId: 'local' });
                return newS;
              }
              return s;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        brushType={brushType}
        onBrushTypeChange={setBrushType}
        strokeStyle={strokeStyle}
        onStrokeStyleChange={setStrokeStyle}
        fontFamily={fontStyles.family}
        onFontFamilyChange={(f) => {
          setFontStyles(p => ({ ...p, family: f }));
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, fontFamily: f };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        fontSize={fontStyles.size}
        onFontSizeChange={(s) => {
          setFontStyles(p => ({ ...p, size: s }));
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, fontSize: s };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        isBold={fontStyles.bold}
        onBoldChange={(b) => {
          setFontStyles(p => ({ ...p, bold: b }));
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, fontWeight: b ? 'bold' : 'normal' };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        isItalic={fontStyles.italic}
        onItalicChange={(i) => {
          setFontStyles(p => ({ ...p, italic: i }));
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, fontStyle: i ? 'italic' : 'normal' };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        isUnderline={fontStyles.underline}
        onUnderlineChange={(u) => {
          setFontStyles(p => ({ ...p, underline: u }));
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, textDecoration: u ? 'underline' : 'none' };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        textAlign={fontStyles.textAlign}
        onTextAlignChange={(align) => {
          setFontStyles(p => ({ ...p, textAlign: align }));
          if (selectedTextIds.size > 0) {
            const updates: Action[] = [];
            setTextAnnotations(prev => prev.map(t => {
              if (selectedTextIds.has(t.id) && t.id !== editingTextId) {
                const newT = { ...t, textAlign: align };
                updates.push({ type: 'UPDATE', objectType: 'text', id: t.id, previousState: t, newState: newT, userId: 'local' });
                return newT;
              }
              return t;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        isTextSelected={selectedTextIds.size > 0}
        eraserMode={eraserMode}
        onEraserModeChange={setEraserMode}
        eraserSize={eraserSize}
        onEraserSizeChange={setEraserSize}
        lineType={currentLineType}
        onLineTypeChange={(lt) => {
          setCurrentLineType(lt);
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
              if (selectedShapeIds.has(s.id) && (s.type === 'line' || s.type === 'arrow')) {
                const newS = { ...s, lineType: lt } as any;
                updates.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: s, newState: newS, userId: 'local' });
                return newS;
              }
              return s;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        arrowAtStart={currentArrowAtStart}
        onArrowAtStartChange={(a) => {
          setCurrentArrowAtStart(a);
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
              if (selectedShapeIds.has(s.id) && (s.type === 'line' || s.type === 'arrow')) {
                const newS = { ...s, arrowAtStart: a } as any;
                updates.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: s, newState: newS, userId: 'local' });
                return newS;
              }
              return s;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}
        arrowAtEnd={currentArrowAtEnd}
        onArrowAtEndChange={(a) => {
          setCurrentArrowAtEnd(a);
          if (selectedShapeIds.size > 0) {
            const updates: Action[] = [];
            setShapes(prev => prev.map(s => {
              if (selectedShapeIds.has(s.id) && (s.type === 'line' || s.type === 'arrow')) {
                const newS = { ...s, arrowAtEnd: a } as any;
                updates.push({ type: 'UPDATE', objectType: 'shape', id: s.id, previousState: s, newState: newS, userId: 'local' });
                return newS;
              }
              return s;
            }));
            if (updates.length > 0) addToHistory({ type: 'BATCH', userId: 'local', actions: updates });
          }
        }}

        hasSelection={selectedShapeIds.size > 0 || selectedLineIds.size > 0 || selectedTextIds.size > 0}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        onDeleteSelected={handleDeleteSelected}

        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={performUndo}
        onRedo={performRedo}
        gridConfig={gridConfig}
        onGridConfigChange={setGridConfig}
        isOwner={isOwner}
        onToggleLock={async () => {
          const newLocked = !isLocked;
          // Update local Yjs state immediately so lock takes effect right away
          setSessionLocked(newLocked);
          // Best-effort sync to backend
          try {
            await toggleSessionLock(roomId, newLocked);
          } catch (err) {
            console.warn('Backend lock sync failed (local lock still applied):', err);
          }
        }}
        onImageUpload={() => setShowImageUpload(true)}
      />

      {/* Image Upload Modal */}
      <ImageUploadModal
        isOpen={showImageUpload}
        onClose={() => { setShowImageUpload(false); setActiveTool('select'); }}
        onImageInsert={(src, width, height) => {
          // Place the image near the viewport center
          const cx = (dimensions.width / 2 - stagePos.x) / stageScale - width / 2;
          const cy = (dimensions.height / 2 - stagePos.y) / stageScale - height / 2;
          const newImage = createImage(cx, cy, src, width, height, {
            zIndex: shapes.length,
          });
          setShapes(prev => [...prev, newImage]);
          setActiveTool('select');
          setSelectedShapeIds(new Set([newImage.id]));
        }}
      />

      {/* --- CANVAS LAYERS --- */}

      {/* LAYER 1: BACKGROUND (Infinite Pan using backgroundPosition) */}
      <div
        className="absolute inset-0 z-0 pointer-events-none select-none transition-colors duration-300"
        style={{
          backgroundColor: (() => {
            const yjsDefaults = ['#0B0C10', '#121212'];
            const isDefaultBg = !canvasBackgroundColor || yjsDefaults.includes(canvasBackgroundColor);
            if (isDefaultBg) return theme === 'light' ? '#F7F9FC' : (canvasBackgroundColor || '#121212');
            return canvasBackgroundColor;
          })(),
        }}
      />

      {/* LAYER 1.5: GRID (Separate Stage behind shapes) */}
      <div className="absolute inset-0 z-5 pointer-events-none">
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
        >
          <Layer>
            <GridRenderer
              config={{
                ...gridConfig,
                color: theme === 'light' && gridConfig.color === '#374151' ? '#D6DEE8' : gridConfig.color
              }}
              width={dimensions.width}
              height={dimensions.height}
              stageScale={stageScale}
              stagePos={stagePos}
            />
          </Layer>
        </Stage>
      </div>

      {/* LAYER 2: SVG SHAPES (Fixed Container, Transformed Content) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <SVGShapeRenderer
          shapes={previewShape ? [...visibleShapes, previewShape] : visibleShapes}
          width={dimensions.width}
          height={dimensions.height}
          selectedShapeIds={selectedShapeIds}
          transform={{ x: stagePos.x, y: stagePos.y, scale: stageScale }}
          anchorOverlays={connectorAnchorOverlays}
          snapTargetAnchor={connectorSnapState?.end ? { shapeId: connectorSnapState.end.shapeId, anchorType: connectorSnapState.end.anchorType } : null}
          activeFrameId={activeFrameId}
        />
      </div>

      {/* LAYER 2.3: MARQUEE SELECTION RECTANGLE */}
      {marqueeRect && marqueeRect.width > 0 && marqueeRect.height > 0 && (
        <svg
          className="absolute inset-0 z-25 pointer-events-none"
          width={dimensions.width}
          height={dimensions.height}
          style={{ overflow: 'visible' }}
        >
          <g transform={`translate(${stagePos.x}, ${stagePos.y}) scale(${stageScale})`}>
            <defs>
              <pattern id="marquee-pattern" patternUnits="userSpaceOnUse" width="8" height="8">
                <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="#2dd4bf" strokeWidth="1" opacity="0.5" />
              </pattern>
            </defs>
            <rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              fill="#2dd4bf"
              fillOpacity={0.08}
            />
            <rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              fill="none"
              stroke="#2dd4bf"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          </g>
        </svg>
      )}

      {/* LAYER 2.5: SELECTION BOUNDING BOX */}
      {(selectionBoundingBox || (isRotating && initialSelectionBoundingBox)) && activeTool === 'select' && !activeTextInput && (
        <SelectionOverlay
          key={[...selectedShapeIds, ...selectedLineIds, ...selectedTextIds].join(',')}
          selectionBoundingBox={isRotating && initialSelectionBoundingBox ? initialSelectionBoundingBox : selectionBoundingBox!}
          dimensions={dimensions}
          rotation={
            isRotating
              ? (selectedShapeIds.size === 1 && selectedTextIds.size === 0 && selectedLineIds.size === 0)
                ? (initialShapeRotations.get(Array.from(selectedShapeIds)[0]) || 0) + currentGroupRotation
                : (selectedTextIds.size === 1 && selectedShapeIds.size === 0 && selectedLineIds.size === 0)
                  ? (initialShapeRotations.get(Array.from(selectedTextIds)[0]) || 0) + currentGroupRotation
                  : currentGroupRotation
              : (selectedShapeIds.size === 1 && selectedTextIds.size === 0 && selectedLineIds.size === 0)
                ? (shapes.find(s => s.id === Array.from(selectedShapeIds)[0])?.transform.rotation || 0)
                : (selectedTextIds.size === 1 && selectedShapeIds.size === 0 && selectedLineIds.size === 0)
                  ? (textAnnotations.find(t => t.id === Array.from(selectedTextIds)[0])?.rotation || 0)
                  : selectionRotation
          }
          showRotationHandle={true} // Always allow rotation because we support group rotation now!
          transform={{ x: stagePos.x, y: stagePos.y, scale: stageScale }}
          isReadOnly={!canModifySelection()}
          frameName={
            selectedShapeIds.size === 1 && selectedLineIds.size === 0 && selectedTextIds.size === 0
              ? shapes.find(s => s.id === Array.from(selectedShapeIds)[0])?.type === 'frame'
                ? (shapes.find(s => s.id === Array.from(selectedShapeIds)[0]) as any)?.name
                : undefined
              : undefined
          }
          canRenameFrame={
            selectedShapeIds.size === 1 && selectedLineIds.size === 0 && selectedTextIds.size === 0
              ? (() => {
                const s = shapes.find(s => s.id === Array.from(selectedShapeIds)[0]) as any;
                return s?.type === 'frame' && (s.ownerId === user?.id || s.assignedUserIds?.includes(user?.id || ''));
              })()
              : false
          }
          canAssignGuests={
            selectedShapeIds.size === 1 && selectedLineIds.size === 0 && selectedTextIds.size === 0
              ? (() => {
                const s = shapes.find(s => s.id === Array.from(selectedShapeIds)[0]) as any;
                return s?.type === 'frame' && s.ownerId === user?.id;
              })()
              : false
          }
          onRenameFrame={() => {
            const newName = prompt("Enter new frame name:");
            if (newName && newName.trim()) {
              const sId = Array.from(selectedShapeIds)[0];
              updateShape(sId, { name: newName.trim() });
            }
          }}
          onAssignGuests={() => {
            setIsAssignGuestsModalOpen(true);
            setAssignGuestsFrameId(Array.from(selectedShapeIds)[0]);
          }}
          onGroup={() => {
            const arr = Array.from(selectedShapeIds);
            const lArr = Array.from(selectedLineIds);
            const tArr = Array.from(selectedTextIds);
            groupIntoFrame(arr, lArr, tArr, user?.id || 'anonymous');
            setSelectedShapeIds(new Set());
            setSelectedLineIds(new Set());
            setSelectedTextIds(new Set());
          }}
          onUngroup={() => {
            const frameId = Array.from(selectedShapeIds)[0];
            ungroupFrame(frameId);
            setSelectedShapeIds(new Set());
          }}
          canGroup={selectedShapeIds.size > 1 && !Array.from(selectedShapeIds).some(id => shapes.find(s => s.id === id)?.parentId)}
          canUngroup={selectedShapeIds.size === 1 && shapes.find(s => s.id === Array.from(selectedShapeIds)[0])?.type === 'frame'}
          hideStandardHandles={
            selectedShapeIds.size === 1 &&
            selectedLineIds.size === 0 &&
            selectedTextIds.size === 0 &&
            (shapes.find(s => s.id === Array.from(selectedShapeIds)[0])?.type === 'arrow' || shapes.find(s => s.id === Array.from(selectedShapeIds)[0])?.type === 'line')
          }
        />
      )}

      {/* LAYER 2.6: ARROW/LINE BEND & EDGE HANDLES */}
      {selectedShapeIds.size === 1 && selectedLineIds.size === 0 && selectedTextIds.size === 0 && activeTool === 'select' && !activeTextInput && (
        (() => {
          const sId = Array.from(selectedShapeIds)[0];
          const selectedLineOrArrow = shapes.find(s => s.id === sId);

          if (selectedLineOrArrow && (isArrow(selectedLineOrArrow) || isLine(selectedLineOrArrow))) {
            const ls = selectedLineOrArrow as any;
            const cp = ls.controlPoint || {
              x: (ls.startPoint.x + ls.endPoint.x) / 2,
              y: (ls.startPoint.y + ls.endPoint.y) / 2
            };

            const parentFrame = ls.parentId ? shapes.find((s: Shape) => s.id === ls.parentId) : null;
            const frameOffsetX = parentFrame ? (parentFrame as any).position.x : 0;
            const frameOffsetY = parentFrame ? (parentFrame as any).position.y : 0;

            const cpX = stagePos.x + (cp.x + frameOffsetX) * stageScale;
            const cpY = stagePos.y + (cp.y + frameOffsetY) * stageScale;

            const stX = stagePos.x + (ls.startPoint.x + frameOffsetX) * stageScale;
            const stY = stagePos.y + (ls.startPoint.y + frameOffsetY) * stageScale;

            const enX = stagePos.x + (ls.endPoint.x + frameOffsetX) * stageScale;
            const enY = stagePos.y + (ls.endPoint.y + frameOffsetY) * stageScale;

            return (
              <svg className="absolute inset-0 z-40 pointer-events-none overflow-visible" width={dimensions.width} height={dimensions.height}>
                {/* Mid/Bend Handle */}
                <circle
                  cx={cpX}
                  cy={cpY}
                  r={6}
                  fill="#ffffff"
                  stroke="#2dd4bf"
                  strokeWidth={2}
                  style={{ pointerEvents: 'auto', cursor: 'grab' }}
                  data-bend-handle={ls.id}
                />
                {/* Start Handle */}
                <circle
                  cx={stX}
                  cy={stY}
                  r={6}
                  fill="#2dd4bf"
                  stroke="#ffffff"
                  strokeWidth={2}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  data-arrow-handle="start"
                  data-arrow-id={ls.id}
                />
                {/* End Handle */}
                <circle
                  cx={enX}
                  cy={enY}
                  r={6}
                  fill="#2dd4bf"
                  stroke="#ffffff"
                  strokeWidth={2}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  data-arrow-handle="end"
                  data-arrow-id={ls.id}
                />
              </svg>
            );
          }
          return null;
        })()
      )}

      {/* LAYER 3: KONVA (Drawings) - Native Konva Transform */}
      {/* LAYER 3: KONVA (Drawings) - Native Konva Transform */}
      <div className="absolute inset-0 z-20">
        <Stage
          ref={stageRef}
          data-testid="main-stage"
          width={dimensions.width}
          height={dimensions.height}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={(e) => e.evt.preventDefault()} // proper way to disable context menu in Konva
        >
          {/* Grid Layer (Behind everything) */}
          <Layer>
            {/* Render lines first so they are behind shapes if desired, or same layer */}
            {visibleLines.map((line) => (
              <Stroke key={line.id} line={line} />
            ))}

            {/* Task 3.4.1-A: Render the Optimistic line immediately above synced lines */}
            {optimisticLine && (
              <Stroke line={optimisticLine} />
            )}
          </Layer>

          {/* LAYER 3.5: Alignment Guides (High Z-Index inside Stage) */}
          <Layer>
            {snapGuides.x !== null && (
              <Line
                points={[snapGuides.x, visibleBounds.minY, snapGuides.x, visibleBounds.maxY]}
                stroke="#0099ff"
                strokeWidth={1 / stageScale}
                dash={[4 / stageScale, 2 / stageScale]}
              />
            )}
            {snapGuides.y !== null && (
              <Line
                points={[visibleBounds.minX, snapGuides.y, visibleBounds.maxX, snapGuides.y]}
                stroke="#0099ff"
                strokeWidth={1 / stageScale}
                dash={[4 / stageScale, 2 / stageScale]}
              />
            )}
            {/* Points mode: "+" crosshair indicators at grid intersections */}
            {snapPointIndicators.map((pt, i) => {
              const crossSize = 6 / stageScale;
              return (
                <React.Fragment key={`snap-pt-${i}`}>
                  <Line
                    points={[pt.x - crossSize, pt.y, pt.x + crossSize, pt.y]}
                    stroke="#66FCF1"
                    strokeWidth={1.5 / stageScale}
                    opacity={0.8}
                  />
                  <Line
                    points={[pt.x, pt.y - crossSize, pt.x, pt.y + crossSize]}
                    stroke="#66FCF1"
                    strokeWidth={1.5 / stageScale}
                    opacity={0.8}
                  />
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {/* LAYER 4, 5: TEXT & HTML OVERLAYS (Transformed Container) */}
      <div
        className="absolute inset-0 z-30 pointer-events-none origin-top-left will-change-transform"
        style={{
          transform: `translate(${stagePos.x}px, ${stagePos.y}px) scale(${stageScale})`,
          width: '100%',
          height: '100%'
        }}
      >
        {/* Texts */}
        {visibleTextAnnotations.map((t) => {
          if (editingTextId === t.id) return null;
          // Frame-child texts store x/y relative to their parent frame.
          // Translate back to world (canvas) coords so the overlay div renders in the right place.
          const textParentFrame = t.parentId ? shapes.find(s => s.id === t.parentId) : null;
          const textWorldX = textParentFrame ? t.x + textParentFrame.position.x : t.x;
          const textWorldY = textParentFrame ? t.y + textParentFrame.position.y : t.y;
          return (
            <div
              key={t.id}
              style={{
                position: 'absolute',
                left: textWorldX,
                top: textWorldY,
                color: t.color,
                fontSize: Math.max(1, t.fontSize || 18),
                fontFamily: getFontFamilyWithFallback(t.fontFamily),
                fontWeight: t.fontWeight,
                fontStyle: t.fontStyle,
                textDecoration: t.textDecoration,
                textAlign: t.textAlign || 'left',
                transform: `rotate(${t.rotation || 0}deg)`,
                transformOrigin: 'top left',
              }}
              className="whitespace-pre p-1 select-none origin-top-left"
            >
              {t.text}
            </div>
          );
        })}

        {/* Input */}
        {activeTextInput && (
          <FloatingInput
            x={activeTextInput.x}
            y={activeTextInput.y}
            value={textInputValue}
            onChange={setTextInputValue}
            style={{ ...fontStyles, fontSize: fontStyles.size, color: strokeColor }}
            onSubmit={commitText}
          />
        )}

        {/* Eraser Cursor */}
        {activeTool === 'eraser' && cursorPos && (
          <EraserCursor cursorPos={cursorPos} eraserSize={eraserSize / stageScale} />
        )}
      </div>

      {/* Export Tools Overlay - Moved to Hamburger Menu */}
      {/* Task 5.4.1: Recenter Button */}
      <RecenterButton onRecenter={handleRecenter} />

      {/* Task 5.3: Mini-Map */}
      <MiniMap
        shapes={shapes}
        lines={lines}
        textAnnotations={textAnnotations}
        stagePos={stagePos}
        stageScale={stageScale}
        dimensions={dimensions}
        users={users}
        onNavigate={(worldX, worldY) => {
          // Center the viewport on the clicked world position
          setStagePos({
            x: -(worldX * stageScale) + dimensions.width / 2,
            y: -(worldY * stageScale) + dimensions.height / 2,
          });
        }}
      />

      {/* Task 5.2.3: Zoom Percentage Indicator */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 backdrop-blur-sm rounded-lg shadow-lg"
        style={{
          background: 'var(--ns-panel-bg)',
          border: '1px solid var(--ns-panel-border)',
          boxShadow: 'var(--ns-panel-shadow)',
        }}
      >
        <button
          onClick={() => {
            const newScale = Math.max(0.1, stageScale - 0.1);
            const centerX = dimensions.width / 2;
            const centerY = dimensions.height / 2;
            const worldX = (centerX - stagePos.x) / stageScale;
            const worldY = (centerY - stagePos.y) / stageScale;
            setStagePos({ x: centerX - worldX * newScale, y: centerY - worldY * newScale });
            setStageScale(newScale);
          }}
          className="px-2 py-1.5 rounded-l-lg transition-colors text-sm font-medium"
          style={{ color: 'var(--ns-accent-dim)' }}
          title="Zoom Out (Ctrl+-)"
        >
          −
        </button>
        <button
          onClick={() => {
            const centerX = dimensions.width / 2;
            const centerY = dimensions.height / 2;
            const worldX = (centerX - stagePos.x) / stageScale;
            const worldY = (centerY - stagePos.y) / stageScale;
            setStagePos({ x: centerX - worldX * 1, y: centerY - worldY * 1 });
            setStageScale(1);
          }}
          className="px-2 py-1.5 transition-colors text-xs font-semibold min-w-[52px] text-center tabular-nums"
          style={{ color: 'var(--ns-accent)' }}
          title="Reset Zoom (Ctrl+0)"
        >
          {Math.round(stageScale * 100)}%
        </button>
        <button
          onClick={() => {
            const newScale = Math.min(5, stageScale + 0.1);
            const centerX = dimensions.width / 2;
            const centerY = dimensions.height / 2;
            const worldX = (centerX - stagePos.x) / stageScale;
            const worldY = (centerY - stagePos.y) / stageScale;
            setStagePos({ x: centerX - worldX * newScale, y: centerY - worldY * newScale });
            setStageScale(newScale);
          }}
          className="px-2 py-1.5 rounded-r-lg transition-colors text-sm font-medium"
          style={{ color: 'var(--ns-accent-dim)' }}
          title="Zoom In (Ctrl+=)"
        >
          +
        </button>
      </div>

      {/* Standalone Clear Canvas Button - Moved to HamburgerMenu */}

      {/* Task 3.1.3: Remote collaborator cursors — always visible on top */}
      <RemoteCursors users={users} stagePos={stagePos} stageScale={stageScale} />

      {/* Project Name Editor */}
      <div className="fixed top-4 left-16 xl:left-20 z-50 hidden lg:block">
        <ProjectNameEditor
          sessionId={roomId}
          initialName={sessionInfo?.name || 'Untitled Board'}
          isOwner={isOwner}
          theme={theme}
        />
      </div>

      {/* Hamburger Menu — top-left */}
      <HamburgerMenu
        stageRef={stageRef}
        lines={lines}
        shapes={shapes}
        textAnnotations={textAnnotations}
        backgroundColor={canvasBackgroundColor}
        isOwner={isOwner}
        isLocked={isLocked}
        onToggleLock={async () => {
          try {
            const newStatus = await toggleSessionLock(roomId, !isLocked);
            setIsLocked(newStatus);
            setSessionLocked(newStatus);
          } catch (err) {
            console.error("Failed to toggle lock from menu", err);
          }
        }}
        onClearCanvas={() => {
          if (confirm('Are you sure you want to clear the entire canvas? This action can be undone.')) {
            clearAll();
          }
        }}
        theme={theme}
        onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        onCaptureCanvas={handleCaptureCanvas}
        onOpenReplay={() => setShowReplay(true)}
        roomId={roomId}
      />

      {/* Task 1.4.3-B: Presence Badge — draggable, shows live collaborators */}
      <PresenceBadge users={users} />

      {/* Epic 7.6.2: Assign Guests Modal */}
      {isAssignGuestsModalOpen && assignGuestsFrameId && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-[#12141D] border border-white/10 rounded-xl p-6 shadow-2xl w-full max-w-sm flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white tracking-tight">Assign Guests</h2>
            <p className="text-sm text-gray-400">Select users who can edit this frame.</p>

            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {users.filter(u => u.id !== user?.id && u.id).map((u) => (
                <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-600 text-teal-500 focus:ring-teal-500 focus:ring-offset-gray-900 bg-gray-800"
                    checked={(shapes.find(s => s.id === assignGuestsFrameId) as any)?.assignedUserIds?.includes(u.id) || false}
                    onChange={(e) => {
                      const frame = shapes.find(s => s.id === assignGuestsFrameId) as any;
                      if (frame && frame.type === 'frame') {
                        const currentAssigned = (frame.assignedUserIds || []) as string[];
                        const newAssigned = e.target.checked
                          ? [...currentAssigned, u.id]
                          : currentAssigned.filter((id: string) => id !== u.id);

                        updateShape(assignGuestsFrameId, { assignedUserIds: newAssigned });
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-inner" style={{ backgroundColor: u.color, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-gray-200 font-medium text-sm">{u.name}</span>
                  </div>
                </label>
              ))}
              {users.filter(u => u.id !== user?.id && u.id).length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">No other guests currently in room.</div>
              )}
            </div>

            <div className="flex justify-end pt-2 mt-2 border-t border-white/10">
              <button
                className="px-5 py-2 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 hover:text-teal-300 font-medium transition-all"
                onClick={() => {
                  setIsAssignGuestsModalOpen(false);
                  setAssignGuestsFrameId(null);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Epic 7.6.3: Guest Assignment Toast Overlay */}
      {guestToastMessage && (
        <div className="fixed top-20 right-8 z-[120] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-[#12141D]/90 backdrop-blur-md border border-teal-500/30 px-4 py-3 rounded-lg shadow-xl shadow-teal-500/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white tracking-tight">Access Granted</span>
              <span className="text-xs text-teal-100/70">{guestToastMessage}</span>
            </div>
          </div>
        </div>
      )}

      {/* Task 1.3.1-B: Username Modal — blocks canvas until name is provided */}
      {!userName && (
        <UsernameModal
          onSubmit={(name) => {
            localStorage.setItem('novasketch_userName', name);
            setUserName(name);
          }}
        />
      )}

      {/* Timeline Replay Overlay */}
      {showReplay && (
        <ReplayOverlay
          sessionId={roomId}
          onClose={() => setShowReplay(false)}
          onApplyToLive={(update: Uint8Array) => {
            const tempDoc = new Y.Doc();
            Y.applyUpdate(tempDoc, update);
            const snapLines = tempDoc.getArray('lines').toArray() as any[];
            const snapShapes = tempDoc.getArray('shapes').toArray() as any[];
            const snapTexts = tempDoc.getArray('texts').toArray() as any[];
            tempDoc.destroy();
            batch(() => {
              syncSetLines(snapLines);
              syncSetShapes(snapShapes);
              syncSetTexts(snapTexts);
            });
          }}
        />
      )}
    </div>
  );
}
