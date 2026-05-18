"use client";
import { useEffect, useState } from "react";

const BUDGETS_KEY = "expense_tracker_category_budgets";

export type CategoryBudgets = Record<string, number>;

function readBudgets(): CategoryBudgets {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(BUDGETS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, number] => (
          typeof entry[0] === "string" &&
          typeof entry[1] === "number" &&
          Number.isFinite(entry[1]) &&
          entry[1] > 0
        )),
    );
  } catch {
    return {};
  }
}

function writeBudgets(budgets: CategoryBudgets) {
  localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
  window.dispatchEvent(new Event("category-budgets-updated"));
}

export function useCategoryBudgets() {
  const [budgets, setBudgets] = useState<CategoryBudgets>({});

  useEffect(() => {
    const refresh = () => setBudgets(readBudgets());
    refresh();
    window.addEventListener("category-budgets-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("category-budgets-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function setBudget(category: string, amount: number) {
    const next = { ...budgets };
    if (!Number.isFinite(amount) || amount <= 0) {
      delete next[category];
    } else {
      next[category] = Math.round(amount);
    }
    setBudgets(next);
    writeBudgets(next);
  }

  return { budgets, setBudget };
}
