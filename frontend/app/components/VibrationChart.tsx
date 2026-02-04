
'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

interface VibrationData {
    timestamp: number;
    X: number;
    Y: number;
    Z: number;
}

interface VibrationChartProps {
    data: VibrationData[];
    axis: 'x' | 'y' | 'z';
    color: string;
    title: string;
}

export function VibrationChart({ data, axis, color, title }: VibrationChartProps) {
    // Map lowercase axis to capital dataKey
    const dataKey = axis.toUpperCase() as 'X' | 'Y' | 'Z';

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">
                {title}
            </h3>

            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                            dataKey="timestamp"
                            hide={true}
                        />
                        <YAxis
                            domain={[-15, 15]}
                            hide={true}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '12px'
                            }}
                            labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                            formatter={(value: number) => [value.toFixed(2) + ' m/s²', 'Vibration']}
                        />
                        <Line
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
