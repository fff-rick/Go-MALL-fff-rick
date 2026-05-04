import type { SessionState } from "../types";

const SESSION_KEY = "forge-mall-session";
const PAYMENT_MAP_KEY = "forge-mall-payment-map";

type PaymentMap = Record<string, number>;

export function readSession(): SessionState {
  if (typeof window === "undefined") {
    return { token: null, expiresAt: null, user: null };
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return { token: null, expiresAt: null, user: null };
  }

  try {
    const parsed = JSON.parse(raw) as SessionState;
    return {
      token: parsed.token ?? null,
      expiresAt: parsed.expiresAt ?? null,
      user: parsed.user ?? null
    };
  } catch {
    return { token: null, expiresAt: null, user: null };
  }
}

export function writeSession(session: SessionState): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(SESSION_KEY);
}

export function readPaymentMap(): PaymentMap {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(PAYMENT_MAP_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as PaymentMap;
  } catch {
    return {};
  }
}

export function writePaymentReference(orderId: number, paymentId: number): void {
  const map = readPaymentMap();
  map[String(orderId)] = paymentId;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PAYMENT_MAP_KEY, JSON.stringify(map));
  }
}

export function readPaymentReference(orderId: number): number | null {
  const map = readPaymentMap();
  return map[String(orderId)] ?? null;
}
