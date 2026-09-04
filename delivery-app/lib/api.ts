import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./config";

const TOKEN_KEY = "sadharmik_rider_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 401) {
    await clearToken();
    onUnauthorized?.();
  }
  return response;
}

export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  servicePincodes: string[];
  rating: number | null;
}

export interface RiderOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerVipNumber: number;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  total: number;
  deliveryNotes: string | null;
  isPriority: boolean;
  rescheduledDate: string | null;
  rescheduleReason: string | null;
  items: { id: string; productName: string; quantity: number; unitPrice: number }[];
}

export async function login(phone: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/rider/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    return { ok: false, error: data.error ?? "Login failed." };
  }
  await setToken(data.token);
  return { ok: true };
}

export async function fetchMe(): Promise<RiderProfile | null> {
  const response = await authedFetch("/api/rider/me");
  if (!response.ok) return null;
  const data = await response.json();
  return data.ok ? data.rider : null;
}

export async function fetchMyDeliveries(
  status: "pending" | "in_progress" | "complete" | "failed" | "rescheduled"
): Promise<RiderOrder[]> {
  const response = await authedFetch(`/api/rider/orders?status=${status}`);
  if (!response.ok) throw new Error("Could not load deliveries.");
  const data = await response.json();
  if (!data.ok) throw new Error(data.error ?? "Could not load deliveries.");
  return data.orders;
}

export async function fetchOrder(orderId: string): Promise<RiderOrder> {
  const response = await authedFetch(`/api/rider/orders/${orderId}`);
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not load order.");
  return data.order;
}

export async function markDelivered(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const response = await authedFetch(`/api/rider/orders/${orderId}/deliver`, { method: "POST" });
  const data = await response.json();
  return { ok: data.ok, error: data.error };
}

export async function markFailed(orderId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const response = await authedFetch(`/api/rider/orders/${orderId}/fail`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  const data = await response.json();
  return { ok: data.ok, error: data.error };
}

export async function pickupOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const response = await authedFetch(`/api/rider/orders/${orderId}/pickup`, { method: "POST" });
  const data = await response.json();
  return { ok: data.ok, error: data.error };
}

export async function rescheduleOrder(
  orderId: string,
  date: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await authedFetch(`/api/rider/orders/${orderId}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ date, reason }),
  });
  const data = await response.json();
  return { ok: data.ok, error: data.error };
}

export interface DashboardSummary {
  totalAssigned: number;
  pickedUp: number;
  delivered: number;
  failed: number;
  todaysCollectionsTotal: number;
  totalDeliveries: number;
  rating: number | null;
}

export async function fetchDashboard(): Promise<DashboardSummary> {
  const response = await authedFetch("/api/rider/dashboard");
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not load dashboard.");
  return data.summary;
}

export interface BalanceOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  paymentMethod: string;
}

export interface BalanceCollection {
  orders: BalanceOrder[];
  total: number;
}

export async function fetchBalance(): Promise<BalanceCollection> {
  const response = await authedFetch("/api/rider/balance");
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not load balance.");
  return data.balance;
}

export interface Expense {
  id: string;
  amount: number;
  category: string | null;
  notes: string | null;
  expenseDate: string;
}

export async function fetchExpenses(period: "today" | "week" | "month"): Promise<{ expenses: Expense[]; total: number }> {
  const response = await authedFetch(`/api/rider/expenses?period=${period}`);
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not load expenses.");
  return { expenses: data.expenses, total: data.total };
}

export async function createExpense(
  amount: number,
  category: string,
  notes: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await authedFetch("/api/rider/expenses", {
    method: "POST",
    body: JSON.stringify({ amount, category, notes }),
  });
  const data = await response.json();
  return { ok: data.ok, error: data.error };
}

export interface DeliverySheetOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  total: number;
  items: { productName: string; quantity: number }[];
}

export interface DeliverySheet {
  orders: DeliverySheetOrder[];
  totalOrders: number;
  totalItems: number;
  totalAmount: number;
  totalCod: number;
}

export async function fetchDeliverySheet(filter: "today" | "all"): Promise<DeliverySheet> {
  const response = await authedFetch(`/api/rider/delivery-sheet?filter=${filter}`);
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not load delivery sheet.");
  return data.sheet;
}
