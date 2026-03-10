/**
 * Sketch-RNN AI Service
 * 
 * Provides sketch completion and generation using Google's Sketch-RNN model.
 * Uses TensorFlow.js and Magenta's Sketch-RNN implementation for real-time
 * AI-assisted drawing completion.
 */

import * as tf from '@tensorflow/tfjs';
import { SketchRNN } from '@magenta/sketch';

// Model cache to avoid reloading
const modelCache = new Map<string, SketchRNN>();
let currentModel: SketchRNN | null = null;

export interface SketchRNNPoint {
    x: number;
    y: number;
    pressure?: number;
}

export interface SketchRNNOptions {
    temperature?: number;  // Controls randomness (0.0-1.0, default 0.65)
    category?: string;     // Model category (e.g., 'cat', 'dog', 'bicycle')
    numPoints?: number;    // Number of points to generate
}

/**
 * Fallback completion when model is unavailable
 */
function fallbackCompletion(
    inputPoints: SketchRNNPoint[],
    options: { temperature: number; numPoints: number }
): SketchRNNPoint[] {
    const { temperature, numPoints } = options;
    const lastPoint = inputPoints[inputPoints.length - 1];
    const secondLastPoint = inputPoints[inputPoints.length - 2];
    
    const dx = lastPoint.x - secondLastPoint.x;
    const dy = lastPoint.y - secondLastPoint.y;
    const magnitude = Math.hypot(dx, dy);
    
    if (magnitude === 0) return inputPoints;

    const completionPoints: SketchRNNPoint[] = [];
    const randomArray = new Uint32Array(numPoints);
    crypto.getRandomValues(randomArray);
    for (let i = 0; i < numPoints; i++) {
        const t = i / numPoints;
        const noise = (randomArray[i] / 0xFFFFFFFF - 0.5) * temperature * 10;
        completionPoints.push({
            x: lastPoint.x + dx * t * 3 + noise,
            y: lastPoint.y + dy * t * 3 + noise,
            pressure: 0.5 * (1 - t * 0.3)
        });
    }
    
    return [...inputPoints, ...completionPoints];
}

/**
 * Complete a partial sketch using Sketch-RNN
 * @param inputPoints User-drawn stroke points  
 * @param options Completion options
 * @returns Completed stroke points including AI-generated continuation
 */
export async function completeSketch(
    inputPoints: SketchRNNPoint[],
    options: SketchRNNOptions = {}
): Promise<SketchRNNPoint[]> {
    const {
        temperature = 0.45,
        numPoints = 30
    } = options;

    // Need at least 2 points to complete
    if (inputPoints.length < 2) {
        return inputPoints;
    }

    // If no model loaded, fall back to simple interpolation
    if (!currentModel?.isInitialized()) {
        console.warn('[SketchRNN] No model loaded, using fallback interpolation');
        return fallbackCompletion(inputPoints, { temperature, numPoints });
    }

    try {
        // Convert input to line format [[x, y], [x, y], ...]
        const line: number[][] = inputPoints.map(p => [p.x, p.y]);
        
        // Use model's lineToStroke to get proper delta format
        const initialStroke: number[][] = currentModel.lineToStroke(line, [0, 0]);
        
        if (!initialStroke || initialStroke.length === 0) {
            return fallbackCompletion(inputPoints, { temperature, numPoints });
        }
        
        // Initialize state with the input stroke
        let state = currentModel.zeroState();
        state = currentModel.updateStrokes(initialStroke, state);
        
        // Generate new points
        const generatedDeltas: number[][] = [];
        
        for (let i = 0; i < numPoints; i++) {
            try {
                const pdf = currentModel.getPDF(state, temperature, temperature);
                const sample = currentModel.sample(pdf);
                
                if (!sample || sample.length < 3) break;
                if (Number.isNaN(sample[0]) || Number.isNaN(sample[1])) break;
                
                generatedDeltas.push([sample[0], sample[1], sample[2]]);
                state = currentModel.update(sample, state);
                
                // Only stop after we've generated a reasonable number of points
                // Pen-up (sample[2] > 0.9) means the model thinks the stroke is done
                if (i > 5 && sample[2] > 0.9) break;
            } catch (err) {
                console.warn('[SketchRNN] Generation step failed:', err);
                break;
            }
        }
        
        // Convert deltas to absolute points
        const result = [...inputPoints];
        let current = inputPoints[inputPoints.length - 1];
        
        for (const [dx, dy] of generatedDeltas) {
            current = {
                x: current.x + dx,
                y: current.y + dy,
                pressure: 0.5
            };
            result.push(current);
        }
        
        return result;
        
    } catch (error) {
        console.error('[SketchRNN] Completion failed:', error);
        return fallbackCompletion(inputPoints, { temperature, numPoints });
    }
}

/**
 * Check if Sketch-RNN models are loaded and ready
 */
export function isSketchRNNReady(): boolean {
    return currentModel !== null && tf.getBackend() !== null;
}

/**
 * Load Sketch-RNN model for a specific category
 * @param category Sketch category (e.g., 'cat', 'bicycle')
 */
export async function loadSketchRNNModel(category: string): Promise<void> {
    try {
        // Check if already cached
        if (modelCache.has(category)) {
            currentModel = modelCache.get(category)!;
            console.log(`[SketchRNN] Using cached model for: ${category}`);
            return;
        }

        console.log(`[SketchRNN] Loading model for category: ${category}`);
        
        // Initialize TensorFlow.js backend if needed
        await tf.ready();
        
        // Load the model from Google's QuickDraw storage
        const modelUrl = `https://storage.googleapis.com/quickdraw-models/sketchRNN/models/${category}.gen.json`;
        const model = new SketchRNN(modelUrl);
        await model.initialize();
        
        // Cache and set as current
        modelCache.set(category, model);
        currentModel = model;
        
        console.log(`[SketchRNN] Model loaded successfully: ${category}`);
    } catch (error) {
        console.error(`[SketchRNN] Failed to load model for ${category}:`, error);
        throw new Error(`Failed to load Sketch-RNN model: ${category}`);
    }
}

/**
 * Get list of available Sketch-RNN model categories
 */
export function getAvailableCategories(): string[] {
    // These are actual QuickDraw categories that Sketch-RNN supports
    return [
        'cat', 'dog', 'bird', 'bicycle', 'car', 'airplane',
        'face', 'tree', 'flower', 'house', 'chair', 'book'
    ];
}

/**
 * Unload current model to free memory
 */
export function unloadCurrentModel(): void {
    if (currentModel) {
        currentModel.dispose();
        currentModel = null;
        console.log('[SketchRNN] Model unloaded');
    }
}

/**
 * Clear all cached models
 */
export function clearModelCache(): void {
    modelCache.forEach(model => model.dispose());
    modelCache.clear();
    currentModel = null;
    console.log('[SketchRNN] All models cleared');
}
