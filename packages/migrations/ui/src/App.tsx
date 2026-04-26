import { createBrowserRouter, RouterProvider, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { theme } from './theme';
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
    <Box sx={{ p: 4, maxWidth: 600, mx: 'auto', mt: 8 }}>
      <Typography variant="h4" gutterBottom>
        Something went wrong
      </Typography>
      <Alert severity="error" sx={{ mb: 2 }}>
        {message}
      </Alert>
      <Button variant="contained" onClick={() => window.location.assign('/')}>
        Return to Dashboard
      </Button>
    </Box>
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
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
