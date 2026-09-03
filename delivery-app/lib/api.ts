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

export async function fetchMyDeliveries(status: "pending" | "complete" | "failed"): Promise<RiderOrder[]> {
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
