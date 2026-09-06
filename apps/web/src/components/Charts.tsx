import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { Reading } from "../../../../packages/shared/src/index";
export function TelemetryChart({
  readings,
  field = "temperature",
  color = "#b79039",
  unit = "°C",
}: {
  readings: Reading[];
  field?: "temperature" | "humidity" | "weight";
  color?: string;
  unit?: string;
}) {
  return (
    <div
      className="chart-frame"
      aria-label={`${field} sensor history chart`}
      role="img"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={readings.slice(-56)}
          margin={{ top: 15, right: 12, left: -22, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`fill-${field}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#e9e9e2"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })
            }
            minTickGap={60}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#85877c" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#85877c" }}
            domain={["auto", "auto"]}
          />
          <Tooltip
            labelFormatter={(v) => new Date(String(v)).toLocaleString("en-IN")}
            formatter={(v) => [`${Number(v).toFixed(1)} ${unit}`, field]}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #e4e5dd",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey={field}
            stroke={color}
            strokeWidth={2}
            fill={`url(#fill-${field})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function DataBars({
  data,
  dataKey = "count",
  color = "#819675",
}: {
  data: Record<string, string | number>[];
  dataKey?: string;
  color?: string;
}) {
  return (
    <div
      className="chart-frame small-chart"
      role="img"
      aria-label="Records by category"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -25, top: 15, right: 10 }}>
          <CartesianGrid vertical={false} stroke="#e9e9e2" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
          />
          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Bar
            dataKey={dataKey}
            fill={color}
            radius={[5, 5, 0, 0]}
            maxBarSize={38}
            isAnimationActive={false}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={String(d.color ?? color)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
