import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Calendar } from "lucide-react";
import { useExpenses } from "@/context/ExpenseContext";
import { getMonthName, getExpensesByMonth } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CARD_COLORS: Record<string, string> = {
  Wio: "#5700FF",    // Electric Violet
  Noon: "#F6BE00",   // Noon Gold / Yellow
  HSBC: "#DB0011",   // HSBC Red
  ADCB: "#273239",   // Dark Charcoal
  SIB: "#001489",    // Deep Resolution Blue
  Share: "#00A3A0",  // SHARE Teal
};

const CARD_STATEMENT_DAYS: Record<string, number> = {
  ADCB: 5,
  HSBC: 10,
  SIB: 14,
  Share: 15,
  Noon: 25,
  Wio: 0 // Will map dynamically to last day of month
};

// Helper to detect which card/bank an expense belongs to
const detectCard = (noteText: string, subcatText: string): string | null => {
  const noteUpper = noteText.toUpperCase();
  const subcatUpper = subcatText.toUpperCase();

  // 1. Check explicit tag
  if (noteUpper.includes("CARD: ADCB")) return "ADCB";
  if (noteUpper.includes("CARD: SIB")) return "SIB";
  if (noteUpper.includes("CARD: SHARE")) return "Share";
  if (noteUpper.includes("CARD: NOON")) return "Noon";
  if (noteUpper.includes("CARD: HSBC")) return "HSBC";
  if (noteUpper.includes("CARD: WIO")) return "Wio";

  // 2. Check keywords
  if (noteUpper.includes("ADCB") || noteUpper.includes("TAKEDA") || noteUpper.includes("MBTA") || noteUpper.includes("7-ELEVEN") || noteUpper.includes("ROCKIN BURGERS")) return "ADCB";
  if (noteUpper.includes("SIB") || noteUpper.includes("DOORDASH") || noteUpper.includes("UBER EATS") || noteUpper.includes("THE LIBERTY HOTEL") || noteUpper.includes("ZARA.COM") || noteUpper.includes("TKD FASHION")) return "SIB";
  if (noteUpper.includes("SHARE") || noteUpper.includes("URBANCLAP")) return "Share";
  if (noteUpper.includes("NOON")) return "Noon";
  if (noteUpper.includes("HSBC")) return "HSBC";
  if (noteUpper.includes("WIO")) return "Wio";

  // Fallbacks for statement formats
  if (noteUpper.includes("IMPORTED FROM STATEMENT")) {
    if (
      noteUpper.includes("TEMU") || 
      noteUpper.includes("WEST ZONE") || 
      noteUpper.includes("NATIONAL TAXI") || 
      noteUpper.includes("BABEL DU QLUB") || 
      noteUpper.includes("KAMAT RESTAURANT") || 
      noteUpper.includes("PAUL") || 
      noteUpper.includes("DUBAYPAY RTA") || 
      noteUpper.includes("RAJU OMLET") ||
      subcatUpper.includes("WIO")
    ) {
      return "Wio";
    }
    return "HSBC"; // Legacy default
  }

  return null;
};

