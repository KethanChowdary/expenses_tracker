/**
 * usePeriod — shared period-selection logic
 *
 * Modes:
 *   "monthly"  — a calendar month (default = current month)
 *   "salary"   — salary-cycle: from day N of month M to day N-1 of month M+1
 *   "custom"   — user-supplied date_from / date_to
 */

import { useState, useMemo } from "react";

export type PeriodMode = "monthly" | "salary" | "custom";

export interface Period {
  mode: PeriodMode;
  dateFrom: string;   // "YYYY-MM-DD"
  dateTo: string;     // "YYYY-MM-DD"
  label: string;      // human-readable
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date)   { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function monthStart(year: number, month: number) {
  return ymd(new Date(year, month, 1));
}
function monthEnd(year: number, month: number) {
  return ymd(new Date(year, month + 1, 0));   // last day of month
}

const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export function usePeriod() {
  const now = new Date();

  const [mode, setMode]           = useState<PeriodMode>("monthly");
  const [monthYear, setMonthYear] = useState({ y: now.getFullYear(), m: now.getMonth() });
  // salary cycle: which day of month salary arrives (default 1st)
  const [salaryDay, setSalaryDay] = useState(1);
  // salary cycle: which month/year the cycle starts
  const [salaryStart, setSalaryStart] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [customFrom, setCustomFrom] = useState(monthStart(now.getFullYear(), now.getMonth()));
  const [customTo,   setCustomTo]   = useState(monthEnd(now.getFullYear(), now.getMonth()));

  const period: Period = useMemo(() => {
    if (mode === "monthly") {
      const { y, m } = monthYear;
      return {
        mode,
        dateFrom: monthStart(y, m),
        dateTo:   monthEnd(y, m),
        label: `${MONTH_NAMES[m]} ${y}`,
      };
    }
    if (mode === "salary") {
      const { y, m } = salaryStart;
      // cycle start: salaryDay of this month
      const from = new Date(y, m, salaryDay);
      // cycle end: salaryDay-1 of next month
      const to   = new Date(y, m + 1, salaryDay - 1);
      return {
        mode,
        dateFrom: ymd(from),
        dateTo:   ymd(to),
        label: `${pad(salaryDay)} ${MONTH_NAMES[m]} → ${pad(salaryDay-1||monthEnd(y,m+1).slice(-2) as unknown as number)} ${MONTH_NAMES[(m+1)%12]}`,
      };
    }
    // custom
    return {
      mode,
      dateFrom: customFrom,
      dateTo:   customTo,
      label: `${customFrom} → ${customTo}`,
    };
  }, [mode, monthYear, salaryDay, salaryStart, customFrom, customTo]);

  // Navigation helpers for monthly / salary
  function prevPeriod() {
    if (mode === "monthly") {
      setMonthYear(({ y, m }) => m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 });
    } else if (mode === "salary") {
      setSalaryStart(({ y, m }) => m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 });
    }
  }
  function nextPeriod() {
    if (mode === "monthly") {
      setMonthYear(({ y, m }) => m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 });
    } else if (mode === "salary") {
      setSalaryStart(({ y, m }) => m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 });
    }
  }

  return {
    period, mode, setMode,
    monthYear, setMonthYear,
    salaryDay, setSalaryDay,
    salaryStart, setSalaryStart,
    customFrom, setCustomFrom,
    customTo, setCustomTo,
    prevPeriod, nextPeriod,
    MONTH_NAMES,
  };
}