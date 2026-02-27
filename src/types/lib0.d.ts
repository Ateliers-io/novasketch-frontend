// Type declarations for lib0 modules used by sync.service.ts
// lib0 is a dependency of yjs/y-websocket but ships without .d.ts files,
// causing tsc to fail on production builds.

declare module 'lib0/decoding' {
    export function createDecoder(buf: Uint8Array): any;
    export function readVarUint(decoder: any): number;
    export function readVarString(decoder: any): string;
    export function readVarUint8Array(decoder: any): Uint8Array;
}
