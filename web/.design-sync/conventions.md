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
