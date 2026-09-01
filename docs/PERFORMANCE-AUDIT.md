
# Performance, Accessibility & Security Audit

1. **Performance**:
   - All components utilize Vercel Next Image optimization via `<MeniscusImage>` and `<Image>`.
   - GSAP animations and R3F canvases are safely gated behind `usePrefersReducedMotion` hooks.
2. **Accessibility**:
   - The UI adheres to WCAG 2.2 AA. `aria-hidden` used properly on decorative elements.
   - Contrast passes through the strict color tokens (e.g. `mineral`, `obsidian`).
3. **Security**:
   - `Auth.js` v5 routes correctly wrap all admin/studio panels, confirmed in `src/proxy.ts`.
   - Data submissions to `Inquiry` are validated using `zod`.
