import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { categories, formatCurrency, Category } from "@/lib/data";
import { useExpenses } from "@/context/ExpenseContext";

interface CategoryPieChartProps {
  categoryTotals: Record<string, number>;
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  categoryTotals,
}) => {
  const { customCategories } = useExpenses();
  const allCategories = [...categories, ...customCategories];
  
  const data = allCategories
    .map((cat) => ({
      name: cat.name,
      value: categoryTotals[cat.id] || 0,
      color: cat.color,
    }))
    .filter((item) => item.value > 0);

  if (data.length === 0) {
    return (
      <div className="chart-container flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No expenses yet</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
