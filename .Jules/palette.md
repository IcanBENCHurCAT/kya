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

## 2026-09-22 - Screen Reader Re-Announcements via ARIA-Live Reset & Native Shortcut Attributes

**Learning:** `aria-live` status regions fail to re-announce identical status messages on repeated actions unless the region text is cleared during state resets. Pairing standard `aria-keyshortcuts` attributes with `<kbd>` shortcut hints ensures assistive technologies natively announce key bindings alongside visible visual indicators, while `@media (forced-colors: active)` maintains high-contrast visibility.
**Action:** Always clear `aria-live` status text during state resets to enable repeated announcements, decorate shortcut controls with `aria-keyshortcuts`, and add forced-colors CSS rules for high-contrast themes.

## 2026-09-23 - Direct Endpoint Action Links with Dynamic ARIA Attributes

**Learning:** Pairing terminal quick-start cURL command snippets with a direct "Open in Browser" action link (`target="_blank" rel="noopener noreferrer"`) provides developers with instant GET testing without context-switching to terminal windows. Dynamically updating `href`, `aria-label`, and `title` attributes upon tab changes maintains screen reader accuracy and ensures secure external navigation.
**Action:** Include dynamic "Open Endpoint" action links alongside copy-to-clipboard buttons in code panels with full `aria-label`, `title`, and `rel="noopener noreferrer"` attributes.

## 2026-09-24 - Interactive Quick-Start Code Block Targets with Dynamic ARIA Tooltips

**Learning:** When reviewing code command snippets on landing pages, developers intuitively click directly on the code text block itself. Converting code container elements (`<code>` / `<pre>`) into interactive targets (`role="button"`, `tabindex="0"`, `cursor:pointer`, `Enter`/`Space` keydown handlers) with dynamically updated `aria-label` and `title` tooltips provides a smooth, multi-modal copy experience for both mouse and keyboard users.
**Action:** Make quick-start code snippet elements directly interactive with `role="button"`, `tabindex="0"`, keydown handlers, and accessible tooltips explaining click/keyboard activation.

## 2026-09-25 - Interactive Code Block Focus Rings & High-Contrast Hover Styles

**Learning:** Converting standard semantic tags like `<code>` or `<pre>` into interactive targets (`role="button"`) without explicit `:focus-visible` and `:hover` CSS declarations creates an inconsistent accessibility experience for keyboard and high-contrast theme users. Adding explicit `code:focus-visible` outline rings alongside `code[role="button"]:hover` visual indicators and `@media (forced-colors: active)` support ensures clear focus states and hover affordances across all interactive elements.
**Action:** Always complement `role="button"` on non-standard interactive HTML elements with explicit `:focus-visible`, `:hover`, and high-contrast CSS declarations.
