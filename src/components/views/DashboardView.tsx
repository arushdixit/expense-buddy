import React from "react";
import { motion } from "framer-motion";
import { useExpenses } from "@/context/ExpenseContext";
import {
  formatCurrency,
  getMonthName,
  calculateCategoryTotals,
  getExpensesByMonth,
  categories
} from "@/lib/data";
import { CategoryPieChart } from "@/components/CategoryPieChart";
import { ExpenseItem } from "@/components/ExpenseItem";
import { Card } from "@/components/ui/card";

import { Expense } from "@/lib/data";

interface DashboardViewProps {
  onEdit?: (expense: Expense) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onEdit }) => {
  const { expenses, customCategories } = useExpenses();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const allCategories = [...categories, ...customCategories];

  const monthlyExpenses = getExpensesByMonth(expenses, currentYear, currentMonth);
  const categoryTotals = calculateCategoryTotals(monthlyExpenses);
  const totalSpent = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const recentExpenses = monthlyExpenses.slice(0, 5);

  const sortedCategories = allCategories
    .map(cat => ({ ...cat, total: categoryTotals[cat.id] || 0 }))
    .filter(cat => cat.total > 0)
    .sort((a, b) => b.total - a.total);

  const positiveTotal = sortedCategories.reduce((sum, cat) => sum + cat.total, 0);

  return (
    <div className="pb-24 px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-6"
      >
        <h1 className="text-2xl font-bold">{getMonthName(currentMonth)} {currentYear}</h1>
        <p className="text-muted-foreground">Track your expenses</p>
      </motion.div>

      {/* Total Spent Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="stat-card mb-6">
          <p className="text-sm opacity-80 mb-1">Total Spent</p>
          <p className="text-3xl font-bold">{formatCurrency(totalSpent)}</p>
          <p className="text-sm opacity-70 mt-2">
            {monthlyExpenses.length} expenses this month
          </p>
        </Card>
      </motion.div>

      {/* Category Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <h2 className="text-lg font-semibold mb-4">Category Breakdown</h2>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <CategoryPieChart categoryTotals={categoryTotals} />
            <div className="flex-1 space-y-2">
              {sortedCategories.slice(0, 4).map((cat) => {
                const Icon = cat.icon;
                const percentage = positiveTotal > 0 ? (cat.total / positiveTotal) * 100 : 0;
                return (
                  <div key={cat.id} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm flex-1 truncate">{cat.name}</span>
                    <span className="text-sm font-medium">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Recent Expenses */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Expenses</h2>
        </div>
        {recentExpenses.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No expenses this month</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tap the + button to add your first expense
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentExpenses.map((expense) => (
              <ExpenseItem key={expense.id} expense={expense} onEdit={onEdit} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};
