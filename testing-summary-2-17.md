# Frontend Test Summary - 2/17/2026

**Branch:** `claude/dual-demo`
**Run command:** `npm test -- --run`
**Duration:** 5.97s

## Overall Results

| Metric | Count |
|--------|-------|
| Test Files Passed | 24 |
| Test Files Failed | 4 |
| Tests Passed | 491 |
| Tests Failed | 14 |
| **Total Tests** | **505** |

## Failed Test Files

### 1. `src/components/rundown/__tests__/RundownNarrative.test.tsx` (1 failed / 2 total)

| Test | Error |
|------|-------|
| should render the heading | `Unable to find an element with the text: How This Codebase Works` |

**Root Cause:** The `RundownNarrative` component no longer renders a heading element with "How This Codebase Works". The rendered output only contains a `<p>` tag with the narrative text — the heading was likely moved to a parent component or removed.

---

### 2. `src/components/rundown/__tests__/RundownCrossCutting.test.tsx` (1 failed / 5 total)

| Test | Error |
|------|-------|
| should render the heading | `Unable to find an element with the text: Cross-Cutting Concerns` |

**Root Cause:** The `RundownCrossCutting` component no longer renders a "Cross-Cutting Concerns" heading. The rendered output shows only the grid of concern cards without a section heading — heading was likely moved to a parent component or removed.

---

### 3. `src/components/rundown/__tests__/RundownLayers.test.tsx` (4 failed / 5 total)

| Test | Error |
|------|-------|
| should render layers in order | `Unable to find an accessible element with the role "listitem"` |
| should render the heading | `Unable to find an element with the text: Architecture Layers` |
| should call onLayerClick with roles when layer is clicked | `expected "vi.fn()" to be called with arguments — Number of calls: 0` |
| should show "Click to filter" hint when onLayerClick is provided | `Unable to find an element with the text: Click to filter` |

**Root Cause:** The `RundownLayers` component was significantly refactored. Key changes:
- Layers are no longer rendered as `<li>` list items — they now use `role="button"` card-style divs with `aria-expanded`
- The "Architecture Layers" heading was removed from the component
- The click handler for `onLayerClick` is no longer wired to the layer name text — clicking "Presentation Layer" text doesn't trigger the callback
- The "Click to filter" hint text was removed

---

### 4. `src/components/rundown/__tests__/RundownSection.test.tsx` (8 failed / 8 total)

| Test | Error |
|------|-------|
| should render all sub-sections when data is present | `Unable to find an element with the text: How This Codebase Works` — rendered `<body><div /></body>` |
| should show flow tab buttons when multiple flows exist | `Unable to find an accessible element with the role "tab"` — rendered `<body><div /></body>` |
| should switch flows when tab is clicked | `Unable to find an element with the text: Renders login form and captures credentials` — rendered `<body><div /></body>` |
| should pass onFileClick to sub-components | `Unable to find an element with the text: src/utils/errors.ts` — rendered `<body><div /></body>` |
| should have proper aria label | `Unable to find a label with the text of: The Rundown - Application Flow Analysis` — rendered `<body><div /></body>` |
| should render both diagram and timeline views | `Unable to find an element by: [data-testid="flow-diagram-mock"]` — rendered `<body><div /></body>` |
| should pass onLayerClick to layers component | `Unable to find an accessible element with the role "button" and name /Layer 1 of 3/` — rendered `<body><div /></body>` |
| should pass onFileClick to layers key files | `Unable to find an element with the text: src/App.tsx` — rendered `<body><div /></body>` |

**Root Cause:** All 8 tests render an empty `<div />`. The `RundownSection` component appears to be rendering nothing — likely the component's interface/props changed significantly, or it now has conditional rendering that prevents it from displaying when the mock data doesn't match the expected shape.

---

## Summary of Root Causes

All 14 failures are in the `rundown/` component test suite and stem from **component refactoring that outpaced the tests**:

1. **Headings removed from child components** — "How This Codebase Works", "Architecture Layers", and "Cross-Cutting Concerns" headings were removed from `RundownNarrative`, `RundownLayers`, and `RundownCrossCutting` respectively. They may have been consolidated into a parent component.

2. **RundownLayers restructured** — Changed from list items (`role="listitem"`) to interactive card buttons (`role="button"` with `aria-expanded`). Click handling and "Click to filter" hint text were removed or changed.

3. **RundownSection renders empty** — The component renders nothing with the current mock data, suggesting its props interface or internal conditional logic changed substantially. This is the most impactful failure, accounting for 8 of the 14 broken tests.

## Passing Test Suites (24)

All other test suites pass, including hooks (`useAnalysis`, `useAuth`, `useChat`, `useNodeScaling`, `useTierList`, etc.), pages (`VisualizationPage`), other components (`CustomNode`, `RundownFlowDiagram`, `NodeDetailPanel`, etc.), and utilities (`layoutUtils`).

## Warnings (non-blocking)

- React Router v7 future flag warnings (`v7_startTransition`, `v7_relativeSplatPath`)
- MSW unhandled request warnings in `useTierList` tests (missing handlers for `/api/analysis/.../functions/tier-list` and `.../functions/stats`)
