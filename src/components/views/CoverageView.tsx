import React, { useEffect, useState, Component, ErrorInfo, ReactNode } from "react";
import { useExpenses } from "@/context/ExpenseContext";
import { getStatementRecords, seedStatementRecords, StatementRecord } from "@/lib/statementParser";
import { getMonthName } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, AlertTriangle, FileText, CheckCircle2,
  History, Calendar as CalendarIcon, Info, ChevronLeft, ChevronRight,
  Upload, Layers, RefreshCw, Clock, CalendarDays
} from "lucide-react";
import { format, getDaysInMonth } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

// Error boundary to prevent white-screen crashes if local storage has corrupt data
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class CoverageViewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CoverageView Error Boundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-lg mx-auto my-12 text-center space-y-4">
          <Card className="p-6 rounded-3xl border border-destructive/30 bg-destructive/5 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Something went wrong loading Coverage</h2>
            <p className="text-xs text-muted-foreground">
              {this.state.error?.message || "An unexpected error occurred while processing statement records."}
            </p>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              size="sm"
              className="rounded-full gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

const CARD_COLORS: Record<string, string> = {
  Wio: "#5700FF",    // Electric Violet
  Noon: "#F6BE00",   // Noon Gold / Yellow
  HSBC: "#DB0011",   // HSBC Red
  ADCB: "#273239",   // Dark Charcoal
  SIB: "#001489",    // Deep Resolution Blue
  Share: "#00A3A0",  // SHARE Teal
};

// Billing cycle statement generation days
const CARD_BILLING_DAYS: Record<string, { day: number; label: string }> = {
  ADCB: { day: 5, label: "Statement on 5th" },
  HSBC: { day: 10, label: "Statement on 10th" },
  SIB: { day: 14, label: "Statement on 14th" },
  Share: { day: 15, label: "Statement on 15th" },
  Noon: { day: 25, label: "Statement on 25th" },
  Wio: { day: 31, label: "Monthly (End of Month)" },
};

// Safe date formatting helpers using string splitting to avoid Invalid Date / timezone errors
const formatDateReadable = (dateStr: string) => {
  if (!dateStr || typeof dateStr !== "string") return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const dateObj = new Date(y, m, d);
        return format(dateObj, "MMM dd, yyyy");
      }
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

const formatDateShort = (dateStr: string) => {
  if (!dateStr || typeof dateStr !== "string") return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const dateObj = new Date(y, m, d);
        return format(dateObj, "MMM dd");
      }
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

// Calculate next statement date and days remaining relative to today
const getCardNextStatementInfo = (
  cardKey: string,
  maxCoveredDateStr: string | null,
  today: Date = new Date()
) => {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  const daysInCurrentMonth = getDaysInMonth(today);
  const billingConfig = CARD_BILLING_DAYS[cardKey]?.day || 15;
  const targetDay = billingConfig === 31 ? daysInCurrentMonth : billingConfig;

  // Current cycle statement date string
  const currentCycleDateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;

  let nextStatementDate: Date;
  let isOverdue = false;

  // Check if statement for current month's billing date has been uploaded
  const isCurrentCycleCovered = maxCoveredDateStr ? maxCoveredDateStr >= currentCycleDateStr : false;

  if (d > targetDay) {
    if (isCurrentCycleCovered) {
      // Current cycle is done! Next statement is in next month
      let nextM = m + 1;
      let nextY = y;
      if (nextM > 11) {
        nextM = 0;
        nextY = y + 1;
      }
      const daysInNextMonth = getDaysInMonth(new Date(nextY, nextM, 1));
      const nextDayNum = Math.min(targetDay, daysInNextMonth);
      nextStatementDate = new Date(nextY, nextM, nextDayNum);
    } else {
      // Past statement day and no statement imported -> Overdue
      isOverdue = true;
      nextStatementDate = new Date(y, m, targetDay);
    }
  } else {
    // Current month's statement date is coming up or today
    nextStatementDate = new Date(y, m, targetDay);
  }

  // Days difference from today to next statement date
  const todayMidnight = new Date(y, m, d);
  const diffTime = nextStatementDate.getTime() - todayMidnight.getTime();
  const daysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let label = "";

  if (isOverdue) {
    const daysOverdue = Math.abs(daysDiff);
    label = `Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`;
  } else if (daysDiff === 0) {
    label = `Due Today! (${format(nextStatementDate, "MMM dd")})`;
  } else if (daysDiff === 1) {
    label = `Due Tomorrow (${format(nextStatementDate, "MMM dd")})`;
  } else {
    label = `Next: ${format(nextStatementDate, "MMM dd")} (in ${daysDiff} days)`;
  }

  return {
    nextStatementDate,
    formattedNextDate: format(nextStatementDate, "MMM dd"),
    daysDiff,
    isOverdue,
    isCurrentCycleCovered,
    label,
  };
};

