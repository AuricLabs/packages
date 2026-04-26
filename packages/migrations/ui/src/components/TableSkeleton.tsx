import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

interface TableSkeletonProps {
  rows?: number;
}

export function TableSkeleton({ rows = 8 }: TableSkeletonProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Skeleton variant="rectangular" height={40} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={36} />
      ))}
    </Box>
  );
}
