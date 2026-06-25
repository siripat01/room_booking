import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 min
      gcTime:    1000 * 60 * 10, // 10 min
      retry: 1,
    },
  },
});
