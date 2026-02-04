import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { VibrationData } from '../App';

interface VibrationChartProps {
  data: VibrationData[];
  axis: 'x' | 'y' | 'z';
  color: string;
  title: string;
}

export function VibrationChart({ data, axis, color, title }: VibrationChartProps) {
  // Transform data for the chart
  const chartData = data.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
      hour12: false, 
      minute: '2-digit', 
      second: '2-digit' 
    }),
    value: point[axis],
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{title}</span>
          <div 
            className="size-3 rounded-full" 
            style={{ backgroundColor: color }}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-4 px-2">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(0,0,0,0.1)" 
              vertical={false}
            />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 10 }}
              stroke="rgba(0,0,0,0.3)"
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fontSize: 10 }}
              stroke="rgba(0,0,0,0.3)"
              tickLine={false}
              domain={[0, 10]}
              label={{ 
                value: 'm/s²', 
                angle: -90, 
                position: 'insideLeft',
                style: { fontSize: 10, fill: 'rgba(0,0,0,0.5)' }
              }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '8px',
                fontSize: '12px',
                padding: '8px 12px'
              }}
              labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
              formatter={(value: number) => [`${value.toFixed(2)} m/s²`, 'Vibration']}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
