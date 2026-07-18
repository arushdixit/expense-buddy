import React, { useEffect, useState } from "react";
import { useExpenses } from "@/context/ExpenseContext";
import { getStatementRecords, seedStatementRecords, StatementRecord } from "@/lib/statementParser";
import { getMonthName } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, AlertTriangle, FileText, CheckCircle2, 
  History, Calendar, Info
} from "lucide-react";
import { format } from "date-fns";

const CARD_COLORS: Record<string, string> = {
  Wio: "#5700FF",    // Electric Violet
  Noon: "#F6BE00",   // Noon Gold / Yellow
  HSBC: "#DB0011",   // HSBC Red
  ADCB: "#273239",   // Dark Charcoal
  SIB: "#001489",    // Deep Resolution Blue
  Share: "#00A3A0",  // SHARE Teal
};

const formatDateReadable = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return format(d, "MMM dd, yyyy");
  } catch (e) {
    return dateStr;
  }
};

// Calculate expected latest statement date based on today's date and card cycle
const getExpectedStatementDate = (card: string, today: Date): { dateStr: string; label: string } => {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  
  if (card === "Wio") {
    // Wio statement is monthly and ends on the last day of the previous calendar month.
    // (Since the current calendar month is still open/active and hasn't closed yet)
    const prevMonthLastDay = new Date(y, m, 0).getDate();
    let prevM = m - 1;
    let prevY = y;
    if (prevM < 0) {
      prevM = 11;
      prevY = y - 1;
    }
    const padM = String(prevM + 1).padStart(2, "0");
    const padD = String(prevMonthLastDay).padStart(2, "0");
    return {
      dateStr: `${prevY}-${padM}-${padD}`,
      label: `${getMonthName(prevM)} ${prevMonthLastDay}, ${prevY}`
    };
  }

  const statementDay = {
    ADCB: 5,
    HSBC: 10,
    SIB: 14,
    Share: 15,
    Noon: 25
  }[card] || 15;

  let targetYear = y;
  let targetMonth = m;

  if (d < statementDay) {
    // Current month's statement is not generated yet. Latest expected is previous month.
    targetMonth = m - 1;
    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear = y - 1;
    }
  }

  const padM = String(targetMonth + 1).padStart(2, "0");
  const padD = String(statementDay).padStart(2, "0");
  return {
    dateStr: `${targetYear}-${padM}-${padD}`,
    label: `${getMonthName(targetMonth)} ${statementDay}, ${targetYear}`
  };
};

export const CoverageView: React.FC = () => {
  const { expenses } = useExpenses();
  const [records, setRecords] = useState<StatementRecord[]>([]);

  // Seed history on mount
  useEffect(() => {
    const seed = async () => {
      await seedStatementRecords();
      setRecords(getStatementRecords());
    };
    seed();
  }, [expenses]);

  const today = new Date();

  // Compute status for all 6 cards
  const cardsStatus = Object.keys(CARD_COLORS).map((cardKey) => {
    const cardRecords = records.filter((r) => r.card === cardKey);
    const sorted = [...cardRecords].sort((a, b) => b.endDate.localeCompare(a.endDate));
    const latestRecord = sorted[0] || null;

    const expected = getExpectedStatementDate(cardKey, today);
    
    let isWarning = false;
    let warningMessage = "";

    if (!latestRecord) {
      isWarning = true;
      warningMessage = `No statements imported. Expected coverage up to ${expected.label}.`;
    } else if (latestRecord.endDate < expected.dateStr) {
      isWarning = true;
      warningMessage = `Statement due. Covered up to ${formatDateReadable(latestRecord.endDate)}, but expected up to ${expected.label}.`;
    }

    return {
      key: cardKey,
      color: CARD_COLORS[cardKey],
      latestRecord,
      expected,
      isWarning,
      warningMessage,
    };
  });

  const upToDateCount = cardsStatus.filter((c) => !c.isWarning).length;
  
  // Timeline sorted by importedAt descending
  const sortedRecords = [...records].sort((a, b) => b.importedAt - a.importedAt);

  return (
    <div className="pb-24 px-4 space-y-6">
      {/* Header */}
      <div className="mt-4 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Statement Coverage</h1>
        <p className="text-muted-foreground text-xs">
          Track coverage periods and missing statement uploads.
        </p>
      </div>

      {/* Summary Scoreboard */}
      <Card className="p-4 rounded-3xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Account Sync Status</p>
            <p className="font-bold text-sm text-foreground">
              {upToDateCount} of 6 accounts up to date
            </p>
          </div>
        </div>
        <Badge variant={upToDateCount === 6 ? "default" : "secondary"} className="rounded-full">
          {upToDateCount === 6 ? "Ready" : `${6 - upToDateCount} Due`}
        </Badge>
      </Card>

      {/* Cards List */}
      <div className="space-y-4">
        {cardsStatus.map((card) => (
          <Card 
            key={card.key}
            className="p-5 rounded-3xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md space-y-3 hover:scale-[1.01] transition-transform duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span 
                  className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-inner"
                  style={{ backgroundColor: card.color }}
                />
                <span className="font-bold text-base text-foreground">{card.key}</span>
              </div>
              
              <div>
                {card.isWarning ? (
                  <Badge className="bg-yellow-500/10 hover:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border border-yellow-500/20 rounded-full flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Statement Due
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/10 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Up to Date
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-0.5">
                <p className="text-muted-foreground font-medium">Covered Period</p>
                <p className="font-bold text-foreground">
                  {card.latestRecord 
                    ? `${formatDateReadable(card.latestRecord.startDate)} – ${formatDateReadable(card.latestRecord.endDate)}`
                    : "No data"}
                </p>
              </div>

              <div className="space-y-0.5 text-right">
                <p className="text-muted-foreground font-medium">Source Statement</p>
                <p className="font-semibold text-foreground truncate max-w-[150px] ml-auto">
                  {card.latestRecord ? card.latestRecord.filename : "Pending Import"}
                </p>
              </div>
            </div>

            {card.isWarning && (
              <div className="flex gap-2 items-start bg-yellow-500/[0.04] p-3 rounded-2xl border border-yellow-500/10 text-xs text-yellow-600 dark:text-yellow-500/90 font-medium">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{card.warningMessage}</span>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* History Log */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5 px-1">
          <History className="h-4 w-4" />
          Import History Log
        </h2>

        {sortedRecords.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No statement files recorded in the import log yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {sortedRecords.map((rec, idx) => (
              <div 
                key={`${rec.card}_${rec.endDate}_${idx}`}
                className="flex items-center justify-between bg-card/40 border border-border/40 p-3 rounded-2xl text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate max-w-[180px]">{rec.filename}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {rec.card} • {formatDateReadable(rec.startDate)} to {formatDateReadable(rec.endDate)}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-medium text-foreground">Imported</p>
                  <p className="text-[9px] text-muted-foreground">
                    {format(new Date(rec.importedAt), "MMM dd, HH:mm")}
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
