import React, { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Edit2 } from "lucide-react";
import { Expense, getCategoryById, formatCurrency } from "@/lib/data";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useExpenses } from "@/context/ExpenseContext";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExpenseItemProps {
  expense: Expense;
  onEdit?: (expense: Expense) => void;
}

export const ExpenseItem: React.FC<ExpenseItemProps> = ({ expense, onEdit }) => {
  const [showActions, setShowActions] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { deleteExpense, customCategories } = useExpenses();
  const { toast } = useToast();

  const category = getCategoryById(expense.categoryId, customCategories);
  if (!category) return null;

  const Icon = category.icon;
  const expenseDate = new Date(expense.date);

  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const handleLongPress = () => {
    setShowActions(true);
  };

  const handleDelete = async () => {
    try {
      await deleteExpense(expense.id);
      setShowDeleteDialog(false);
      setShowActions(false);
    } catch (error) {
      // Error is already toasted by the context
    }
  };

  const startPress = () => {
    const t = setTimeout(() => {
      handleLongPress();
      setTimer(null);
    }, 600);
    setTimer(t);
  };

  const cancelPress = () => {
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
  };

  return (
    <>
      <motion.div
        className={cn(
          "expense-item relative",
          showActions && "bg-secondary"
        )}
        onContextMenu={(e) => {
          e.preventDefault();
          handleLongPress();
        }}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        layout
      >
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${category.color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color: category.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{category.name}</div>
          <div className="text-sm text-muted-foreground">
            {expense.subcategory && (
              <span>{expense.subcategory}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold dirham-symbol">{formatCurrency(expense.amount)}</div>
        </div>

        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-card/95 backdrop-blur-sm rounded-xl flex items-center justify-center gap-4"
          >
            <button
              onClick={() => {
                if (onEdit) onEdit(expense);
                setShowActions(false);
              }}
              className="touch-target flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="touch-target flex items-center gap-2 px-4 py-2 rounded-full bg-destructive text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
            <button
              onClick={() => setShowActions(false)}
              className="touch-target px-4 py-2 rounded-full bg-secondary text-secondary-foreground"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </motion.div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this <span className="dirham-symbol">{formatCurrency(expense.amount)}</span> expense from {category.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
