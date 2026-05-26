import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';

import { useFavoritesBootstrap } from '../entities/favorites/hooks';
import { useRemotePreferencesBootstrap } from '../entities/preferences/hooks';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ServerStateBootstrap />
      {children}
    </QueryClientProvider>
  );
}

function ServerStateBootstrap() {
  useRemotePreferencesBootstrap();
  useFavoritesBootstrap();
  return null;
}
