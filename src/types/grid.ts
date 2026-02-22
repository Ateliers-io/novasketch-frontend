export type GridSnapType = 'none' | 'lines' | 'points' | 'all' | 'horizontal_lines' | 'vertical_lines';
export type GridAppearance = 'dots' | 'lines' | 'horizontal_lines' | 'vertical_lines' | 'crosses';

export interface GridConfig {
    snapEnabled: boolean;
    snapType: GridSnapType;
    appearance: GridAppearance;
    size: number; // grid cell size in px (default 50?)
    color: string;
    thickness: number;
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
    snapEnabled: true,
    snapType: 'lines',
    appearance: 'dots',
    size: 20,
    color: '#374151', // Subtle gray-700
    thickness: 1
};
