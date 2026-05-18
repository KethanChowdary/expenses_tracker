"use client";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "./categories";
import { CATEGORY_EMOJI } from "./categories";

const STORAGE_KEY = "expense_tracker_custom_categories";
const EMOJI_KEY = "expense_tracker_custom_category_icons";
const HIDDEN_KEY = "expense_tracker_hidden_categories";

export const CATEGORY_ICON_OPTIONS = [
  "📦", "🍽️", "☕", "🛒", "🚗", "🏠", "💡", "💊",
  "🎬", "🛍️", "✈️", "🎁", "📚", "🏋️", "🐾", "🧾",
  "💰", "💻", "📱", "🎮", "🧰", "🪴", "🍿", "🚌",
] as const;

export function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function readCustomCategories(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export function readCustomCategoryIcons(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(EMOJI_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, string] => (
            typeof entry[0] === "string" && typeof entry[1] === "string"
          )),
        )
      : {};
  } catch {
    return {};
  }
}

export function readHiddenCategories(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(HIDDEN_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

function writeCustomCategories(categories: string[], icons: Record<string, string>, hidden: string[] = readHiddenCategories()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  localStorage.setItem(EMOJI_KEY, JSON.stringify(icons));
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
  window.dispatchEvent(new Event("custom-categories-updated"));
}

export function useCategories() {
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customIcons, setCustomIcons] = useState<Record<string, string>>({});
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => {
      setCustomCategories(readCustomCategories());
      setCustomIcons(readCustomCategoryIcons());
      setHiddenCategories(readHiddenCategories());
    };
    refresh();
    window.addEventListener("custom-categories-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("custom-categories-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const categories = useMemo(() => {
    const all = [...CATEGORIES, ...customCategories].filter(c => !hiddenCategories.includes(c));
    return Array.from(new Set(all));
  }, [customCategories, hiddenCategories]);

  function getCategoryIcon(category: string) {
    return customIcons[category] || CATEGORY_EMOJI[category] || "📦";
  }

  function addCategory(name: string, icon = "📦") {
    const normalized = normalizeCategoryName(name);
    if (!normalized) return null;
    const existing = categories.find(c => c.toLowerCase() === normalized.toLowerCase());
    if (existing) {
      if (!CATEGORY_EMOJI[existing]) {
        const nextIcons = { ...customIcons, [existing]: icon };
        setCustomIcons(nextIcons);
        writeCustomCategories(customCategories, nextIcons, hiddenCategories);
      }
      return existing;
    }
    const next = [...customCategories, normalized].sort((a, b) => a.localeCompare(b));
    const nextIcons = { ...customIcons, [normalized]: icon };
    setCustomCategories(next);
    setCustomIcons(nextIcons);
    writeCustomCategories(next, nextIcons, hiddenCategories);
    return normalized;
  }

  function updateCategoryIcon(category: string, icon: string) {
    const nextIcons = { ...customIcons, [category]: icon };
    setCustomIcons(nextIcons);
    writeCustomCategories(customCategories, nextIcons, hiddenCategories);
  }

  function removeCategory(category: string) {
    const nextCategories = customCategories.filter(c => c !== category);
    const nextIcons = { ...customIcons };
    delete nextIcons[category];
    setCustomCategories(nextCategories);
    setCustomIcons(nextIcons);
    writeCustomCategories(nextCategories, nextIcons, hiddenCategories);
  }

  function renameCategory(oldName: string, newName: string) {
    const normalized = normalizeCategoryName(newName);
    if (!normalized || normalized === oldName) return oldName;
    const nextCategories = customCategories
      .map(c => c === oldName ? normalized : c)
      .sort((a, b) => a.localeCompare(b));
    const nextIcons = { ...customIcons, [normalized]: customIcons[oldName] || "📦" };
    delete nextIcons[oldName];
    const nextHidden = hiddenCategories.map(c => c === oldName ? normalized : c);
    setCustomCategories(nextCategories);
    setCustomIcons(nextIcons);
    setHiddenCategories(nextHidden);
    writeCustomCategories(nextCategories, nextIcons, nextHidden);
    return normalized;
  }

  function setCategoryHidden(category: string, hidden: boolean) {
    const nextHidden = hidden
      ? Array.from(new Set([...hiddenCategories, category]))
      : hiddenCategories.filter(c => c !== category);
    setHiddenCategories(nextHidden);
    writeCustomCategories(customCategories, customIcons, nextHidden);
  }

  return {
    categories,
    customCategories,
    customIcons,
    hiddenCategories,
    getCategoryIcon,
    addCategory,
    updateCategoryIcon,
    removeCategory,
    renameCategory,
    setCategoryHidden,
  };
}
