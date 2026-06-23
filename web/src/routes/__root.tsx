import "../index.css";
import { Outlet, createRootRouteWithContext, redirect } from "@tanstack/react-router";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ErrorPage } from "../components/ErrorPage";
import { sessionQuery } from "../lib/queries";

interface RouterContext {
  queryClient: QueryClient;
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
  notFoundComponent: () => <ErrorPage type="not-found" />,
  errorComponent: ({ error }) => (
    <ErrorPage type="server" description={(error as Error)?.message || undefined} />
  ),
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