export const CoverageView: React.FC = () => {
  const { expenses } = useExpenses();
  const now = new Date();
  
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Disable navigating earlier than June 2026
  const isAtMinMonth = currentYear === 2026 && currentMonth === 5; // 5 is June
  
  const goToPreviousMonth = () => {
    if (isAtMinMonth) return;
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // Filter expenses for selected month
  const monthlyExpenses = getExpensesByMonth(expenses, currentYear, currentMonth);

  // Group by card and find maximum day covered
  const cardDataList = Object.keys(CARD_COLORS).map((cardKey) => {
    const cardExpenses = monthlyExpenses.filter((exp) => {
      const cardDetected = detectCard(exp.note || "", exp.subcategory || "");
      return cardDetected === cardKey;
    });

    let maxDay = 0;
    let latestDateStr = "";

    if (cardExpenses.length > 0) {
      // Find latest transaction date
      latestDateStr = cardExpenses.reduce(
        (max, exp) => (exp.date > max ? exp.date : max),
        cardExpenses[0].date
      );
      maxDay = parseInt(latestDateStr.split("-")[2], 10);
    }

    const statementDay = CARD_STATEMENT_DAYS[cardKey] === 0 ? daysInMonth : CARD_STATEMENT_DAYS[cardKey];
    
    // Warning Logic
    let isWarning = false;
    let warningReason = "";
    
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
    
    if (isCurrentMonth) {
      const todayDay = today.getDate();
      if (todayDay > statementDay && maxDay < statementDay) {
        isWarning = true;
        warningReason = `Statement generated on the ${statementDay}th but not imported yet`;
      }
    } else {
      // Past month must have 100% full coverage up to the end of the month
      if (maxDay < daysInMonth) {
        isWarning = true;
        warningReason = `Statement incomplete - last imported transaction was on the ${maxDay || 0}th`;
      }
    }

    return {
      key: cardKey,
      color: CARD_COLORS[cardKey],
      maxDay,
      latestDateStr,
      statementDay,
      isWarning,
      warningReason,
      hasData: cardExpenses.length > 0,
    };
  });

  // Timeline Ruler Ticks (Days 1, 5, 10, 15, 20, 25, and Last Day)
  const ticks = [1, 5, 10, 15, 20, 25, daysInMonth];

  return (
    <div className="pb-24 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Statement Coverage</h1>
        <div className="flex items-center gap-2 bg-muted/50 rounded-2xl p-1 border border-border/40 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousMonth}
            disabled={isAtMinMonth}
            className="h-8 w-8 rounded-xl disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold px-2 min-w-[100px] text-center">
            {getMonthName(currentMonth)} {currentYear}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextMonth}
            className="h-8 w-8 rounded-xl"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="p-6 rounded-3xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 shadow-xl backdrop-blur-md space-y-8">
        <div>
          <h2 className="font-bold text-lg mb-1 flex items-center gap-2 text-foreground">
            <Calendar className="h-5 w-5 text-primary" />
            Coverage Timeline
          </h2>
          <p className="text-muted-foreground text-xs">
            Review statement coverage range for each bank card below.
          </p>
        </div>

        {/* Horizontal Timeline Container */}
        <div className="relative pt-6">
          {/* Timeline Ruler */}
          <div className="relative h-6 flex justify-between text-[10px] text-muted-foreground font-bold border-b border-border/40 pb-2 mb-6">
            {ticks.map((tick) => {
              const pct = ((tick - 1) / (daysInMonth - 1)) * 100;
              return (
                <div
                  key={tick}
                  className="absolute transform -translate-x-1/2 flex flex-col items-center gap-1"
                  style={{ left: `${pct}%` }}
                >
                  <span>Day {tick}</span>
                  {/* Guideline */}
                  <div className="absolute top-6 w-[1px] h-[340px] border-l border-dashed border-border/20 z-0 pointer-events-none" />
                </div>
              );
            })}
          </div>

          {/* Card Bars */}
          <div className="space-y-7 relative z-10">
            {cardDataList.map((card) => {
              const widthPct = card.hasData ? (card.maxDay / daysInMonth) * 100 : 0;

              return (
                <div key={card.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Card Pill Dot */}
                      <span
                        className="w-3.5 h-3.5 rounded-full shadow-inner border border-white/20"
                        style={{ backgroundColor: card.color }}
                      />
                      <span className="font-bold text-sm text-foreground">{card.key}</span>
                      <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-muted/50 rounded-full border border-border/30">
                        Stmt Cycle: {card.statementDay === daysInMonth ? "End of Month" : `${card.statementDay}th`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {card.isWarning ? (
                        <div className="flex items-center gap-1 text-xs text-yellow-500 font-bold px-2 py-0.5 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Needs Update</span>
                        </div>
                      ) : card.hasData ? (
                        <div className="flex items-center gap-1 text-xs text-emerald-500 font-bold px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Up to Date</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No Data</span>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Bar Chart Track */}
                  <div className="h-4 bg-muted/60 dark:bg-neutral-800/40 rounded-full w-full overflow-hidden border border-border/20 shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full relative"
                      style={{ backgroundColor: card.color }}
                    >
                      {/* Subtle micro-shine layer */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/10" />
                    </motion.div>
                  </div>

                  {/* Date details & explanations */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {card.hasData
                        ? `Covered from Day 1 to Day ${card.maxDay}`
                        : "No data imported"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {card.hasData
                        ? `Till ${getMonthName(currentMonth).substring(0, 3)} ${card.maxDay}`
                        : "Import Required"}
                    </span>
                  </div>

                  {card.isWarning && (
                    <p className="text-[11px] text-yellow-600 dark:text-yellow-500/90 italic bg-yellow-500/[0.04] p-2 rounded-xl border border-yellow-500/10">
                      ⚠️ {card.warningReason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
};
