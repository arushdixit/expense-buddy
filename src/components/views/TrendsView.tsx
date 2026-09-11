import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, ChevronDown, ChevronRight, Calendar } from "lucide-react";
import { useExpenses } from "@/context/ExpenseContext";
import {
  formatCurrency,
  getMonthName,
  getShortMonthName,
  getExpensesByMonth,
  categories,
} from "@/lib/data";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface TrendsViewProps {
  onNavigateToMonth?: (year: number, month: number) => void;
}

export const TrendsView: React.FC<TrendsViewProps> = ({ onNavigateToMonth }) => {
  const { expenses, customCategories } = useExpenses();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});
  const now = new Date();

  const allCategories = [...categories, ...customCategories];

  // Filter expenses by category if one is selected
  const filteredExpenses = selectedCategoryId
    ? expenses.filter((exp) => exp.categoryId === selectedCategoryId)
    : expenses;

  // ─── 1. Last 12 months data for the charts (kept unchanged) ───
  let monthlyData = [];
  for (let i = 11; i >= 0; i--) {
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

  // Filter out months with no data for the chart calculations
  monthlyData = monthlyData.filter((m) => m.count > 0);

  const avgSpending =
    monthlyData.length > 0
      ? monthlyData.reduce((sum, m) => sum + m.total, 0) / monthlyData.length
      : 0;
  const maxSpending = monthlyData.length > 0 ? Math.max(...monthlyData.map((m) => m.total)) : 0;
  const minSpending = monthlyData.length > 0 ? Math.min(...monthlyData.map((m) => m.total)) : 0;

  // ─── 2. Full historical yearly & monthly summary ───
  const yearlySummary = useMemo(() => {
    const yearMap = new Map<number, {
      year: number;
      total: number;
      count: number;
    }>();

    filteredExpenses.forEach((exp) => {
      if (!exp.date) return;
      const parts = exp.date.split("-");
      if (parts.length !== 3) return;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      if (isNaN(year) || isNaN(month) || month < 0 || month > 11) return;

      let yData = yearMap.get(year);
      if (!yData) {
        yData = { year, total: 0, count: 0 };
        yearMap.set(year, yData);
      }
      yData.total += exp.amount;
      yData.count += 1;
    });

    // Sort years descending (most recent first)
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b - a);

    return sortedYears.map((year) => {
      const yData = yearMap.get(year)!;
      const monthsList: {
        monthIndex: number;
        monthName: string;
        shortMonth: string;
        fullMonth: string;
        total: number;
        count: number;
      }[] = [];

      // Check all months (December down to January)
      for (let m = 11; m >= 0; m--) {
        const monthExpenses = getExpensesByMonth(filteredExpenses, year, m);
        if (monthExpenses.length > 0) {
          const total = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
          monthsList.push({
            monthIndex: m,
            monthName: getMonthName(m),
            shortMonth: getShortMonthName(m),
            fullMonth: `${getMonthName(m)} ${year}`,
            total,
            count: monthExpenses.length,
          });
        }
      }

      return {
        year,
        total: yData.total,
        count: yData.count,
        months: monthsList,
      };
    });
  }, [filteredExpenses]);

  // Auto-expand the most recent year initially
  useEffect(() => {
    if (yearlySummary.length > 0) {
      setExpandedYears((prev) => {
        if (Object.keys(prev).length === 0) {
          return { [yearlySummary[0].year]: true };
        }
        return prev;
      });
    }
  }, [yearlySummary]);

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { fullMonth: string; count: number } }> }) => {
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
          <p className="text-muted-foreground">Last 12 months overview</p>
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

      {/* Stats Cards (Last 12 Months) */}
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

      {/* Line Chart (Last 12 Months) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Monthly Spending (Last 12 Months)</h3>
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

      {/* Monthly Breakdown by Year */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Monthly Summary</h3>
          {onNavigateToMonth && (
            <span className="text-xs text-muted-foreground">Tap any month to view details</span>
          )}
        </div>

        {yearlySummary.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No expenses found for the selected filter.
          </Card>
        ) : (
          <div className="space-y-3">
            {yearlySummary.map((yearData) => {
              const isExpanded = !!expandedYears[yearData.year];
              const maxMonthInYear =
                yearData.months.length > 0
                  ? Math.max(...yearData.months.map((m) => m.total))
                  : 1;

              return (
                <Card
                  key={yearData.year}
                  className="overflow-hidden border border-border/80 bg-card shadow-sm transition-all"
                >
                  {/* Year Header Accordion */}
                  <button
                    type="button"
                    onClick={() => toggleYear(yearData.year)}
                    className="w-full p-4 flex items-center justify-between text-left transition-colors hover:bg-muted/40 focus:outline-none select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          isExpanded
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-foreground tracking-tight">
                          {yearData.year}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {yearData.count} {yearData.count === 1 ? "expense" : "expenses"} • {yearData.months.length} {yearData.months.length === 1 ? "month" : "months"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-base md:text-lg dirham-symbol text-foreground">
                          {formatCurrency(yearData.total)}
                        </p>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                          Yearly Total
                        </p>
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-muted-foreground"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </motion.div>
                    </div>
                  </button>

                  {/* Expanded Months List */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 pt-0 border-t border-border/40 space-y-2 bg-muted/15">
                          {yearData.months.map((month, index) => {
                            const percentage =
                              maxMonthInYear > 0 ? (month.total / maxMonthInYear) * 100 : 0;
                            return (
                              <div
                                key={month.fullMonth}
                                onClick={() =>
                                  onNavigateToMonth?.(yearData.year, month.monthIndex)
                                }
                                className={cn(
                                  "p-3 rounded-lg border border-border/50 bg-card transition-all",
                                  onNavigateToMonth
                                    ? "cursor-pointer hover:border-primary/50 hover:bg-primary/[0.04] active:scale-[0.99] group shadow-xs"
                                    : ""
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                                        {month.monthName}
                                      </p>
                                      {onNavigateToMonth && (
                                        <span className="text-[10px] text-primary/70 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                                          View in Monthly &rarr;
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {month.count} {month.count === 1 ? "expense" : "expenses"}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-sm md:text-base dirham-symbol text-foreground">
                                      {formatCurrency(month.total)}
                                    </p>
                                    {onNavigateToMonth && (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                    )}
                                  </div>
                                </div>

                                {/* Progress bar inside month */}
                                <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{
                                      delay: 0.05 + index * 0.03,
                                      duration: 0.4,
                                    }}
                                    className="h-full gradient-teal rounded-full"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};
