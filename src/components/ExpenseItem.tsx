import React, { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Edit2, Globe } from "lucide-react";
import { Expense, getCategoryById, formatCurrency } from "@/lib/data";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useExpenses } from "@/context/ExpenseContext";
import { parseDateFromStorage } from "@/lib/dateUtils";
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

  const category = getCategoryById(expense.categoryId, customCategories);
  if (!category) return null;

  const Icon = category.icon;
  const expenseDate = parseDateFromStorage(expense.date);

  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const parseNoteDetails = (note?: string | null) => {
    if (!note) return { cleanedNote: "", isForeign: false, originalAmount: 0, originalCurrency: "" };
    const origIndex = note.indexOf(" | Original: ");
    let cleanedNote = note;
    cleanedNote = cleanedNote.replace("Imported from Statement (", "").replace(")", "");
    if (origIndex !== -1) {
      const origPart = note.substring(origIndex + " | Original: ".length);
      cleanedNote = note.substring(0, origIndex).replace("Imported from Statement (", "").replace(")", "");
      const parts = origPart.split(" ");
      return {
        cleanedNote,
        isForeign: true,
        originalAmount: parseFloat(parts[0]) || 0,
        originalCurrency: parts[1] || ""
      };
    }
    return { cleanedNote, isForeign: false, originalAmount: 0, originalCurrency: "" };
  };

  const { cleanedNote, isForeign, originalAmount, originalCurrency } = parseNoteDetails(expense.note);

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
          <div className="text-sm text-muted-foreground flex flex-col gap-0.5">
            {expense.subcategory && (
              <span>{expense.subcategory}</span>
            )}
            {cleanedNote && (
              <span className="text-xs text-muted-foreground/75 truncate">{cleanedNote}</span>
            )}
          </div>
        </div>
        <div className="text-right flex flex-col items-end shrink-0">
          <div className="font-semibold dirham-symbol">{formatCurrency(expense.amount)}</div>
          {isForeign && originalAmount > 0 && originalCurrency && (
            <div className="text-[10px] font-bold text-amber-600 dark:text-amber-500 flex items-center gap-0.5 mt-0.5">
              <Globe className="h-3 w-3 shrink-0" />
              <span>{originalCurrency} {originalAmount.toFixed(2)}</span>
            </div>
          )}
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
