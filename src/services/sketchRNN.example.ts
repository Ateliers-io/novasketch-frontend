/**
 * Example: Integrating Sketch-RNN into Whiteboard
 * 
 * This file demonstrates how to wire Sketch-RNN completion
 * into the Whiteboard drawing flow.
 */

import { loadSketchRNNModel, completeSketch, SketchRNNPoint } from './sketchRNN.service';

/**
 * Load default model on app initialization
 */
export async function initializeSketchRNN() {
    try {
        await loadSketchRNNModel('cat'); // or let user choose
        console.log('[Whiteboard] Sketch-RNN ready');
    } catch (error) {
        console.warn('[Whiteboard] Sketch-RNN initialization failed:', error);
    }
}

/**
 * Convert flat points array [x1, y1, x2, y2, ...] to SketchRNNPoint[]
 */
function flatToPoints(flatPoints: number[]): SketchRNNPoint[] {
    const points: SketchRNNPoint[] = [];
    for (let i = 0; i < flatPoints.length; i += 2) {
        points.push({ x: flatPoints[i], y: flatPoints[i + 1] });
    }
    return points;
}

/**
 * Convert SketchRNNPoint[] back to flat array
 */
function pointsToFlat(points: SketchRNNPoint[]): number[] {
    const flat: number[] = [];
    points.forEach(p => {
        flat.push(p.x, p.y);
    });
    return flat;
}

/**
 * Handle mouse up event when using SKETCH_RNN brush
 * Call this from Whiteboard.tsx when user finishes drawing
 */
export async function handleSketchRNNCompletion(
    lineId: string,
    flatPoints: number[],
    updateLine: (id: string, updates: { points: number[] }) => void
) {
    try {
        // Convert to point objects
        const points = flatToPoints(flatPoints);
        
        // Get AI completion
        const completed = await completeSketch(points, {
            temperature: 0.65,
            numPoints: 30
        });
        
        // Convert back and update
        const completedFlat = pointsToFlat(completed);
        updateLine(lineId, { points: completedFlat });
        
        console.log(`[SketchRNN] Completed stroke: ${points.length} → ${completed.length} points`);
    } catch (error) {
        console.error('[SketchRNN] Completion failed:', error);
        // Keep original stroke on failure
    }
}

/**
 * Example usage in Whiteboard.tsx:
 * 
 * // 1. Initialize on mount
 * useEffect(() => {
 *     initializeSketchRNN();
 * }, []);
 * 
 * // 2. In handleMouseUp:
 * const handleMouseUp = () => {
 *     if (!isDrawing) return;
 *     setIsDrawing(false);
 *     
 *     if (currentLine && activeBrush === BrushType.SKETCH_RNN) {
 *         handleSketchRNNCompletion(
 *             currentLine.id,
 *             currentLine.points,
 *             (id, updates) => {
 *                 // Update the line in Yjs doc
 *                 const linesArray = ydoc.getArray('lines');
 *                 const index = linesArray.toArray().findIndex(l => l.id === id);
 *                 if (index >= 0) {
 *                     const line = linesArray.get(index);
 *                     linesArray.delete(index);
 *                     linesArray.insert(index, [{ ...line, ...updates }]);
 *                 }
 *             }
 *         );
 *     }
 * };
 * 
 * // 3. Add toolbar button
 * <ToolbarButton
 *     icon={Sparkles}
 *     label="AI Sketch"
 *     isActive={activeBrush === BrushType.SKETCH_RNN}
 *     onClick={() => setActiveBrush(BrushType.SKETCH_RNN)}
 * />
 */
