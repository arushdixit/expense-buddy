import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExpenses } from "@/context/ExpenseContext";
import { ParsedTransaction, addStatementRecord } from "@/lib/statementParser";
import { categories, formatCurrency, Expense, getCategoryById } from "@/lib/data";
import {
  FileUp, Loader2, CheckCircle2, Trash2, Filter,
  Database, RefreshCw, X, Check, Calendar, ArrowRightLeft,
  ChevronDown, Search, AlertCircle, Globe
} from "lucide-react";
import { toast } from "sonner";

const parseNoteDetails = (note?: string | null) => {
  if (!note) return { cleanedNote: "No Details", isForeign: false, originalAmount: 0, originalCurrency: "" };
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

export const ImportView: React.FC = () => {
  const {
    backupExpenses,
    customCategories,
    customSubcategories,
    bulkAddBackupExpenses,
    deleteBackupExpense,
    mergeBackupToProduction,
    clearBackupQueue,
    isLoading
  } = useExpenses();

  const [activeSubTab, setActiveSubTab] = useState<"upload" | "queue">("upload");

  // States for uploaded / parsed statement transactions
  const [isParsing, setIsParsing] = useState(false);
  const [parsedTxs, setParsedTxs] = useState<ParsedTransaction[]>([]);
  const [selectedTxIndexes, setSelectedTxIndexes] = useState<Set<number>>(new Set());
  const [password, setPassword] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const allCategoriesList = [...categories, ...customCategories];

  // Helper to resolve all subcategories for a category id
  const getSubcategories = (catId: string): string[] => {
    const matched = allCategoriesList.find(c => c.id === catId);
    if (matched) {
      const predefined = matched.subcategories || [];
      const custom = customSubcategories[catId] || [];
      // deduplicate
      return Array.from(new Set([...predefined, ...custom]));
    }
    return ["Miscellaneous"];
  };

  // Drag and drop states
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (
        file.type === "application/pdf" ||
        file.name.endsWith(".pdf") ||
        file.type === "text/csv" ||
        file.name.endsWith(".csv")
      ) {
        await processFile(file);
      } else {
        toast.error("Please drop a valid PDF or CSV statement file");
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    const id = toast.loading(`Reading statement: ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (password) {
        formData.append("password", password);
      }

      const res = await fetch("/api/parse_statement", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const txs: ParsedTransaction[] = await res.json();
      setUploadedFileName(file.name);

      // Auto-assign local database category ids if found
      const finalizedTxs = txs.map(tx => {
        const matchedCat = allCategoriesList.find(c => c.name.toLowerCase() === tx.category.toLowerCase());
        return {
          ...tx,
          category: matchedCat ? matchedCat.id : tx.category.toLowerCase()
        };
      });

      setParsedTxs(finalizedTxs);

      // Select all by default
      const allIndexes = new Set<number>();
      finalizedTxs.forEach((_, idx) => allIndexes.add(idx));
      setSelectedTxIndexes(allIndexes);

      toast.success(`Parsed ${finalizedTxs.length} transactions successfully!`, { id });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to parse statement PDF.",
        { id }
      );
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle updates to fields inside parsed array
  const handleUpdateField = (index: number, field: keyof ParsedTransaction, value: any) => {
    setParsedTxs(prev => prev.map((tx, idx) => {
      if (idx === index) {
        const updated = { ...tx, [field]: value };
        // If category changed, auto-assign first subcategory
        if (field === "category") {
          const subs = getSubcategories(value);
          updated.subcategory = subs[0] || "Miscellaneous";
        }
        return updated;
      }
      return tx;
    }));
  };

  // Toggle selection
  const handleToggleSelect = (index: number) => {
    setSelectedTxIndexes(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Select all or none
  const handleToggleSelectAll = () => {
    if (selectedTxIndexes.size === filteredParsedTxs.length) {
      setSelectedTxIndexes(new Set());
    } else {
      const next = new Set<number>();
      parsedTxs.forEach((_, idx) => {
        // Only select currently filtered items
        const isFiltered = filteredParsedTxs.some(item => parsedTxs.indexOf(item) === idx);
        if (isFiltered) {
          next.add(idx);
        }
      });
      setSelectedTxIndexes(next);
    }
  };

  // Reject / delete row from active view (satisfying Comment 1)
  const handleRemoveRow = (index: number) => {
    setParsedTxs(prev => prev.filter((_, idx) => idx !== index));
    setSelectedTxIndexes(prev => {
      const next = new Set<number>();
      prev.forEach(val => {
        if (val < index) next.add(val);
        if (val > index) next.add(val - 1);
      });
      return next;
    });
    toast.success("Transaction discarded from list");
  };

  // Import selected to backup queue
  const handleUploadSelected = async () => {
    const selectedList = parsedTxs.filter((_, idx) => selectedTxIndexes.has(idx));
    if (selectedList.length === 0) {
      toast.error("Please select at least one transaction to upload");
      return;
    }

    try {
      if (selectedList.length > 0) {
        const minDate = selectedList.reduce((min, tx) => tx.date < min ? tx.date : min, selectedList[0].date);
        const maxDate = selectedList.reduce((max, tx) => tx.date > max ? tx.date : max, selectedList[0].date);
        const card = selectedList[0].card || "HSBC";
        addStatementRecord(card, minDate, maxDate, uploadedFileName);
      }

      // Map view categories back to db category ids
      const payload: Omit<Expense, "id">[] = selectedList.map(tx => {
        const matched = allCategoriesList.find(c => c.id === tx.category);
        return {
          categoryId: matched ? matched.id : tx.category,
          subcategory: tx.subcategory,
          amount: tx.amount,
          date: tx.date,
          note: `Imported from Statement (${tx.description})${tx.isForeign ? ` | Original: ${tx.originalAmount} ${tx.originalCurrency}` : ''}${tx.card ? ` | Card: ${tx.card}` : ''}`
        };
      });

      await bulkAddBackupExpenses(payload);

      // Clear view list
      setParsedTxs([]);
      setSelectedTxIndexes(new Set());
      setActiveSubTab("queue"); // Switch to verification queue to review
    } catch (e) {
      console.error(e);
    }
  };

  // Filter parsed transactions
  const filteredParsedTxs = parsedTxs.filter(tx => {
    const matchesQuery = tx.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || tx.category === categoryFilter;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="pb-28 px-4 max-w-md mx-auto">
      {/* Header Banner */}
      <div className="py-6">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">Statement Importer</h1>
        <p className="text-muted-foreground text-sm">Upload, edit, and queue credit card PDF statements.</p>
      </div>

      {/* Glassmorphic Sub-tab Switcher */}
      <div className="flex p-1 rounded-xl bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/10 backdrop-blur-md mb-6 shadow-sm">
        <button
          onClick={() => setActiveSubTab("upload")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeSubTab === "upload"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
        >
          <FileUp className="h-4 w-4" />
          Upload & Review
        </button>
        <button
          onClick={() => setActiveSubTab("queue")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 relative ${activeSubTab === "queue"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
        >
          <Database className="h-4 w-4" />
          Verify Queue
          {backupExpenses.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold shadow-md shadow-accent/20 animate-pulse">
              {backupExpenses.length}
            </span>
          )}
        </button>
      </div>

      {/* Main View Panel */}
      <AnimatePresence mode="wait">
        {activeSubTab === "upload" ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {parsedTxs.length === 0 ? (
              <div className="space-y-4">
                {/* PDF Drag and Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative group cursor-pointer flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-10 text-center transition-all duration-300 min-h-[300px] backdrop-blur-md ${isDragActive
                    ? "border-primary bg-primary/[0.04] scale-[1.02] shadow-xl shadow-primary/5"
                    : "border-white/40 dark:border-white/10 bg-white/20 dark:bg-black/10 hover:border-primary/55 hover:bg-white/45 dark:hover:bg-black/15 shadow-sm"
                  }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf, text/csv, .csv"
                  className="hidden"
                />

                {isParsing ? (
                  <div className="space-y-4 flex flex-col items-center">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="font-semibold text-lg animate-pulse text-primary">Scanning & Categorizing...</p>
                    <p className="text-muted-foreground text-xs max-w-xs">Extracting lines, clearing currency noise, and matching overrides...</p>
                  </div>
                ) : (
                  <div className="space-y-5 flex flex-col items-center">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300 group-hover:bg-primary group-hover:text-primary-foreground shadow-inner">
                      <FileUp className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="font-bold text-lg text-foreground mb-1">Upload Statement PDF or CSV</p>
                      <p className="text-muted-foreground text-xs max-w-xs mx-auto">Drag and drop your PDF statement or Wio CSV file here or click to browse.</p>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-secondary text-secondary-foreground border border-border/20">Supports HSBC, Noon, ADCB, SIB, Share & Wio CSV</span>
                  </div>
                )}
              </div>

              {/* Password field */}
              <div className="p-4 rounded-2xl bg-white/40 dark:bg-black/10 border border-white/20 dark:border-white/10 backdrop-blur-md shadow-sm">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Statement Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Enter statement password (default tried automatically)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-secondary/80 border border-border/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          ) : (
              /* Review Table UI */
              <div className="space-y-4">
                {/* Search & Filter Options */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 dark:bg-black/10 border border-white/20 dark:border-white/10 backdrop-blur-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-secondary/80 border border-border/40 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Filter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full bg-secondary/80 border border-border/40 rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary appearance-none font-medium"
                      >
                        <option value="all">All Categories</option>
                        {allCategoriesList.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <button
                      onClick={handleToggleSelectAll}
                      className="px-4 py-2 border border-border/50 bg-secondary/60 rounded-xl text-xs font-semibold hover:bg-secondary transition-colors"
                    >
                      {selectedTxIndexes.size === filteredParsedTxs.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                </div>

                {/* Grid Lists for Parsed Rows */}
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredParsedTxs.map((tx, idx) => {
                    const originalIndex = parsedTxs.indexOf(tx);
                    const isSelected = selectedTxIndexes.has(originalIndex);

                    return (
                      <div
                        key={originalIndex}
                        className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-3 backdrop-blur-sm relative ${isSelected
                            ? "bg-white/60 dark:bg-black/30 border-primary/40 shadow-md shadow-primary/[0.02]"
                            : "bg-white/30 dark:bg-black/10 border-white/20 dark:border-white/10"
                          }`}
                      >
                        {/* Upper row: Select + Date + Trash */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(originalIndex)}
                            className="h-4 w-4 rounded text-primary border-border focus:ring-primary cursor-pointer"
                          />
                          <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full transition-all duration-200 shrink-0 ${
                            isSelected 
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20" 
                              : "bg-muted text-muted-foreground border border-border"
                          }`}>
                            {isSelected ? "Personal" : "Office"}
                          </span>

                          <div className="flex items-center gap-1.5 flex-1 bg-secondary/50 px-2.5 py-1 rounded-lg border border-border/30 max-w-[110px]">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <input
                              type="text"
                              value={tx.date}
                              onChange={(e) => handleUpdateField(originalIndex, "date", e.target.value)}
                              className="bg-transparent text-xs focus:outline-none w-full font-medium"
                            />
                          </div>

                          <span className="text-[10px] text-muted-foreground font-semibold px-2 py-0.5 rounded-full bg-secondary/40 border border-border/20 ml-auto">Pg {tx.page}</span>

                          <button
                            onClick={() => handleRemoveRow(originalIndex)}
                            className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center active:scale-95 transition-all duration-150"
                            title="Discard transaction"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Mid Row: Editable Description */}
                        <input
                          type="text"
                          value={tx.description}
                          onChange={(e) => handleUpdateField(originalIndex, "description", e.target.value)}
                          className="bg-secondary/40 border border-border/20 rounded-xl px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-full"
                        />

                        {/* Bottom Row: Amount + Category Dropdowns */}
                        <div className="flex gap-2 items-center">
                          {/* Editable Amount */}
                          <div className="relative max-w-[100px] shrink-0">
                            <input
                              type="number"
                              step="0.01"
                              value={tx.amount}
                              onChange={(e) => handleUpdateField(originalIndex, "amount", parseFloat(e.target.value) || 0)}
                              className={`w-full bg-secondary/40 border border-border/20 rounded-xl px-2 py-1.5 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary ${tx.amount < 0 ? "text-success" : "text-foreground"
                                }`}
                            />
                          </div>

                          {tx.isForeign && tx.originalAmount && tx.originalCurrency && (
                            <div className="flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-500 bg-amber-500/10 px-2 py-1.5 rounded-xl border border-amber-500/20 font-bold shrink-0">
                              <Globe className="h-3 w-3 shrink-0" />
                              <span>{tx.originalCurrency} {tx.originalAmount.toFixed(2)}</span>
                            </div>
                          )}

                          {/* Category select */}
                          <div className="flex-1 relative">
                            <select
                              value={tx.category}
                              onChange={(e) => handleUpdateField(originalIndex, "category", e.target.value)}
                              className="w-full bg-secondary/40 border border-border/20 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
                            >
                              {allCategoriesList.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Subcategory select */}
                          <div className="flex-1 relative">
                            <select
                              value={tx.subcategory}
                              onChange={(e) => handleUpdateField(originalIndex, "subcategory", e.target.value)}
                              className="w-full bg-secondary/40 border border-border/20 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
                            >
                              {getSubcategories(tx.category).map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sticky Action Footer */}
                <div className="p-4 rounded-2xl bg-white/70 dark:bg-black/30 border border-white/20 dark:border-white/10 backdrop-blur-md shadow-md flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Selected</span>
                    <span className="text-sm font-bold text-foreground">{selectedTxIndexes.size} of {parsedTxs.length} items</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setParsedTxs([]);
                        setSelectedTxIndexes(new Set());
                      }}
                      className="px-4 py-2 border border-border/60 hover:bg-secondary rounded-xl text-xs font-bold transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleUploadSelected}
                      disabled={selectedTxIndexes.size === 0}
                      className="px-4 py-2 bg-primary text-primary-foreground disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <Database className="h-3.5 w-3.5" />
                      Queue to Verify
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* Verification Queue Viewer Tab */
          <motion.div
            key="queue"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {backupExpenses.length === 0 ? (
              /* Empty Queue Screen */
              <div className="p-10 text-center rounded-3xl bg-white/30 dark:bg-black/10 border border-white/20 dark:border-white/10 backdrop-blur-md flex flex-col items-center justify-center space-y-4 min-h-[300px]">
                <div className="h-14 w-14 rounded-full bg-success/10 text-success flex items-center justify-center shadow-inner">
                  <Check className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-bold text-lg">Verification Queue is Empty</p>
                  <p className="text-muted-foreground text-xs max-w-xs mx-auto mt-1">Parsed statements uploaded to backup will appear here for verification before production database insertion.</p>
                </div>
              </div>
            ) : (
              /* Queue Transactions List */
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-3.5 py-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 text-xs font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  These transactions are safely locked in backup storage and will not count towards dashboard statistics.
                </div>

                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
                  {backupExpenses.map((expense) => {
                    const { cleanedNote, isForeign, originalAmount, originalCurrency } = parseNoteDetails(expense.note);
                    return (
                      <div
                        key={expense.id}
                        className="p-3.5 rounded-xl bg-white/20 dark:bg-black/10 border border-white/20 dark:border-white/10 backdrop-blur-sm flex items-center justify-between gap-3 group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] text-muted-foreground font-semibold bg-secondary/50 px-2 py-0.5 rounded border border-border/20">{expense.date}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {getCategoryById(expense.categoryId, customCategories)?.name || expense.categoryId}
                            </span>
                            <span className="text-[10px] font-medium text-muted-foreground italic truncate">/ {expense.subcategory || "Other"}</span>
                          </div>
                          <p className="text-xs font-semibold text-foreground truncate">{cleanedNote}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right flex flex-col items-end shrink-0">
                            <span className={`text-xs font-bold leading-none dirham-symbol ${expense.amount < 0 ? "text-success" : "text-foreground"}`}>
                              {formatCurrency(expense.amount)}
                            </span>
                            {isForeign && originalAmount > 0 && originalCurrency && (
                              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-500 flex items-center gap-0.5 mt-1">
                                <Globe className="h-2.5 w-2.5 shrink-0" />
                                <span>{originalCurrency} {originalAmount.toFixed(2)}</span>
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => deleteBackupExpense(expense.id)}
                            className="h-7 w-7 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-all opacity-85 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Queue Actions */}
                <div className="p-4 rounded-2xl bg-white/70 dark:bg-black/30 border border-white/20 dark:border-white/10 backdrop-blur-md shadow-md flex gap-2">
                  <button
                    onClick={clearBackupQueue}
                    className="flex-1 py-3 border border-border/60 hover:bg-secondary rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <X className="h-4 w-4" />
                    Clear Queue
                  </button>
                  <button
                    onClick={mergeBackupToProduction}
                    className="flex-1 py-3 bg-gradient-to-r from-success to-emerald-600 text-success-foreground rounded-xl text-xs font-bold shadow-md shadow-success/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Merge to Production
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
