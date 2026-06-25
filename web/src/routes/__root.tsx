import "../index.css";
import type React from "react";
import { Outlet, createRootRouteWithContext, redirect } from "@tanstack/react-router";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ErrorPage } from "../components/ErrorPage";
import { LoadingPage } from "../components/LoadingPage";
import { sessionQuery } from "../lib/queries";

interface RouterContext {
  queryClient: QueryClient;
}

function Providers({ queryClient, children }: { queryClient: QueryClient; children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  pendingComponent: LoadingPage,
  pendingMs: 200,
  beforeLoad: ({ context: { queryClient }, location }) => {
    if (typeof window === "undefined") return;
    const publicPaths = ["/", "/banned", "/auth-error"];
    if (publicPaths.includes(location.pathname)) return;
    // Prefetch in background — non-blocking. Uses cached data if fresh (5 min staleTime).
    queryClient.prefetchQuery(sessionQuery());
    const user = queryClient.getQueryData<Awaited<ReturnType<ReturnType<typeof sessionQuery>["queryFn"]>>>(
      sessionQuery().queryKey,
    );
    if (user?.banned) {
      throw redirect({ to: "/banned", search: { reason: user.banReason ?? "" } });
    }
  },
  component: RootComponent,
  notFoundComponent: () => {
    const { queryClient } = Route.useRouteContext();
    return <Providers queryClient={queryClient}><ErrorPage type="not-found" /></Providers>;
  },
  errorComponent: ({ error }) => {
    const { queryClient } = Route.useRouteContext();
    const msg = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
    return (
      <Providers queryClient={queryClient}>
        <ErrorPage type="server" description={msg} />
      </Providers>
    );
  },
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <Providers queryClient={queryClient}>
      <Outlet />
    </Providers>
  );
}

