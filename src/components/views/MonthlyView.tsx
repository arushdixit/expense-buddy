import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Filter, FilterX } from "lucide-react";
import { useExpenses } from "@/context/ExpenseContext";
import {
  formatCurrency,
  getMonthName,
  calculateCategoryTotals,
  calculateSubcategoryTotals,
  getExpensesByMonth,
  categories,
} from "@/lib/data";
import { format, isToday, isYesterday } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/components/ui/drawer";
import { ExpenseItem } from "@/components/ExpenseItem";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const allCategories = [...categories, ...customCategories];

  const monthlyExpenses = getExpensesByMonth(expenses, currentYear, currentMonth);
  const categoryTotals = calculateCategoryTotals(monthlyExpenses);
  const totalSpent = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const selectedCategory = allCategories.find(c => c.id === selectedCategoryId);

  const chartData = selectedCategoryId
    ? Object.entries(calculateSubcategoryTotals(monthlyExpenses.filter(e => e.categoryId === selectedCategoryId)))
      .map(([name, value]) => ({
        name,
        value,
        color: selectedCategory?.color || "hsl(var(--primary))",
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
    : allCategories
      .map((cat) => ({
        name: cat.name,
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
          <p className="text-3xl font-bold dirham-symbol">{formatCurrency(totalSpent)}</p>
        </Card>

        {/* Bar Chart */}
        {chartData.length > 0 && (
          <Card className="p-4 mb-6">
            <h3 className="font-semibold mb-4 text-primary italic">
              {selectedCategoryId
                ? `Spending by ${selectedCategory?.name} Subcategories`
                : "Spending by Category"}
            </h3>
            <div style={{ height: `${chartData.length * 32}px`, minHeight: chartData.length > 0 ? '60px' : '0px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ right: 0, left: 0 }}
                >
                  <XAxis type="number" hide domain={[0, "dataMax"]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                    tickMargin={10}
                    axisLine={false}
                    tickLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 0.7 }}
                    interval={0}
                  />

                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="value"
                      content={(props: any) => {
                        const { x, y, width, height, value } = props;
                        const formattedValue = `ê ${Math.round(value).toLocaleString()}`;
                        // If the bar is long (at least 60% of max width), put label inside
                        const isLong = width > 120;
                        return (
                          <text
                            x={isLong ? x + width - 8 : x + width + 8}
                            y={y + height / 2}
                            fill={isLong ? "#fff" : "hsl(var(--foreground))"}
                            textAnchor={isLong ? "end" : "start"}
                            dominantBaseline="middle"
                            style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              fontFamily: "UAESymbol, sans-serif"
                            }}
                          >
                            {formattedValue}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Expenses List */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">All Expenses</h3>

            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (selectedCategoryId) {
                    setSelectedCategoryId(null);
                  } else {
                    setIsDrawerOpen(true);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full border transition-colors touch-target bg-background",
                  selectedCategoryId
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "border-border text-foreground hover:bg-secondary"
                )}
              >
                {selectedCategoryId ? (
                  <>
                    <FilterX className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {allCategories.find(c => c.id === selectedCategoryId)?.name}
                    </span>
                  </>
                ) : (
                  <>
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-medium">Filter</span>
                  </>
                )}
              </motion.button>
              <DrawerContent>
                <DrawerHeader className="border-b pb-4">
                  <div className="flex items-center justify-between">
                    <DrawerTitle>Filter by Category</DrawerTitle>
                    <DrawerClose asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCategoryId(null)}
                        className="text-primary font-medium"
                      >
                        Clear All
                      </Button>
                    </DrawerClose>
                  </div>
                </DrawerHeader>
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-1 gap-2">
                    {allCategories
                      .map(cat => ({ ...cat, total: categoryTotals[cat.id] || 0 }))
                      .sort((a, b) => b.total - a.total)
                      .map((cat) => (
                        <DrawerClose key={cat.id} asChild>
                          <button
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl transition-colors text-left",
                              selectedCategoryId === cat.id ? "bg-primary/10" : "hover:bg-secondary"
                            )}
                          >
                            <div
                              className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${cat.color}20` }}
                            >
                              <cat.icon className="h-5 w-5" style={{ color: cat.color }} />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-medium text-foreground">{cat.name}</p>
                              <p className="text-xs text-muted-foreground dirham-symbol">
                                {formatCurrency(cat.total)} spent
                              </p>
                            </div>
                            {selectedCategoryId === cat.id && (
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </button>
                        </DrawerClose>
                      ))}
                  </div>
                </div>
                <div className="p-4 border-t">
                  <DrawerClose asChild>
                    <Button className="w-full py-6 rounded-xl text-lg font-semibold">Done</Button>
                  </DrawerClose>
                </div>
              </DrawerContent>
            </Drawer>
          </div>

          {(selectedCategoryId
            ? monthlyExpenses.filter(exp => exp.categoryId === selectedCategoryId)
            : monthlyExpenses).length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No expenses this month</p>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(
                (selectedCategoryId
                  ? monthlyExpenses.filter(exp => exp.categoryId === selectedCategoryId)
                  : monthlyExpenses
                ).reduce((groups, expense) => {
                  const date = format(new Date(expense.date), "yyyy-MM-dd");
                  if (!groups[date]) groups[date] = [];
                  groups[date].push(expense);
                  return groups;
                }, {} as Record<string, Expense[]>)
              )
                .sort((a, b) => b[0].localeCompare(a[0])) // Sort dates descending
                .map(([dateStr, items]) => {
                  const date = new Date(dateStr);
                  let dateHeader = format(date, "EEEE, d MMM");
                  if (isToday(date)) dateHeader = "Today";
                  else if (isYesterday(date)) dateHeader = "Yesterday";

                  return (
                    <div key={dateStr} className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase">
                          {dateHeader}
                        </span>
                        <div className="h-[1px] flex-1 bg-border/40" />
                      </div>
                      <div className="space-y-1">
                        {items.map((expense) => (
                          <ExpenseItem key={expense.id} expense={expense} onEdit={onEdit} />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
