import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api",
});

export const AUTH_TOKEN_KEY = "expense_tracker_auth_token";

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

api.interceptors.request.use(config => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Transaction {
  id: number;
  user_id?: number | null;
  amount: number;
  type: "expense" | "income";
  category: string;
  merchant: string | null;
  description: string | null;
  reason: string | null;
  reason_photo: string | null;
  spend_kind: "regular" | "lent" | "investment";
  lent_to: string | null;
  lent_status: "none" | "outstanding" | "received";
  received_mode: "cash" | "account" | null;
  received_date: string | null;
  payment_mode: "cash" | "account";
  is_recurring: number;
  recurring_name: string | null;
  investment_value: number | null;
  import_fingerprint: string | null;
  source: string;
  transaction_date: string;
  created_at: string;
}

export interface TransactionCreate {
  amount: number;
  type: "expense" | "income";
  category: string;
  merchant?: string;
  description?: string;
  reason?: string | null;
  reason_photo?: string | null;
  spend_kind?: "regular" | "lent" | "investment";
  lent_to?: string | null;
  lent_status?: "none" | "outstanding" | "received";
  received_mode?: "cash" | "account" | null;
  received_date?: string | null;
  payment_mode?: "cash" | "account";
  is_recurring?: number;
  recurring_name?: string | null;
  investment_value?: number | null;
  import_fingerprint?: string | null;
  source?: string;
  transaction_date?: string;
}

export interface ListParams {
  limit?: string;
  skip?: string;
  type?: string;
  category?: string;
  spend_kind?: string;
  payment_mode?: string;
  date_from?: string;   // "YYYY-MM-DD"
  date_to?: string;     // "YYYY-MM-DD"
  order?: "asc" | "desc";
}

export const txApi = {
  list: (params?: ListParams) =>
    api.get<Transaction[]>("/transactions/", { params }).then(r => r.data),
  create: (data: TransactionCreate) =>
    api.post<Transaction>("/transactions/", data).then(r => r.data),
  update: (id: number, data: Partial<TransactionCreate>) =>
    api.patch<Transaction>(`/transactions/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/transactions/${id}`),
};

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>("/auth/register", data).then(r => r.data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", data).then(r => r.data),
  me: () => api.get<User>("/auth/me").then(r => r.data),
  logout: () => api.post("/auth/logout"),
};
