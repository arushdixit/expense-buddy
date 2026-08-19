import React, { useState, useEffect } from "react";
import { ExpenseProvider, useExpenses } from "@/context/ExpenseContext";
import { BottomNavigation, TabId } from "@/components/BottomNavigation";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { AddExpenseModal } from "@/components/AddExpenseModal";
import { DashboardView } from "@/components/views/DashboardView";
import { MonthlyView } from "@/components/views/MonthlyView";
import { CompareView } from "@/components/views/CompareView";
import { TrendsView } from "@/components/views/TrendsView";
import { ImportView } from "@/components/views/ImportView";
import { CoverageView } from "@/components/views/CoverageView";
import { PullToRefresh } from "@/components/PullToRefresh";
import { AnimatePresence, motion } from "framer-motion";
import { Expense } from "@/lib/data";

// Detect which card an expense belongs to (matching logic in CoverageView)
const getExpenseCard = (noteText: string, subcatText: string): string | null => {
  const noteUpper = (noteText || "").toUpperCase();
  const subcatUpper = (subcatText || "").toUpperCase();

  if (noteUpper.includes("CARD: ADCB")) return "ADCB";
  if (noteUpper.includes("CARD: SIB")) return "SIB";
  if (noteUpper.includes("CARD: SHARE")) return "Share";
  if (noteUpper.includes("CARD: NOON")) return "Noon";
  if (noteUpper.includes("CARD: HSBC")) return "HSBC";
  if (noteUpper.includes("CARD: WIO")) return "Wio";

  if (subcatUpper.includes("ADCB") || noteUpper.includes("ADCB") || noteUpper.includes("TAKEDA") || noteUpper.includes("MBTA") || noteUpper.includes("7-ELEVEN") || noteUpper.includes("ROCKIN BURGERS")) return "ADCB";
  if (subcatUpper.includes("SIB") || noteUpper.includes("SIB") || noteUpper.includes("DOORDASH") || noteUpper.includes("UBER EATS") || noteUpper.includes("THE LIBERTY HOTEL") || noteUpper.includes("ZARA.COM") || noteUpper.includes("TKD FASHION")) return "SIB";
  if (subcatUpper.includes("SHARE") || noteUpper.includes("SHARE") || noteUpper.includes("URBANCLAP")) return "Share";
  if (subcatUpper.includes("NOON") || noteUpper.includes("NOON") || noteUpper.includes("NOON MINUTES") || noteUpper.includes("NOON FOOD") || noteUpper.includes("NOON ONE")) return "Noon";
  if (subcatUpper.includes("HSBC") || noteUpper.includes("HSBC")) return "HSBC";
  if (subcatUpper.includes("WIO") || noteUpper.includes("WIO")) return "Wio";

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

// Periodic local notification logic to alert when statements are due
const NotificationHandler: React.FC = () => {
  const { expenses } = useExpenses();

  useEffect(() => {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const todayDay = today.getDate();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

      // Only alert from June 2026 onwards
      if (currentYear < 2026 || (currentYear === 2026 && currentMonth < 5)) return;

      const CARD_STATEMENT_DAYS: Record<string, number> = {
        ADCB: 5,
        HSBC: 10,
        SIB: 14,
        Share: 15,
        Noon: 25,
        Wio: daysInMonth
      };

      Object.entries(CARD_STATEMENT_DAYS).forEach(([cardKey, statementDay]) => {
        // If today is past the statement cycle day
        if (todayDay > statementDay) {
          // Find latest transaction for this card in the current month
          const cardExpenses = expenses.filter(exp => {
            if (!exp || !exp.date) return false;
            const parts = exp.date.split('-');
            if (parts.length !== 3) return false;
            const expYear = parseInt(parts[0], 10);
            const expMonth = parseInt(parts[1], 10) - 1;
            if (expYear !== currentYear || expMonth !== currentMonth) {
              return false;
            }
            const cardDetected = getExpenseCard(exp.note || "", exp.subcategory || "");
            return cardDetected === cardKey;
          });

          let maxDay = 0;
          if (cardExpenses.length > 0) {
            const latestDateStr = cardExpenses.reduce((max, exp) => exp.date > max ? exp.date : max, cardExpenses[0].date);
            const dateParts = latestDateStr.split("-");
            if (dateParts.length === 3) {
              maxDay = parseInt(dateParts[2], 10) || 0;
            }
          }

          if (maxDay < statementDay) {
            // Statement is generated but missing in db
            const storageKey = `stmt_notif_${currentYear}_${currentMonth}_${cardKey}`;
            const alreadyNotified = localStorage.getItem(storageKey);

            if (!alreadyNotified) {
              const title = "Statement Due";
              const options = {
                body: `${cardKey} statement for this month is ready (generated on the ${statementDay}th). Please import it.`,
                tag: `stmt-due-${cardKey}`,
              };

              // Safely attempt Service Worker showNotification first, then window Notification fallback
              if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then(reg => {
                  reg.showNotification(title, options).catch(e => console.warn("SW notification failed:", e));
                }).catch(() => {});
              } else {
                try {
                  new Notification(title, options);
                } catch (err) {
                  console.warn("Window Notification constructor failed:", err);
                }
              }
              localStorage.setItem(storageKey, "true");
            }
          }
        }
      });
    } catch (err) {
      console.warn("Error in NotificationHandler:", err);
    }
  }, [expenses]);

  return null;
};

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
      case "coverage":
        return <CoverageView onNavigateToImport={() => setActiveTab("import")} />;
      case "compare":
        return <CompareView />;
      case "trends":
        return <TrendsView />;
      case "import":
        return <ImportView />;
      default:
        return <DashboardView onEdit={handleEdit} />;
    }
  };

  return (
    <ExpenseProvider>
      <NotificationHandler />
      <div className="min-h-screen bg-background pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <PullToRefresh>
              {renderView()}
            </PullToRefresh>
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
