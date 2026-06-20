# design-sync — repo-specific notes

## Package manager constraint
`apps/web/package.json` has `devEngines.packageManager: pnpm`, which blocks `npx playwright install` when run from inside `apps/web/`. Playwright must be installed from inside `.ds-sync/` (which has its own `package.json` without the constraint):
```
cd .ds-sync && npx playwright install chromium
```

## Tailwind v4 — no CLI
This project uses `@tailwindcss/vite`, not the Tailwind CLI. The compiled CSS for design-sync was generated via the `@tailwindcss/node` programmatic API (`compile(input).build(candidates)`). Candidates are extracted with a regex from all component `.tsx` source files. The compiled output lives at `.design-sync/tailwind-compiled.css` and is referenced by `cssEntry` in config.

## Application repo, not a published package
`src/components/ui/` is an app-internal component directory, not a published npm package. The converter is configured with `componentSrcMap` listing all 11 components explicitly and a barrel file at `src/components/ui/index.ts`.

## Overlay components (Dialog, Sheet, DropdownMenu)
These portal to the document body. Preview cards use `open` prop directly on the root (no trigger needed) and `cardMode: "single"` override so the full overlay is captured in one screenshot. Viewport sizes are set in the `overrides` config block.

## Separator import
`separator.tsx` requires a namespace import (`import * as SeparatorPrimitive`) — a named import (`{ Separator as SeparatorPrimitive }`) breaks `.Root` access. This was fixed in the source file.
