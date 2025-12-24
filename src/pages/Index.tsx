import React, { useState } from "react";
import { ExpenseProvider } from "@/context/ExpenseContext";
import { BottomNavigation, TabId } from "@/components/BottomNavigation";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { AddExpenseModal } from "@/components/AddExpenseModal";
import { DashboardView } from "@/components/views/DashboardView";
import { MonthlyView } from "@/components/views/MonthlyView";
import { CompareView } from "@/components/views/CompareView";
import { TrendsView } from "@/components/views/TrendsView";
import { AnimatePresence, motion } from "framer-motion";
import { Expense } from "@/lib/data";

const Index: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  const handleEdit = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsAddModalOpen(true);
  };

  const renderView = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardView onEdit={handleEdit} />;
      case "monthly":
        return <MonthlyView onEdit={handleEdit} />;
      case "compare":
        return <CompareView />;
      case "trends":
        return <TrendsView />;
      default:
        return <DashboardView onEdit={handleEdit} />;
    }
  };

  return (
    <ExpenseProvider>
      <div className="min-h-screen bg-background">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>

        <FloatingActionButton onClick={() => {
          setExpenseToEdit(null);
          setIsAddModalOpen(true);
        }} />
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        <AddExpenseModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setExpenseToEdit(null);
          }}
          expenseToEdit={expenseToEdit || undefined}
        />
      </div>
    </ExpenseProvider>
  );
};

export default Index;
