import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

interface SummaryCardProps {
  label: string;
  count: number;
  color?: string;
}

export function SummaryCard({ label, count, color }: SummaryCardProps) {
  return (
    <Card sx={{ minWidth: 160, flex: 1 }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h3" sx={{ color: color ?? 'text.primary', fontWeight: 600 }}>
          {count}
        </Typography>
      </CardContent>
    </Card>
  );
}
