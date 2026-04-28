import { createBrowserRouter, RouterProvider, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { MigrationsPage } from './pages/MigrationsPage';
import { MigrationDetailPage } from './pages/MigrationDetailPage';
import { ExecutionsPage } from './pages/ExecutionsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

function ErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred';

  return (
    <div className="mx-auto mt-16 max-w-xl px-4">
      <h1 className="mb-4 text-2xl font-semibold text-zinc-100">Something went wrong</h1>
      <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {message}
      </div>
      <button
        type="button"
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
        onClick={() => window.location.assign('/')}
      >
        Return to Dashboard
      </button>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/migrations', element: <MigrationsPage /> },
      { path: '/migrations/:id', element: <MigrationDetailPage /> },
      { path: '/executions', element: <ExecutionsPage /> },
      { path: '/executions/:id', element: <ExecutionsPage /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
