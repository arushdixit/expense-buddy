import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useExpenses } from "@/context/ExpenseContext";
import {
  formatCurrency,
  getMonthName,
  calculateCategoryTotals,
  getExpensesByMonth,
  categories,
} from "@/lib/data";
import { Card } from "@/components/ui/card";
import { ExpenseItem } from "@/components/ExpenseItem";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { Expense } from "@/lib/data";

interface MonthlyViewProps {
  onEdit?: (expense: Expense) => void;
}

export const MonthlyView: React.FC<MonthlyViewProps> = ({ onEdit }) => {
  const { expenses, customCategories } = useExpenses();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  const allCategories = [...categories, ...customCategories];

  const monthlyExpenses = getExpensesByMonth(expenses, currentYear, currentMonth);
  const categoryTotals = calculateCategoryTotals(monthlyExpenses);
  const totalSpent = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const chartData = allCategories
    .map((cat) => ({
      name: cat.name.substring(0, 4),
      fullName: cat.name,
      value: categoryTotals[cat.id] || 0,
      color: cat.color,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const goToNextMonth = () => {
    const isCurrentMonth =
      currentMonth === now.getMonth() && currentYear === now.getFullYear();
    if (isCurrentMonth) return;

    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const isCurrentMonth =
    currentMonth === now.getMonth() && currentYear === now.getFullYear();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="font-medium">{payload[0].payload.fullName}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="pb-24 px-4">
      {/* Month Selector */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center gap-4 py-6"
      >
        <button
          onClick={goToPreviousMonth}
          className="touch-target p-2 rounded-full hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="month-selector min-w-[180px] justify-center">
          <span className="font-semibold">
            {getMonthName(currentMonth)} {currentYear}
          </span>
        </div>
        <button
          onClick={goToNextMonth}
          className={`touch-target p-2 rounded-full hover:bg-secondary transition-colors ${isCurrentMonth ? "opacity-30 pointer-events-none" : ""
            }`}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </motion.div>

      {/* Total */}
      <motion.div
        key={`${currentMonth}-${currentYear}`}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Card className="stat-card mb-6">
          <p className="text-sm opacity-80 mb-1">Monthly Total</p>
          <p className="text-3xl font-bold">{formatCurrency(totalSpent)}</p>
        </Card>

        {/* Bar Chart */}
        {chartData.length > 0 && (
          <Card className="p-4 mb-6">
            <h3 className="font-semibold mb-4">Spending by Category</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={45}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Expenses List */}
        <div>
          <h3 className="font-semibold mb-4">All Expenses</h3>
          {monthlyExpenses.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No expenses this month</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {monthlyExpenses.map((expense) => (
                <ExpenseItem key={expense.id} expense={expense} onEdit={onEdit} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
