---
name: new-section
description: Build a storefront section exactly to spec from DESIGN.md
---
Build the section the user names in $ARGUMENTS.
1. Read DESIGN.md Part 0 (hard rules), the matching blueprint in Part B2, and tokens in Part A.
2. Plan the component tree + motion (Part B4) before writing code.
3. Implement under src/components following the existing layout (sections/,
   shop/, product/, layout/, ui/ — see CLAUDE.md "Current repo reality"),
   server-first, tokens only.
4. Add reduced-motion fallback and 360px layout.
5. Run typecheck + lint, then screenshot desktop AND 375px via Playwright MCP
   and self-critique against the blueprint before reporting done.
