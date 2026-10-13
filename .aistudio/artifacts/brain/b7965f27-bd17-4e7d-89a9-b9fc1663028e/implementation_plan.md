# Workflow Optimization & Execution Acceleration Plan

## 1. Problem Diagnosis & Root Cause Analysis

An exhaustive review of recent execution logs and conversation steps identified four primary drivers behind the 5x–10x increase in turnaround time and token usage:

### A. Tool-Call Round-Trip Latency Accumulation
- Each individual tool call (`view_file`, `run_command`, `replace_file_content`) incurs 3 to 8 seconds of container round-trip and validation overhead.
- In recent turns, 30 to 50 exploratory `view_file` calls were executed sequentially before writing any code. Across a single user prompt, this alone consumed 6 to 10 minutes of pure network and container latency.

### B. Token Window Bloat & Context Compaction Cascades
- Reading large chunks (100–300 lines) of multiple files pushed the conversation context from ~15k tokens to over 90k tokens within minutes.
- When the context threshold is exceeded, automatic conversation compaction occurs, discarding nuanced execution memory and forcing the assistant into cold re-exploration on subsequent turns.

### C. Remaining Monolithic Files & Scattered Coupling
While several views were split in earlier sprints, critical files remain monolithic with tight cross-coupling:
- `src/components/vendors/VendorForm.tsx` (~770 lines): Combines UI rendering, account credentials, validation, contacts management, and imperative handlers.
- `src/services/communicationService.ts` (~600 lines): Mixes general communications CRUD, cache layers, vendor resolution, and dashboard paginated queries.
- `schema.sql` (~950 lines): Contains all table definitions, index definitions, triggers, and complex RLS functions in a single file, making search targets ambiguous.
- Dual-layer state orchestration (`useVendorsViewState.ts` + `VendorForm.tsx` + `App.tsx`): Actions like "Save and Order" require synchronizing ref callbacks, form snapshots, and parent navigation across three different files.

---

## 2. Realistic Fix Plan: Two-Tier Solution

### Tier 1: Behavioral Execution Rules (Immediate Efficiency Protocol)
To ensure the assistant never wastes tokens or takes unnecessarily long on routine requests:
1. **Targeted Precision (Grep-First, Never Scan)**:
   - Limit file discovery to pinpoint line-number lookups: `grep -n "keyword" <exact_file>`.
   - Never read large arbitrary slices (e.g., 100+ lines); inspect only the exact function or block (15–30 lines).
2. **Hard Ceiling on Exploratory Tool Calls**:
   - Maximum 2–4 diagnostic tool calls before initiating code modifications.
   - Batch edits across files in a single pass rather than alternating between read-edit-read-edit cycles.
3. **Defer Verification to Final Step**:
   - Run compilation and lint verification once at the end of the entire change sequence, avoiding premature compiler runs.

### Tier 2: Codebase Structural Refactoring (Architectural Simplification)
Restructure remaining heavy files into decoupled, single-responsibility units so future changes touch isolated, small files (< 150 lines):

#### Phase 1: Modularize `VendorForm.tsx` (~770 lines -> 3 focused modules)
- Extract `src/components/vendors/form/VendorAccountSection.tsx`: Isolates username/password inputs, read-only toggles, and credentials synchronization.
- Extract `src/components/vendors/form/useVendorValidation.ts`: Centralizes required field validation, clean error mapping, and snapshot change detection (`hasVendorChanges`).
- Keep `VendorForm.tsx` lean (< 200 lines) as an orchestrator component.

#### Phase 2: Decouple Dashboard Reminders Service
- Move `getDashboardTodayRemindersPaginated` out of `communicationService.ts` into a dedicated `src/services/dashboardRemindersService.ts`.
- This decouples dashboard widget performance logic from the general communications table queries and columns manager.

#### Phase 3: Simplify Vendor-to-Order Direct Transition
- Replace the fragile `useImperativeHandle` / `initialSnapshotRef` dance with a clean, direct navigation helper:
  - If a supplier already exists and is selected, "Save and Order" triggers direct navigation passing the vendor ID without triggering redundant form validation and snapshot comparisons.

---

## 3. Implementation Steps & Milestones

### Step 1: Enforce Strict Assistant Execution Protocol
- Immediate implementation of zero-waste grep targeting and tool-budget discipline.

### Step 2: Refactor `VendorForm` & Form Validation
- Create `src/components/vendors/form/useVendorValidation.ts`.
- Extract `VendorAccountSection.tsx`.
- Streamline `saveAndOrder` flow to eliminate multi-step synchronization delays.

### Step 3: Extract Dashboard Reminders Service
- Create `src/services/dashboardRemindersService.ts`.
- Import directly into `DashboardView.tsx`, reducing dependencies on `communicationService.ts`.

### Step 4: Verification & Performance Benchmark
- Execute `compile_applet` and `lint_applet`.
- Verify turnaround time on sample edits (target: < 60 seconds per routine modification).
