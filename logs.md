# Test Debugging & Resolution Logs

This document tracks the initial failures encountered during the implementation of the Offline-First Unit Tests and the technical steps taken to resolve them.

---

## 1. Initial Test Failures (Round 1)

### FAIL 1: `WhiteboardService > should delete a whiteboard element`
- **Error:** `SchemaError: KeyPath action on object store syncQueue is not indexed`
- **Cause:** In the test, we were trying to query the `syncQueue` specifically for items with `action === 'DELETE'`. However, in the database initialization (`src/db/index.ts`), the `syncQueue` was only indexed by `id`, `collection`, and `status`. Dexie.js requires a field to be explicitly indexed if you want to use it in a `.where()` clause.
- **Resolution:** 
    - Updated `AppDB` schema in `src/db/index.ts`.
    - Added `action` to the `syncQueue` store definition.
    - Incremented database version to `4` to trigger a schema migration.

### FAIL 2: `SyncService > should delete from queue on successful sync`
- **Error:** `AssertionError: expected 1 to be +0`
- **Cause (Technical Debt):** 
    1. **Asynchronous Race Condition**: The `queueOperation` method triggers a background call to `processQueue()`. In the test environment, the assertion was running before the background sync process had finished deleting the item from the queue.
    2. **Singleton Contamination**: We were using a single shared `syncService` instance. Previous tests were leaving "isSyncing" flags or cached states that interfered with subsequent tests.
- **Resolution:** 
    1. **Isolation**: Modified the tests to create a `new SyncService()` instance for every individual test (`beforeEach`).
    2. **Explicit Await**: In the test, we now explicitly `await syncService.processQueue()` to force the test to wait for the simulated "network call" to finish before checking the database count.

---

## 2. Final Verified Execution Log (Round 3)

```text
 ✓ src/services/whiteboard.service.test.ts (2 tests) 36ms
 ✓ src/services/sync.service.test.ts (3 tests) 37ms

 Test Files  2 passed (2)
      Tests  5 passed (5)
   Duration  945ms 
```

## 3. Deployment Summary
All services are now verified to handle "Offline" states correctly. The `SyncService` successfully holds data in IndexedDB and flushes it to the (mocked) backend immediately upon reconnection or when the user is online.
