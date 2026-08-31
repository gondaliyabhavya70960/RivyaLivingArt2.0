---
name: motion-pass
description: Add/refine GSAP+Lenis+Framer motion per DESIGN.md B4
---
Apply the motion spec in DESIGN.md B4 to $ARGUMENTS. Use only the easing and
duration tokens from A5. Every ScrollTrigger gets a static fallback and a
matchMedia reduced-motion guard. Verify 60fps feel by screenshot/scroll test
via Playwright MCP; if it can't hold up, downgrade to the static version.