interface CoverageSegment {
  record: StatementRecord;
  startDay: number;
  endDay: number;
  leftPercent: number;
  widthPercent: number;
  daysCoveredInMonth: number;
}

interface CoverageViewProps {
  onNavigateToImport?: () => void;
}

const getExpenseCardForCoverage = (noteText: string, subcatText: string): string | null => {
  const noteUpper = (noteText || "").toUpperCase();
  const subcatUpper = (subcatText || "").toUpperCase();

  if (noteUpper.includes("CARD: ADCB")) return "ADCB";
  if (noteUpper.includes("CARD: SIB")) return "SIB";
  if (noteUpper.includes("CARD: SHARE")) return "Share";
  if (noteUpper.includes("CARD: NOON")) return "Noon";
  if (noteUpper.includes("CARD: HSBC")) return "HSBC";
  if (noteUpper.includes("CARD: WIO")) return "Wio";

  if (noteUpper.includes("ADCB") || noteUpper.includes("TAKEDA") || noteUpper.includes("MBTA") || noteUpper.includes("7-ELEVEN") || noteUpper.includes("ROCKIN BURGERS")) return "ADCB";
  if (noteUpper.includes("SIB") || noteUpper.includes("DOORDASH") || noteUpper.includes("UBER EATS") || noteUpper.includes("THE LIBERTY HOTEL") || noteUpper.includes("ZARA.COM") || noteUpper.includes("TKD FASHION")) return "SIB";
  if (noteUpper.includes("SHARE") || noteUpper.includes("URBANCLAP")) return "Share";
  if (noteUpper.includes("NOON")) return "Noon";
  if (noteUpper.includes("HSBC")) return "HSBC";
  if (noteUpper.includes("WIO") || subcatUpper.includes("WIO")) return "Wio";

  if (noteUpper.includes("IMPORTED FROM STATEMENT")) {
    if (
      noteUpper.includes("TEMU") || 
      noteUpper.includes("WEST ZONE") || 
      noteUpper.includes("NATIONAL TAXI") || 
      noteUpper.includes("BABEL") || 
      noteUpper.includes("KAMAT") || 
      noteUpper.includes("HAPPY FRESH") ||
      noteUpper.includes("CLIPPERS") ||
      noteUpper.includes("MILLENNIUM") ||
      noteUpper.includes("CARREFOUR") ||
      noteUpper.includes("PAUL") ||
      noteUpper.includes("RAJU OMLET") ||
      noteUpper.includes("DUBAYPAY RTA") ||
      noteUpper.includes("DUBAIPAY RTA") ||
      noteUpper.includes("STA") ||
      noteUpper.includes("MOHESR")
    ) {
      return "Wio";
    }
    return "HSBC";
  }
  return null;
};

