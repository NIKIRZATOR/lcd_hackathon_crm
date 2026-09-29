import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,

      retry: (failureCount, error) => {
        if (error instanceof ApiError && [400, 401, 403, 404, 422].includes(error.status)) {
          return false;
        }

        return failureCount < 1;
      },

      refetchOnWindowFocus: false,
    },
  },
});
