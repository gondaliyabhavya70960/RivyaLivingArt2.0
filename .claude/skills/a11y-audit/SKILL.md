---
name: a11y-audit
description: Audit changed pages against DESIGN.md accessibility floor
---
For each route in $ARGUMENTS: check contrast against DESIGN.md A2 rule 3
(especially any gold on light — must be #8C6A1D), focus rings per A2 rule 4,
keyboard order, 44px targets, alt text, aria on drawers/menus/tables,
prefers-reduced-motion behavior. Output a fix-list, then fix it.
