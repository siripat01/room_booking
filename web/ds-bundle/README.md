# Room Booking UI — Conventions

## Setup

No provider or wrapper is required. Components render standalone with no context dependencies.

Tailwind CSS v4 must be included — all component styles come from utility classes. The compiled stylesheet is `styles.css` (which `@import`s `_ds_bundle.css`). Load it before rendering any component:

```html
<link rel="stylesheet" href="styles.css" />
```

## Styling idiom — Tailwind utility classes

This is a **Tailwind v4 utility-class system**. Never use inline styles for spacing, color, or typography when a utility class exists. All design tokens are expressed as CSS custom properties and surfaced through Tailwind utilities.

Key token families:

| Family | Example utilities | Underlying var |
|---|---|---|
| Background / Surface | `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-secondary`, `bg-accent`, `bg-destructive` | `--color-background` etc. |
| Text | `text-foreground`, `text-muted-foreground`, `text-primary-foreground`, `text-card-foreground` | `--foreground` etc. |
| Border | `border-border`, `border-input`, `border-primary` | `--color-border` |
| Ring | `ring-ring` | `--color-ring` |
| Radius | `rounded-md`, `rounded-lg`, `rounded-sm`, `rounded-full` | `--radius` = 0.625rem |
| Status colors | `bg-green-500`, `bg-yellow-500`, `bg-destructive` | hardcoded + `--color-destructive` |

Compose layout with standard Tailwind utilities (`flex`, `gap-*`, `px-*`, `py-*`, `w-full`, etc.).

Where to find the complete token list: `tokens/` directory and `styles.css`.

## Component API reference

All components live at `window.RoomBookingUI.*` and are documented in `components/general/<Name>/<Name>.prompt.md`.

Key props:

- **Button** — `variant`: `default | secondary | outline | destructive | ghost | link`; `size`: `default | sm | lg | icon`; `asChild` for custom elements
- **Badge** — `variant`: `default | secondary | outline | destructive | success | warning`
- **Card** — compose `CardHeader` + `CardTitle` + `CardDescription` + `CardContent` + `CardFooter`
- **Input / Textarea** — standard HTML attributes; style via `className` with Tailwind utilities
- **Checkbox / Label** — pair with matching `id` / `htmlFor`
- **Dialog** — `Dialog` root + `DialogTrigger` + `DialogContent` (portals to body); wrap open state with `open` prop
- **Sheet** — same pattern as Dialog; `SheetContent` accepts `side`: `right | left | top | bottom`
- **DropdownMenu** — `DropdownMenu` root + `DropdownMenuTrigger` + `DropdownMenuContent` + `DropdownMenuItem`
- **Separator** — `orientation`: `horizontal | vertical`

## Example — booking form card

```jsx
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Input, Label, Textarea
} from "web";

function BookingForm() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Book Conference Room A</CardTitle>
        <CardDescription>Floor 3 · Capacity 20</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="purpose">Purpose</Label>
          <Textarea id="purpose" placeholder="Weekly standup…" />
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Request Booking</Button>
      </CardFooter>
    </Card>
  );
}
```

# RoomBookingUI (web@1.0.0)

This design system is the published web React library, bundled as a single
browser global. All 11 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.RoomBookingUI`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.RoomBookingUI.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { Badge } = window.RoomBookingUI;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<Badge />);
```

## Tokens

103 CSS custom properties from web. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (37): `--color-yellow-500`, `--color-green-500`, `--color-black`, …
- **spacing** (6): `--tw-space-y-reverse`, `--tw-space-x-reverse`, `--tw-inset-shadow`, …
- **typography** (10): `--font-sans`, `--font-mono`, `--font-weight-medium`, …
- **radius** (4): `--radius-sm`, `--radius-md`, `--radius-lg`, …
- **shadow** (4): `--tw-shadow`, `--tw-ring-shadow`, `--tw-ring-offset-shadow`, …
- **other** (42): `--spacing`, `--container-lg`, `--ease-in-out`, …

## Components

### general
- `Badge`
- `Button`
- `Card`
- `Checkbox`
- `Dialog`
- `DropdownMenu`
- `Input`
- `Label`
- `Separator`
- `Sheet`
- `Textarea`
