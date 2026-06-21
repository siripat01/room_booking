import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

// Inject empty SSR state so TanStack Router skips hydration
// when there is no server-rendered HTML (pure SPA / Vercel static deploy)
if (typeof window !== "undefined" && !(window as any).$_TSR) {
  (window as any).$_TSR = {
    router: { matches: [], dehydratedData: undefined },
    h: () => {},
  };
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
