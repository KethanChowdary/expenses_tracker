export const CATEGORIES = [
  "Food", "Transport", "Groceries", "Utilities",
  "Shopping", "Health", "Entertainment", "Rent",
  "Salary", "Freelance", "Lent", "Investment", "Other",
] as const;

export type Category = typeof CATEGORIES[number];

export const CATEGORY_EMOJI: Record<string, string> = {
  Food: "🍽️", Transport: "🚗", Groceries: "🛒",
  Utilities: "💡", Shopping: "🛍️", Health: "💊",
  Entertainment: "🎬", Rent: "🏠", Salary: "💰",
  Freelance: "💻", Lent: "🤝", Investment: "📈", Other: "📦",
};

// Quick-add NLP: keyword → category
export const CATEGORY_KEYWORDS: Record<string, string> = {
  coffee: "Food", cafe: "Food", lunch: "Food", dinner: "Food",
  breakfast: "Food", food: "Food", eat: "Food", restaurant: "Food",
  swiggy: "Food", zomato: "Food", biryani: "Food", pizza: "Food",
  uber: "Transport", ola: "Transport", auto: "Transport", bus: "Transport",
  metro: "Transport", petrol: "Transport", fuel: "Transport",
  grocery: "Groceries", groceries: "Groceries", zepto: "Groceries",
  blinkit: "Groceries", vegetables: "Groceries", milk: "Groceries",
  electricity: "Utilities", water: "Utilities", internet: "Utilities",
  phone: "Utilities", recharge: "Utilities",
  amazon: "Shopping", flipkart: "Shopping", clothes: "Shopping",
  salary: "Salary", income: "Salary", credit: "Salary",
  freelance: "Freelance", rent: "Rent",
  lent: "Lent", loan: "Lent", investment: "Investment", invest: "Investment",
  mutual: "Investment", stock: "Investment", sip: "Investment",
  movie: "Entertainment", netflix: "Entertainment", spotify: "Entertainment",
};

export function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [kw, cat] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(kw)) return cat;
  }
  return "Other";
}

export function isIncomeCategory(category: string) {
  return category === "Salary" || category === "Freelance";
}

export function looksLikeIncome(text: string) {
  const lower = text.toLowerCase();
  return [
    "salary", "income", "credit", "freelance", "paid", "payment received",
    "refund", "reimbursement", "cashback", "interest", "bonus",
  ].some(word => lower.includes(word));
}

// "coffee 180" or "180 coffee" → { merchant, amount }
export function parseQuickAdd(input: string): { merchant: string; amount: number } | null {
  const parts = input.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const last = parseFloat(parts[parts.length - 1]);
  const first = parseFloat(parts[0]);
  if (!isNaN(last)) {
    return { merchant: parts.slice(0, -1).join(" "), amount: last };
  }
  if (!isNaN(first)) {
    return { merchant: parts.slice(1).join(" "), amount: first };
  }
  return null;
}