const CoverageViewContent: React.FC<CoverageViewProps> = ({ onNavigateToImport }) => {
  const { expenses, backupExpenses } = useExpenses();
  const allExpenses = [...expenses, ...backupExpenses];
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<StatementRecord[]>([]);
  const [activeTooltipCard, setActiveTooltipCard] = useState<string | null>(null);

  // Seed history on mount safely
  useEffect(() => {
    const seed = async () => {
      try {
        await seedStatementRecords();
        const recs = getStatementRecords() || [];
        setRecords(recs);
      } catch (e) {
        console.error("Error initializing coverage records:", e);
      }
    };
    seed();
  }, []);

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

  const selectedYear = currentYear;
  const selectedMonth = currentMonth;
  const selectedDate = new Date(selectedYear, selectedMonth, 1);
  const daysInSelectedMonth = Math.max(getDaysInMonth(selectedDate), 28);
  const selectedMonthName = getMonthName(selectedMonth);

  const today = now;
  const todayDay = isCurrentMonth ? today.getDate() : null;

  // String formatting for current month start/end
  const monthStartStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const monthEndStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(daysInSelectedMonth).padStart(2, "0")}`;
  const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  // Filter valid localStorage records
  const validRecords = Array.isArray(records) ? records.filter((r) => r && typeof r.card === "string") : [];

  // Dynamically derive statement coverage records from loaded expenses if missing from stored records
  const dynamicExpenseRecords: StatementRecord[] = [];
  if (Array.isArray(allExpenses) && allExpenses.length > 0) {
    const cardDatesMap = new Map<string, { minDate: string; maxDate: string }>();
    allExpenses.forEach((exp) => {
      if (!exp.date) return;
      const card = getExpenseCardForCoverage(exp.note || "", exp.subcategory || "");
      if (!card) return;
      const current = cardDatesMap.get(card);
      if (!current) {
        cardDatesMap.set(card, { minDate: exp.date, maxDate: exp.date });
      } else {
        if (exp.date < current.minDate) current.minDate = exp.date;
        if (exp.date > current.maxDate) current.maxDate = exp.date;
      }
    });

    cardDatesMap.forEach(({ minDate, maxDate }, cardKey) => {
      // Check if stored records already cover this range
      const hasStoredRecord = validRecords.some(
        (r) => r.card === cardKey && r.startDate <= minDate && r.endDate >= maxDate
      );
      if (!hasStoredRecord) {
        dynamicExpenseRecords.push({
          card: cardKey,
          startDate: minDate,
          endDate: maxDate,
          filename: `${cardKey} Transactions (Synced Data)`,
          importedAt: Date.now(),
        });
      }
    });
  }

  const combinedRecords = [...validRecords, ...dynamicExpenseRecords];
  const allCardKeys = Array.from(new Set([...Object.keys(CARD_COLORS), ...combinedRecords.map((r) => r.card)]));

  // Compute timeline data for each card in the selected month
  const cardsCoverageData = allCardKeys.map((cardKey) => {
    const color = CARD_COLORS[cardKey] || "#888888";
    
    // Dynamic billing info (Wio automatically gets current month's end day, e.g. 31 for July)
    let billingInfo = CARD_BILLING_DAYS[cardKey] || { day: 15, label: `Statement on 15th` };
    if (cardKey === "Wio") {
      billingInfo = { day: daysInSelectedMonth, label: `Monthly (Ends on Day ${daysInSelectedMonth})` };
    }

    const rawCardRecords = combinedRecords.filter((r) => r.card === cardKey);
    const uniqueMap = new Map<string, StatementRecord>();
    rawCardRecords.forEach((rec) => {
      const key = rec.filename || `${rec.startDate}_${rec.endDate}`;
      const existing = uniqueMap.get(key);
      if (!existing || (rec.importedAt || 0) >= (existing.importedAt || 0)) {
        uniqueMap.set(key, rec);
      }
    });
    const cardRecords = Array.from(uniqueMap.values());

    const sortedAll = [...cardRecords].sort((a, b) => (b.endDate || "").localeCompare(a.endDate || ""));
    const latestOverallRecord = sortedAll[0] || null;

    const rawSegments: CoverageSegment[] = [];

    cardRecords.forEach((rec) => {
      if (!rec || !rec.startDate || !rec.endDate) return;

      // Check overlap with [monthStartStr, monthEndStr]
      if (rec.startDate <= monthEndStr && rec.endDate >= monthStartStr) {
        const overlapStartStr = rec.startDate < monthStartStr ? monthStartStr : rec.startDate;
        const overlapEndStr = rec.endDate > monthEndStr ? monthEndStr : rec.endDate;

        const startParts = overlapStartStr.split("-");
        const endParts = overlapEndStr.split("-");
        if (startParts.length !== 3 || endParts.length !== 3) return;

        const startDay = parseInt(startParts[2], 10);
        const endDay = parseInt(endParts[2], 10);

        if (!isNaN(startDay) && !isNaN(endDay) && startDay <= endDay && startDay >= 1 && endDay <= daysInSelectedMonth) {
          const daysCoveredInMonth = endDay - startDay + 1;
          const leftPercent = ((startDay - 1) / daysInSelectedMonth) * 100;
          const widthPercent = (daysCoveredInMonth / daysInSelectedMonth) * 100;

          rawSegments.push({
            record: rec,
            startDay,
            endDay,
            leftPercent: Math.max(0, Math.min(100, leftPercent)),
            widthPercent: Math.max(0, Math.min(100, widthPercent)),
            daysCoveredInMonth,
          });
        }
      }
    });

    // Sort segments by startDay ascending
    rawSegments.sort((a, b) => a.startDay - b.startDay);

    // Adjust segment positions to prevent visual overlapping between consecutive statement ranges
    const segments: CoverageSegment[] = rawSegments.map((seg, idx) => {
      if (idx === 0) return { ...seg };
      const prevSeg = rawSegments[idx - 1];
      if (prevSeg.endDay >= seg.startDay) {
        const adjustedStartDay = prevSeg.endDay;
        const adjustedDays = Math.max(1, seg.endDay - adjustedStartDay);
        const leftPercent = (adjustedStartDay / daysInSelectedMonth) * 100;
        const widthPercent = (adjustedDays / daysInSelectedMonth) * 100;
        return {
          ...seg,
          leftPercent: Math.max(0, Math.min(100, leftPercent)),
          widthPercent: Math.max(0, Math.min(100 - leftPercent, widthPercent)),
        };
      }
      return { ...seg };
    });

    const coveredDaysSet = new Set<number>();
    rawSegments.forEach((seg) => {
      for (let d = seg.startDay; d <= seg.endDay; d++) {
        coveredDaysSet.add(d);
      }
    });

    const totalDaysCoveredInMonth = coveredDaysSet.size;
    const coveragePercentage = Math.round((totalDaysCoveredInMonth / daysInSelectedMonth) * 100);

    const latestMonthRecord = [...rawSegments].sort((a, b) => b.record.endDate.localeCompare(a.record.endDate))[0]?.record || null;
    const maxCoveredDateStr = latestMonthRecord ? latestMonthRecord.endDate : (latestOverallRecord ? latestOverallRecord.endDate : null);

    // Compute smart next statement date and days remaining info
    const nextStatementInfo = getCardNextStatementInfo(cardKey, maxCoveredDateStr, today);

    // Compute total spent on this card for selected month from statements AND live expenses
    let statementSpentInMonth = 0;
    let statementTxCount = 0;
    cardRecords.forEach((rec) => {
      if (rec.monthlySpending && rec.monthlySpending[monthPrefix] !== undefined) {
        statementSpentInMonth += rec.monthlySpending[monthPrefix];
      }
      if (rec.monthlyCounts && rec.monthlyCounts[monthPrefix] !== undefined) {
        statementTxCount += rec.monthlyCounts[monthPrefix];
      }
    });

    const cardExpensesInMonth = allExpenses.filter((exp) => {
      const c = getExpenseCardForCoverage(exp.note || "", exp.subcategory || "");
      return c === cardKey && exp.date && exp.date.startsWith(monthPrefix);
    });
    const liveExpenseSpentInMonth = cardExpensesInMonth.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const liveExpenseTxCount = cardExpensesInMonth.length;

    const totalSpentInMonth = statementSpentInMonth > 0 ? statementSpentInMonth : liveExpenseSpentInMonth;
    const cardTxCount = statementTxCount > 0 ? statementTxCount : liveExpenseTxCount;

    // Smart Status Evaluation:
    // Missing is ONLY declared if statement end date has passed AND no statement for that cycle has been uploaded.
    const statementDueDay = billingInfo.day > daysInSelectedMonth ? daysInSelectedMonth : billingInfo.day;
    const targetDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(statementDueDay).padStart(2, "0")}`;

    const isPastSelectedMonth = selectedDate < new Date(today.getFullYear(), today.getMonth(), 1);
    const hasBillingDateArrived = isPastSelectedMonth || (isCurrentMonth && today.getDate() >= statementDueDay);
    const isTargetStatementCovered = maxCoveredDateStr ? maxCoveredDateStr >= targetDateStr : false;

    const earliestOverallRecord = sortedAll[sortedAll.length - 1] || null;
    const earliestCardDateStr = earliestOverallRecord ? earliestOverallRecord.startDate : null;
    const isBeforeCardExisted = earliestCardDateStr ? monthEndStr < `${earliestCardDateStr.substring(0, 7)}-01` : false;

    let status: "full" | "partial" | "awaiting" | "missing" | "inactive" = "missing";

    if (isTargetStatementCovered || totalDaysCoveredInMonth >= daysInSelectedMonth || coveragePercentage >= 95) {
      status = "full";
    } else if (totalDaysCoveredInMonth > 0) {
      status = "partial";
    } else if (isBeforeCardExisted) {
      // Card was newly acquired and had no statement history prior to earliest statement date
      status = "inactive";
    } else if (!hasBillingDateArrived) {
      // Billing cycle is still active / in progress -> Awaiting Statement (NOT MISSING!)
      status = "awaiting";
    } else {
      // Billing date has passed and statement is not uploaded -> Missing
      status = "missing";
    }

    return {
      cardKey,
      color,
      billingInfo,
      segments,
      totalDaysCoveredInMonth,
      coveragePercentage,
      latestOverallRecord,
      latestMonthRecord,
      maxCoveredDateStr,
      nextStatementInfo,
      status,
      hasBillingDateArrived,
      totalSpentInMonth,
      cardTxCount,
    };
  });

  // Sort horizontal bar chart rows in INCREASING order of statement date (5th on top -> 10th -> 14th -> 15th -> 25th -> End of Month)
  cardsCoverageData.sort((a, b) => a.billingInfo.day - b.billingInfo.day);

  // Compute grand total spending across all cards for selected month
  const totalSpentAllCardsInMonth = cardsCoverageData.reduce(
    (sum, card) => sum + card.totalSpentInMonth,
    0
  );

  const cardsCoveredCount = cardsCoverageData.filter((c) => c.status === "full").length;
  const cardsAwaitingCount = cardsCoverageData.filter((c) => c.status === "awaiting" || c.status === "partial").length;
  const cardsMissingCount = cardsCoverageData.filter((c) => c.status === "missing").length;

  // Statement billing days: Day 5 (ADCB), Day 10 (HSBC), Day 14 (SIB), Day 15 (Share), Day 25 (Noon), End of Month (Wio)
  const generateTicks = () => {
    const expectedDays = [1, 5, 10, 14, 15, 25, daysInSelectedMonth];
    return Array.from(new Set(expectedDays))
      .filter((d) => d <= daysInSelectedMonth)
      .sort((a, b) => a - b);
  };
  const axisTicks = generateTicks();

  // Tick positioning: Day 1 at 0%, Day N at 100%, intermediate day d at (d / N) * 100%
  const getTickPosition = (day: number) => {
    if (day === 1) return 0;
    if (day === daysInSelectedMonth) return 100;
    const pct = (day / daysInSelectedMonth) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const todayPosition = todayDay && daysInSelectedMonth > 1
    ? Math.max(0, Math.min(100, (todayDay / daysInSelectedMonth) * 100))
    : null;

  return (
    <div className="pb-24 px-4 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Statement Coverage View
          </h1>
        </div>
      </div>

      {/* Month Selector */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center gap-4 py-2"
      >
        <button
          onClick={goToPreviousMonth}
          className="touch-target p-2 rounded-full hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="month-selector min-w-[180px] justify-center">
          <span className="font-semibold text-lg">
            {getMonthName(currentMonth)} {currentYear}
          </span>
        </div>
        <button
          onClick={goToNextMonth}
          className={`touch-target p-2 rounded-full hover:bg-secondary transition-colors ${
            isCurrentMonth ? "opacity-30 pointer-events-none" : ""
          }`}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </motion.div>

      {/* Month Summary Stats Chips & Spending Overview */}
      <Card className="p-4 rounded-3xl border border-white/20 dark:border-white/10 bg-white/50 dark:bg-black/30 backdrop-blur-md shadow-lg space-y-3">
        <div className="flex items-center justify-between px-1 flex-wrap gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {selectedMonthName} {selectedYear} Overview
          </span>
          <Badge className="bg-primary/10 text-primary border border-primary/20 font-mono font-extrabold text-xs px-3 py-1 rounded-full shadow-xs">
            Total Spent: AED {totalSpentAllCardsInMonth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-2xl">
            <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">Covered</p>
            <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">{cardsCoveredCount} Cards</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-2xl">
            <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">Awaiting</p>
            <p className="text-base font-extrabold text-blue-700 dark:text-blue-300">{cardsAwaitingCount} Cards</p>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-2xl">
            <p className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">Overdue</p>
            <p className="text-base font-extrabold text-rose-700 dark:text-rose-300">{cardsMissingCount} Cards</p>
          </div>
        </div>
      </Card>

      {/* Main Horizontal Coverage Timeline Chart */}
      <Card className="p-4 sm:p-6 rounded-3xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md shadow-xl space-y-6 overflow-hidden">
        
        {/* Day Axis Line */}
        <div className="relative h-8 w-full bg-muted/30 rounded-xl border border-border/30 px-2 flex items-center">
          {axisTicks.map((day) => {
            const posPercent = getTickPosition(day);
            const isEndTick = day === daysInSelectedMonth;
            const isStartTick = day === 1;

            return (
              <div
                key={day}
                className={`absolute flex flex-col items-center z-10 ${
                  isStartTick ? "translate-x-0" : isEndTick ? "-translate-x-full" : "-translate-x-1/2"
                }`}
                style={{ left: `${posPercent}%` }}
              >
                <div className="h-1.5 w-0.5 bg-muted-foreground/40 rounded-full mb-0.5" />
                <span className="text-[10px] font-bold text-muted-foreground tracking-tight">
                  {day}
                </span>
              </div>
            );
          })}

          {/* Today Marker on Axis */}
          {isCurrentMonth && todayDay && todayPosition !== null && (
            <div
              className="absolute z-20 top-0 bottom-0 transform -translate-x-1/2 flex flex-col items-center justify-center"
              style={{ left: `${todayPosition}%` }}
            >
              <div className="bg-primary text-primary-foreground font-extrabold text-[9px] px-1.5 py-0.5 rounded-full shadow-md animate-pulse">
                TODAY ({todayDay})
              </div>
            </div>
          )}
        </div>

        {/* Card Coverage Rows */}
        <div className="space-y-4 relative">
          {/* Light Dashed Vertical Grid Lines down from expected statement days */}
          <div className="absolute inset-0 pointer-events-none z-0">
            {axisTicks.map((day) => {
              const posPercent = getTickPosition(day);
              return (
                <div
                  key={`grid_${day}`}
                  className="absolute top-0 bottom-0 border-l border-dashed border-muted-foreground/15"
                  style={{ left: `${posPercent}%` }}
                />
              );
            })}

            {/* Vertical Today Line across all rows */}
            {isCurrentMonth && todayPosition !== null && (
              <div
                className="absolute top-0 bottom-0 border-l-2 border-primary/70 shadow-[0_0_6px_rgba(87,0,255,0.3)] z-10"
                style={{ left: `${todayPosition}%` }}
              />
            )}
          </div>

          {/* Card Rows List */}
          <div className="space-y-5 relative z-10">
            {cardsCoverageData.map((card) => {
              const { nextStatementInfo } = card;

              return (
                <div key={card.cardKey} className="space-y-2 group">
                  {/* Row Card Header with Spent Amount & Smart Next Statement Info */}
                  <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-md shrink-0"
                        style={{ backgroundColor: card.color }}
                      />
                      <span className="font-extrabold text-sm text-foreground">{card.cardKey}</span>
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        ({card.billingInfo.label})
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 text-primary border border-primary/20 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs"
                      >
                        Spent: AED {card.totalSpentInMonth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {card.cardTxCount > 0 && <span className="text-[10px] opacity-75">({card.cardTxCount} txs)</span>}
                      </Badge>
                    </div>

                    {/* Smart Status & Next Statement Badge */}
                    <div className="flex items-center gap-2">
                      {card.status === "full" && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 rounded-full px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          Fully Covered
                        </Badge>
                      )}

                      {card.status === "awaiting" && (
                        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 rounded-full px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          {nextStatementInfo.label}
                        </Badge>
                      )}

                      {card.status === "partial" && (
                        <Badge className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 rounded-full px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1">
                          <Info className="h-3 w-3 shrink-0" />
                          Partial (Up to Day {Math.max(...card.segments.map((s) => s.endDay))})
                        </Badge>
                      )}

                      {card.status === "inactive" && (
                        <Badge variant="outline" className="text-muted-foreground/70 border-muted-foreground/30 rounded-full px-2.5 py-0.5 text-[11px] font-medium flex items-center gap-1">
                          <Info className="h-3 w-3 shrink-0" />
                          Card Not Active Yet
                        </Badge>
                      )}

                      {card.status === "missing" && (
                        <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 rounded-full px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {nextStatementInfo.isOverdue ? nextStatementInfo.label : "Statement Missing"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Timeline Bar Container */}
                  <div className="relative h-10 w-full bg-muted/30 rounded-2xl border border-border/40 overflow-hidden flex items-center shadow-inner">
                    {/* Uncovered background pattern */}
                    <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:8px_8px] opacity-40" />

                    {/* Render Coverage Bar Segments */}
                    {card.segments.length === 0 ? (
                      <div className="w-full text-center text-[11px] text-muted-foreground/60 font-medium italic z-10 flex items-center justify-center gap-1.5">
                        {card.status === "inactive" ? (
                          <span>Card was not active in {selectedMonthName}</span>
                        ) : card.status === "awaiting" ? (
                          <>
                            <Clock className="h-3.5 w-3.5 text-blue-500" />
                            <span>Billing cycle in progress — {nextStatementInfo.label}</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                            <span>No statement uploaded covering {selectedMonthName}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      card.segments.map((seg, idx) => (
                        <motion.div
                          key={`${seg.record.filename}_${idx}`}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 0.4, delay: idx * 0.1 }}
                          className="absolute h-full rounded-xl shadow-md border border-white/30 border-r-2 border-r-background/80 flex items-center px-2.5 cursor-pointer group/bar overflow-hidden"
                          style={{
                            left: `${seg.leftPercent}%`,
                            width: `${seg.widthPercent}%`,
                            backgroundColor: card.color,
                            transformOrigin: "left center",
                            zIndex: idx + 1,
                          }}
                          onClick={() => setActiveTooltipCard(activeTooltipCard === `${card.cardKey}_${idx}` ? null : `${card.cardKey}_${idx}`)}
                        >
                          {/* Shimmer overlay */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover/bar:opacity-100 transition-opacity" />

                          {/* Bar Label */}
                          <span className="text-white text-[11px] font-bold truncate whitespace-nowrap drop-shadow-sm z-10 select-none">
                            {seg.widthPercent > 15 ? (
                              `Day ${seg.startDay} – ${seg.endDay} (${seg.daysCoveredInMonth}d)`
                            ) : seg.widthPercent > 8 ? (
                              `Day ${seg.startDay}–${seg.endDay}`
                            ) : (
                              `${seg.endDay}`
                            )}
                          </span>
                        </motion.div>
                      ))
                    )}
                  </div>

                  {/* Detailed Popup / Card Info when active or hovered */}
                  <AnimatePresence>
                    {card.segments.map((seg, idx) => {
                      const isTooltipActive = activeTooltipCard === `${card.cardKey}_${idx}`;
                      if (!isTooltipActive) return null;

                      return (
                        <motion.div
                          key={`tooltip_${idx}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-card border border-border p-3 rounded-2xl text-xs space-y-2 shadow-lg"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-primary" />
                              {seg.record.filename}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] px-2 text-muted-foreground"
                              onClick={() => setActiveTooltipCard(null)}
                            >
                              Close
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-muted/40 p-2 rounded-xl">
                            <div>
                              <p className="text-muted-foreground font-medium">Statement Range</p>
                              <p className="font-bold text-foreground">
                                {formatDateShort(seg.record.startDate)} – {formatDateShort(seg.record.endDate)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground font-medium">Covered in {selectedMonthName}</p>
                              <p className="font-bold text-foreground">
                                Day {seg.startDay} to Day {seg.endDay} ({seg.daysCoveredInMonth} days)
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend Footer */}
        <div className="pt-4 border-t border-border/40 flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-emerald-500" />
              <span>Full Month</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-blue-500" />
              <span>Awaiting Cycle End</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-yellow-500" />
              <span>Partial Month</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-rose-500" />
              <span>Overdue / Missing</span>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground/80 italic">
            * Tap any colored segment to view source statement details
          </div>
        </div>
      </Card>

      {/* Historical Upload Log */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5 px-1">
          <History className="h-4 w-4" />
          All Ingested Statement Files ({validRecords.length})
        </h2>

        {validRecords.length === 0 ? (
          <Card className="p-6 text-center text-xs text-muted-foreground border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20">
            No statement files recorded in the import log yet.
          </Card>
        ) : (
          <div className="space-y-2.5">
            {[...validRecords]
              .sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0))
              .map((rec, idx) => (
                <div
                  key={`${rec.card}_${rec.endDate}_${idx}`}
                  className="flex items-center justify-between bg-white/40 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/10 p-3 rounded-2xl text-xs hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                      style={{ backgroundColor: CARD_COLORS[rec.card] || "#666" }}
                    >
                      {(rec.card || "---").substring(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate max-w-[200px]">{rec.filename || "Uploaded File"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {rec.card} • {formatDateReadable(rec.startDate)} to {formatDateReadable(rec.endDate)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-semibold text-foreground">{formatDateShort(rec.endDate)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {rec.importedAt ? format(new Date(rec.importedAt), "MMM dd, HH:mm") : ""}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const CoverageView: React.FC<CoverageViewProps> = (props) => {
  return (
    <CoverageViewErrorBoundary>
      <CoverageViewContent {...props} />
    </CoverageViewErrorBoundary>
  );
};
