import "../index.css";
import type React from "react";
import { Outlet, createRootRouteWithContext, redirect } from "@tanstack/react-router";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ErrorPage } from "../components/ErrorPage";
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
  beforeLoad: async ({ context: { queryClient }, location }) => {
    if (typeof window === "undefined") return;
    const publicPaths = ["/", "/banned", "/auth-error"];
    if (publicPaths.includes(location.pathname)) return;
    try {
      const user = await queryClient.ensureQueryData(sessionQuery());
      if (user?.banned) {
        throw redirect({ to: "/banned", search: { reason: user.banReason ?? "" } });
      }
    } catch (e: any) {
      if (e?.isRedirect) throw e;
    }
  },
  component: RootComponent,
  notFoundComponent: () => {
    const { queryClient } = Route.useRouteContext();
    return <Providers queryClient={queryClient}><ErrorPage type="not-found" /></Providers>;
  },
  errorComponent: ({ error }) => {
    const { queryClient } = Route.useRouteContext();
    return (
      <Providers queryClient={queryClient}>
        <ErrorPage type="server" description={(error as Error)?.message || undefined} />
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

