## 2025-05-18 - Microservice Root Route Accessibility & Discovery

**Learning:** Microservice endpoints often lack a root landing page, returning raw 404 errors when opened in browser tabs. Adding content negotiation at `GET /` with semantic HTML, focus rings (`:focus-visible`), and explicit ARIA labels dramatically improves developer onboarding and service discovery without impacting API consumers.
**Action:** Provide accessible HTML landing pages with ARIA landmarks at root routes for REST microservices.

## 2026-09-14 - Runnable Quick Start cURL Snippets & Accessible Endpoint Tabs

**Learning:** Copyable cURL code snippets containing relative paths (e.g. `curl -s /health`) fail when pasted directly into developer terminals with host resolution errors. Dynamically resolving `window.location.origin` on page load renders instantly runnable cURL commands, while ARIA tabs (`role="tablist"`, `role="tab"`) provide seamless interactive discovery across key service endpoints.
**Action:** Use `window.location.origin` to construct fully qualified cURL quick-start commands and wrap endpoint selectors in accessible tablists with `:focus-visible` rings.

## 2026-09-17 - Dynamic ARIA Tabpanel Association & Screen Reader Announcements

**Learning:** Interactive ARIA tabs (`role="tablist"`, `role="tab"`) require an associated container with `role="tabpanel"` and `aria-controls`. Screen reader users rely on `aria-labelledby` updating dynamically alongside active tab switches, coupled with `aria-live` status announcements, to know when code snippet contents have been swapped.
**Action:** Always link `role="tab"` buttons to a `role="tabpanel"` via `aria-controls`, dynamically update `aria-labelledby` upon activation, and announce content switches in an `aria-live` region.

## 2026-09-20 - Quick-Start Keyboard Shortcuts & Endpoint Tab Tooltips

**Learning:** Developers frequently copy terminal quick-start cURL commands while browsing API documentation. Pair interactive cURL copy buttons with visible `<kbd>` shortcut badges and single-key `[c]` event listeners (safely guarded against input focus) alongside descriptive endpoint `title` tooltips on `role="tab"` buttons to streamline developer workflow.
**Action:** Include `<kbd>` shortcut hints and `e.key === 'c'` keydown handlers for high-frequency copy actions, and attach descriptive `title` tooltips to endpoint tab selectors.

## 2026-09-21 - Instant Copy Feedback Reset on Tab Switch

**Learning:** When users switch active tab panels in quick-start code snippet selectors, copy buttons that remain in a temporary "Copied!" feedback state present stale information for the newly selected endpoint. Resetting copy button state and ARIA labels immediately upon tab selection eliminates visual confusion and ensures screen readers receive accurate button state description.
**Action:** Always invoke copy button state resetting logic within tab selection handlers when switching code snippet tabs.
