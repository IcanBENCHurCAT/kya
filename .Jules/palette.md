## 2025-05-18 - Microservice Root Route Accessibility & Discovery
**Learning:** Microservice endpoints often lack a root landing page, returning raw 404 errors when opened in browser tabs. Adding content negotiation at `GET /` with semantic HTML, focus rings (`:focus-visible`), and explicit ARIA labels dramatically improves developer onboarding and service discovery without impacting API consumers.
**Action:** Provide accessible HTML landing pages with ARIA landmarks at root routes for REST microservices.
