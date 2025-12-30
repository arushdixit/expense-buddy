import React, { useState } from "react";
import { motion } from "framer-motion";
import { Download, FileUp, Layers } from "lucide-react";
import { useExpenses } from "@/context/ExpenseContext";
import {
  formatCurrency,
  getShortMonthName,
  getExpensesByMonth,
  categories,
} from "@/lib/data";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

export const TrendsView: React.FC = () => {
  const { expenses, customCategories } = useExpenses();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const now = new Date();

  const allCategories = [...categories, ...customCategories];

  // Filter expenses by category if one is selected
  const filteredExpenses = selectedCategoryId
    ? expenses.filter((exp) => exp.categoryId === selectedCategoryId)
    : expenses;

  // Get last 6 months data
  let monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthExpenses = getExpensesByMonth(
      filteredExpenses,
      date.getFullYear(),
      date.getMonth()
    );
    const total = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    monthlyData.push({
      month: getShortMonthName(date.getMonth()),
      fullMonth: `${getShortMonthName(date.getMonth())} ${date.getFullYear()}`,
      total,
      count: monthExpenses.length,
    });
  }

  // Filter out months with no data
  monthlyData = monthlyData.filter(m => m.count > 0);

  const avgSpending =
    monthlyData.length > 0
      ? monthlyData.reduce((sum, m) => sum + m.total, 0) / monthlyData.length
      : 0;
  const maxSpending = monthlyData.length > 0 ? Math.max(...monthlyData.map((m) => m.total)) : 0;
  const minSpending = monthlyData.length > 0 ? Math.min(...monthlyData.map((m) => m.total)) : 0;

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="font-medium">{payload[0].payload.fullMonth}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(payload[0].value)}
          </p>
          <p className="text-xs text-muted-foreground">
            {payload[0].payload.count} expenses
          </p>
        </div>
      );
    }
    return null;
  };

  const handleExport = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    window.open(`${apiUrl.replace('/api', '')}/api/export`, '_blank');
  };

  return (
    <div className="pb-24 px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-6 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">Spending Trends</h1>
          <p className="text-muted-foreground">Last 6 months overview</p>
        </div>
        <button
          onClick={handleExport}
          className="touch-target p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          title="Export CSV"
        >
          <Download className="h-6 w-6" />
        </button>
      </motion.div>

      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="flex overflow-x-auto pb-4 gap-2 no-scrollbar -mx-4 px-4"
      >
        <button
          onClick={() => setSelectedCategoryId(null)}
          className={cn(
            "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all",
            !selectedCategoryId
              ? "bg-primary text-primary-foreground shadow-md scale-105"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          All
        </button>
        {allCategories.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategoryId === category.id;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategoryId(category.id)}
              className={cn(
                "flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                isSelected
                  ? "shadow-md scale-105"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
              style={
                isSelected
                  ? {
                    backgroundColor: category.color,
                    color: "white",
                  }
                  : {}
              }
            >
              <Icon className="h-4 w-4" />
              {category.name}
            </button>
          );
        })}
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Average</p>
          <p className="font-bold text-sm dirham-symbol">{formatCurrency(avgSpending)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Highest</p>
          <p className="font-bold text-sm text-destructive dirham-symbol">
            {formatCurrency(maxSpending)}
          </p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Lowest</p>
          <p className="font-bold text-sm text-success dirham-symbol">
            {formatCurrency(minSpending)}
          </p>
        </Card>
      </motion.div>

      {/* Line Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Monthly Spending</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fill="url(#colorTotal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </motion.div>

      {/* Monthly Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6"
      >
        <h3 className="font-semibold mb-4">Monthly Summary</h3>
        <div className="space-y-2">
          {[...monthlyData].reverse().map((month, index) => (
            <Card key={month.fullMonth} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{month.fullMonth}</p>
                  <p className="text-sm text-muted-foreground">
                    {month.count} expenses
                  </p>
                </div>
                <p className="font-bold text-lg dirham-symbol">{formatCurrency(month.total)}</p>
              </div>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(month.total / maxSpending) * 100}%`,
                  }}
                  transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                  className="h-full gradient-teal rounded-full"
                />
              </div>
            </Card>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
