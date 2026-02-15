/**
 * Shared types for the Whiteboard module.
 * Extracted from Whiteboard.tsx to avoid circular dependencies.
 */

export interface TextAnnotation {
    id: string;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    color: string;
    fontFamily: string;
    fontWeight: string;
    fontStyle: string;
    textDecoration: string;

    textAlign?: 'left' | 'center' | 'right';
    rotation?: number;
}

export interface Action {
    type: 'ADD' | 'UPDATE' | 'DELETE' | 'LAYER_CHANGE' | 'BATCH';
    objectType?: 'shape' | 'line' | 'text';
    id?: string;
    previousState?: any;
    newState?: any;
    userId: string;
    actions?: Action[]; // For BATCH type
    index?: number; // Order preservation
}
