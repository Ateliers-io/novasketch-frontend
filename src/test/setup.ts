import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
    writable: true,
});
