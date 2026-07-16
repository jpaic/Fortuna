import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, matchByDataKey } from "recharts";
import { colorForExpense } from "../../lib/chartColors";
import { expenseLabel } from "../../lib/expenseLabels";
import { ChartLegend } from "./ChartLegend";
import { sortedDonut, tooltipStyle, useSmoothDonutData, DONUT_TRANSITION_MS } from "./pieUtils";

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

export function ExpenseBreakdown({ data, currency = "EUR" }: Props) {
  const smoothed = useSmoothDonutData(data);
  const sorted = sortedDonut(smoothed);

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
            isAnimationActive
            animationBegin={0}
            animationDuration={DONUT_TRANSITION_MS}
            animationEasing="ease-out"
            animationMatchBy={matchByDataKey("category")}
          >
            {sorted.map((entry) => (
              <Cell key={entry.category} fill={colorForExpense(entry.category)} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            {...tooltipStyle}
            formatter={(_value, _name, entry) => {
              const d = entry.payload as Props["data"][number];
              return [`${fmt(d.value, currency)} (${d.percent}%)`, expenseLabel(d.category)];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ChartLegend
        items={sorted.map((d) => ({ ...d, color: colorForExpense(d.category) }))}
        currency={currency}
        labelFn={expenseLabel}
      />
    </div>
  );
}
