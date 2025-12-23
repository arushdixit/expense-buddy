import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Check, ChevronLeft, Calendar } from "lucide-react";
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
}

type Step = 1 | 2 | 3;

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [step, setStep] = useState<Step>(1);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [newSubcategory, setNewSubcategory] = useState("");
  const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const { addExpense, customSubcategories, addCustomSubcategory } = useExpenses();
  const { toast } = useToast();

  const resetForm = () => {
    setStep(1);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setNewSubcategory("");
    setShowNewSubcategoryInput(false);
    setAmount("");
    setSelectedDate(new Date());
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    if (category.subcategories && category.subcategories.length > 0) {
      setStep(2);
    } else {
      setStep(3);
    }
  };

  const handleSubcategorySelect = (subcategory: string) => {
    setSelectedSubcategory(subcategory);
    setStep(3);
  };

  const handleAddNewSubcategory = () => {
    if (newSubcategory.trim() && selectedCategory) {
      addCustomSubcategory(selectedCategory.id, newSubcategory.trim());
      setSelectedSubcategory(newSubcategory.trim());
      setNewSubcategory("");
      setShowNewSubcategoryInput(false);
      setStep(3);
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

  const handleSubmit = () => {
    if (!selectedCategory || !amount || parseFloat(amount) === 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    addExpense({
      categoryId: selectedCategory.id,
      subcategory: selectedSubcategory || undefined,
      amount: parseFloat(amount),
      date: selectedDate.toISOString(),
    });

    toast({
      title: "Expense added",
      description: `${formatCurrency(parseFloat(amount))} added to ${selectedCategory.name}`,
    });

    handleClose();
  };

  const handleBack = () => {
    if (step === 2) {
      setSelectedSubcategory(null);
      setStep(1);
    } else if (step === 3) {
      if (selectedCategory?.subcategories && selectedCategory.subcategories.length > 0) {
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
            <h2 className="text-lg font-semibold">Add Expense</h2>
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
                  {categories.map((category) => {
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
                </div>
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
                      className="subcategory-chip border-2 border-dashed border-primary/30 text-primary"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
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
                    <span className="text-muted-foreground mr-1">AED</span>
                    {amount || "0.00"}
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
                  Add Expense
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
