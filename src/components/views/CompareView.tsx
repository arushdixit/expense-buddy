import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useExpenses } from "@/context/ExpenseContext";
import {
  formatCurrency,
  getMonthName,
  getShortMonthName,
  calculateCategoryTotals,
  getExpensesByMonth,
  categories,
} from "@/lib/data";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const CompareView: React.FC = () => {
  const { expenses, customCategories } = useExpenses();
  const now = new Date();

  const allCategories = [...categories, ...customCategories];

  const [month1, setMonth1] = useState({
    month: now.getMonth() === 0 ? 11 : now.getMonth() - 1,
    year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
  });

  const [month2, setMonth2] = useState({
    month: now.getMonth(),
    year: now.getFullYear(),
  });

  const expenses1 = getExpensesByMonth(expenses, month1.year, month1.month);
  const expenses2 = getExpensesByMonth(expenses, month2.year, month2.month);

  const totals1 = calculateCategoryTotals(expenses1);
  const totals2 = calculateCategoryTotals(expenses2);

  const total1 = expenses1.reduce((sum, exp) => sum + exp.amount, 0);
  const total2 = expenses2.reduce((sum, exp) => sum + exp.amount, 0);

  const totalDiff = total2 - total1;
  const totalDiffPercent = total1 > 0 ? ((total2 - total1) / total1) * 100 : 0;

  const navigateMonth = (
    setter: React.Dispatch<React.SetStateAction<{ month: number; year: number }>>,
    direction: "prev" | "next"
  ) => {
    setter((prev) => {
      if (direction === "prev") {
        if (prev.month === 0) {
          return { month: 11, year: prev.year - 1 };
        }
        return { month: prev.month - 1, year: prev.year };
      } else {
        // Don't go beyond current month
        const isCurrentMonth =
          prev.month === now.getMonth() && prev.year === now.getFullYear();
        if (isCurrentMonth) return prev;

        if (prev.month === 11) {
          return { month: 0, year: prev.year + 1 };
        }
        return { month: prev.month + 1, year: prev.year };
      }
    });
  };

  const CategoryComparison = ({ categoryId }: { categoryId: string }) => {
    const cat = allCategories.find((c) => c.id === categoryId);
    if (!cat) return null;

    const val1 = totals1[categoryId] || 0;
    const val2 = totals2[categoryId] || 0;

    if (val1 === 0 && val2 === 0) return null;

    const diff = val2 - val1;
    const diffPercent = val1 > 0 ? ((val2 - val1) / val1) * 100 : val2 > 0 ? 100 : 0;

    const Icon = cat.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 py-3 border-b border-border last:border-0"
      >
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${cat.color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color: cat.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium">{cat.name}</div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground dirham-symbol">
            <span>{formatCurrency(val1)}</span>
            <span className="font-sans">→</span>
            <span>{formatCurrency(val2)}</span>
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              "flex items-center gap-1 font-semibold",
              diff > 0 ? "comparison-indicator-up" : diff < 0 ? "comparison-indicator-down" : ""
            )}
          >
            {diff > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : diff < 0 ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            <span>{Math.abs(diffPercent).toFixed(0)}%</span>
          </div>
          <div
            className={cn(
              "text-sm dirham-symbol",
              diff > 0 ? "text-destructive" : diff < 0 ? "text-success" : "text-muted-foreground"
            )}
          >
            {diff > 0 ? "+" : ""}{formatCurrency(diff)}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="pb-24 px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-6"
      >
        <h1 className="text-2xl font-bold">Compare Months</h1>
        <p className="text-muted-foreground">See how your spending changed</p>
      </motion.div>

      {/* Month Selectors */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateMonth(setMonth1, "prev")}
              className="touch-target p-1"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">From</p>
              <p className="font-semibold">
                {getShortMonthName(month1.month)} {month1.year}
              </p>
            </div>
            <button
              onClick={() => navigateMonth(setMonth1, "next")}
              className="touch-target p-1"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateMonth(setMonth2, "prev")}
              className="touch-target p-1"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">To</p>
              <p className="font-semibold">
                {getShortMonthName(month2.month)} {month2.year}
              </p>
            </div>
            <button
              onClick={() => navigateMonth(setMonth2, "next")}
              className="touch-target p-1"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </Card>
      </div>

      {/* Total Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Difference</p>
              <p className="text-2xl font-bold dirham-symbol">{formatCurrency(Math.abs(totalDiff))}</p>
            </div>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold",
                totalDiff > 0
                  ? "bg-destructive/10 text-destructive"
                  : totalDiff < 0
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {totalDiff > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : totalDiff < 0 ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              <span>
                {totalDiff > 0 ? "+" : ""}
                {totalDiffPercent.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground dirham-symbol">
            <span>{getShortMonthName(month1.month)}: {formatCurrency(total1)}</span>
            <span className="font-sans">→</span>
            <span>{getShortMonthName(month2.month)}: {formatCurrency(total2)}</span>
          </div>
        </Card>
      </motion.div>

      {/* Category Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-semibold mb-4">By Category</h3>
        <Card className="p-4">
          {allCategories.map((cat) => (
            <CategoryComparison key={cat.id} categoryId={cat.id} />
          ))}
        </Card>
      </motion.div>
    </div>
  );
};
