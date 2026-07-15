import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { colorForInvestment } from "../../lib/chartColors";
import { ChartLegend } from "./ChartLegend";
import { sortedDonut, tooltipStyle } from "./pieUtils";

interface Props {
  data: { category: string; value: number; percent: number }[];
  currency?: string;
}

const fmt = (n: number, c: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: c,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const labelize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function InvestmentBreakdown({ data, currency = "EUR" }: Props) {
  const sorted = sortedDonut(data);

  return (
    <div className="flex flex-col">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={sorted}
            dataKey="value"
            nameKey="category"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {sorted.map((entry) => (
              <Cell key={entry.category} fill={colorForInvestment(entry.category)} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            {...tooltipStyle}
            formatter={(_value, _name, entry) => {
              const d = entry.payload as Props["data"][number];
              return [`${fmt(d.value, currency)} (${d.percent}%)`, labelize(d.category)];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ChartLegend
        items={sorted.map((d) => ({ ...d, color: colorForInvestment(d.category) }))}
        currency={currency}
      />
    </div>
  );
}
