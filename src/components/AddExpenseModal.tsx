import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Check, ChevronLeft, Calendar, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { categories, Category, formatCurrency } from "@/lib/data";
import { useExpenses } from "@/context/ExpenseContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseToEdit?: {
    id: string;
    categoryId: string;
    subcategory?: string;
    amount: number;
    date: string;
  };
}

type Step = 1 | 2 | 3;

const CATEGORY_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  expenseToEdit,
}) => {
  const [step, setStep] = useState<Step>(1);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [newSubcategory, setNewSubcategory] = useState("");
  const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { addExpense, updateExpense, customSubcategories, addCustomSubcategory, customCategories, addCustomCategory } = useExpenses();
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen && expenseToEdit) {
      const category = allCategories.find(c => c.id === expenseToEdit.categoryId) || null;
      setSelectedCategory(category);
      setSelectedSubcategory(expenseToEdit.subcategory || null);
      setAmount(Math.abs(expenseToEdit.amount).toString());
      setSelectedDate(new Date(expenseToEdit.date));
      setStep(3); // Go straight to amount step for editing
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, expenseToEdit]);

  const allCategories = [...categories, ...customCategories];

  const resetForm = () => {
    setStep(1);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setNewSubcategory("");
    setShowNewSubcategoryInput(false);
    setShowNewCategoryInput(false);
    setNewCategoryName("");
    setAmount("");
    setSelectedDate(new Date());
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    // All categories except Rent can have subcategories
    if (category.id !== "rent") {
      setStep(2);
    } else {
      setStep(3);
    }
  };

  const handleSubcategorySelect = (subcategory: string) => {
    setSelectedSubcategory(subcategory);
    setStep(3);
  };

  const handleAddNewSubcategory = async () => {
    if (newSubcategory.trim() && selectedCategory) {
      try {
        await addCustomSubcategory(selectedCategory.id, newSubcategory.trim());
        setSelectedSubcategory(newSubcategory.trim());
        setNewSubcategory("");
        setShowNewSubcategoryInput(false);
        setStep(3);
      } catch (error) {
        // Error is already toasted by the context
      }
    }
  };

  const handleNumberPress = (num: string) => {
    if (num === "." && amount.includes(".")) return;
    if (num === "." && amount === "") {
      setAmount("0.");
      return;
    }
    const [whole, decimal] = amount.split(".");
    if (decimal && decimal.length >= 2) return;
    setAmount(prev => prev + num);
  };

  const handleBackspace = () => {
    setAmount(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !amount || parseFloat(amount) === 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    let finalAmount = parseFloat(amount);
    if (selectedSubcategory === "Refund") {
      finalAmount = -Math.abs(finalAmount);
    } else {
      finalAmount = Math.abs(finalAmount);
    }

    try {
      if (expenseToEdit) {
        await updateExpense(expenseToEdit.id, {
          categoryId: selectedCategory.id,
          subcategory: selectedSubcategory || undefined,
          amount: finalAmount,
          date: selectedDate.toISOString(),
        });
        toast({
          title: "Expense updated",
          description: "Your expense has been updated successfully",
        });
      } else {
        await addExpense({
          categoryId: selectedCategory.id,
          subcategory: selectedSubcategory || undefined,
          amount: finalAmount,
          date: selectedDate.toISOString(),
        });
        toast({
          title: "Expense added",
          description: "Your expense has been added successfully",
        });
      }

      handleClose();
    } catch (error) {
      // Error is already toasted by the context
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setSelectedSubcategory(null);
      setStep(1);
    } else if (step === 3) {
      // All categories except Rent have subcategory step
      if (selectedCategory?.id !== "rent") {
        setStep(2);
      } else {
        setStep(1);
      }
    }
  };

  const getAllSubcategories = (): string[] => {
    if (!selectedCategory) return [];
    const baseSubcategories = selectedCategory.subcategories || [];
    const custom = customSubcategories[selectedCategory.id] || [];
    return [...baseSubcategories, ...custom];
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={handleBack} className="touch-target p-2 -ml-2">
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <h2 className="text-lg font-semibold">{expenseToEdit ? "Edit Expense" : "Add Expense"}</h2>
          </div>
          <button onClick={handleClose} className="touch-target p-2 -mr-2">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "progress-dot",
                step === s && "progress-dot-active",
                step > s && "progress-dot-completed"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          <AnimatePresence mode="wait">
            {/* Step 1: Category Selection */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-sm font-medium text-muted-foreground mb-4">
                  Select Category
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {allCategories.map((category) => {
                    const Icon = category.icon;
                    return (
                      <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category)}
                        className={cn(
                          "category-card h-28",
                          selectedCategory?.id === category.id && "category-card-selected"
                        )}
                      >
                        <div
                          className="h-12 w-12 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${category.color}20` }}
                        >
                          <Icon className="h-6 w-6" style={{ color: category.color }} />
                        </div>
                        <span className="text-sm font-medium">{category.name}</span>
                      </button>
                    );
                  })}
                  {!showNewCategoryInput && (
                    <button
                      onClick={() => setShowNewCategoryInput(true)}
                      className="category-card h-28 border-2 border-dashed border-primary/30"
                    >
                      <div className="h-12 w-12 rounded-full flex items-center justify-center bg-primary/10">
                        <Plus className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-primary">Add Category</span>
                    </button>
                  )}
                </div>
                {showNewCategoryInput && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2 mt-4"
                  >
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="New category name"
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      onClick={() => {
                        if (newCategoryName.trim()) {
                          const colorIndex = customCategories.length % CATEGORY_COLORS.length;
                          addCustomCategory(newCategoryName.trim(), CATEGORY_COLORS[colorIndex]);
                          setNewCategoryName("");
                          setShowNewCategoryInput(false);
                          toast({
                            title: "Category added",
                            description: `${newCategoryName.trim()} has been added`,
                          });
                        }
                      }}
                      size="icon"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setNewCategoryName("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Step 2: Subcategory Selection */}
            {step === 2 && selectedCategory && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${selectedCategory.color}20` }}
                  >
                    <selectedCategory.icon
                      className="h-4 w-4"
                      style={{ color: selectedCategory.color }}
                    />
                  </div>
                  <span className="font-medium">{selectedCategory.name}</span>
                </div>
                <h3 className="text-sm font-medium text-muted-foreground mb-4">
                  Select Subcategory
                </h3>
                <div className="flex flex-wrap gap-2">
                  {getAllSubcategories().map((sub) => (
                    <button
                      key={sub}
                      onClick={() => handleSubcategorySelect(sub)}
                      className={cn(
                        "subcategory-chip",
                        selectedSubcategory === sub && "subcategory-chip-selected"
                      )}
                    >
                      {sub}
                    </button>
                  ))}
                  {!showNewSubcategoryInput && (
                    <button
                      onClick={() => setShowNewSubcategoryInput(true)}
                      className="subcategory-chip border-2 border-dashed border-primary/30 text-primary inline-flex items-center whitespace-nowrap"
                    >
                      <Plus className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
                {showNewSubcategoryInput && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2 mt-4"
                  >
                    <Input
                      value={newSubcategory}
                      onChange={(e) => setNewSubcategory(e.target.value)}
                      placeholder="New subcategory name"
                      className="flex-1"
                      autoFocus
                    />
                    <Button onClick={handleAddNewSubcategory} size="icon">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowNewSubcategoryInput(false);
                        setNewSubcategory("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Step 3: Amount Entry */}
            {step === 3 && selectedCategory && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${selectedCategory.color}20` }}
                  >
                    <selectedCategory.icon
                      className="h-4 w-4"
                      style={{ color: selectedCategory.color }}
                    />
                  </div>
                  <span className="font-medium">{selectedCategory.name}</span>
                  {selectedSubcategory && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{selectedSubcategory}</span>
                    </>
                  )}
                </div>

                {/* Date Picker */}
                <div className="mb-6">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="mr-2 h-4 w-4" />
                        {format(selectedDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Amount Display */}
                <div className="text-center mb-8">
                  <div className="text-sm text-muted-foreground mb-1">Amount</div>
                  <div className="text-4xl font-bold">
                    <span className="dirham-symbol mr-1">ê</span>
                    {amount ? (
                      amount.includes(".")
                        ? parseInt(amount.split(".")[0] || "0").toLocaleString() + "." + amount.split(".")[1]
                        : parseInt(amount).toLocaleString()
                    ) : "0"}
                  </div>
                </div>

                {/* Numeric Keypad */}
                <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map(
                    (key) => (
                      <button
                        key={key}
                        onClick={() =>
                          key === "⌫" ? handleBackspace() : handleNumberPress(key)
                        }
                        className="numeric-key h-16"
                      >
                        {key}
                      </button>
                    )
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  className="w-full mt-6 h-14 text-lg font-semibold gradient-teal"
                  disabled={!amount || parseFloat(amount) === 0}
                >
                  {expenseToEdit ? "Update Expense" : "Add Expense"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
