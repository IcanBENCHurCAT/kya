## 2025-05-18 - Microservice Root Route Accessibility & Discovery
**Learning:** Microservice endpoints often lack a root landing page, returning raw 404 errors when opened in browser tabs. Adding content negotiation at `GET /` with semantic HTML, focus rings (`:focus-visible`), and explicit ARIA labels dramatically improves developer onboarding and service discovery without impacting API consumers.
**Action:** Provide accessible HTML landing pages with ARIA landmarks at root routes for REST microservices.

## 2026-09-14 - Runnable Quick Start cURL Snippets & Accessible Endpoint Tabs
**Learning:** Copyable cURL code snippets containing relative paths (e.g. `curl -s /health`) fail when pasted directly into developer terminals with host resolution errors. Dynamically resolving `window.location.origin` on page load renders instantly runnable cURL commands, while ARIA tabs (`role="tablist"`, `role="tab"`) provide seamless interactive discovery across key service endpoints.
**Action:** Use `window.location.origin` to construct fully qualified cURL quick-start commands and wrap endpoint selectors in accessible tablists with `:focus-visible` rings.
