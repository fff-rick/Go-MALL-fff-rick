import type {
  LoginResponse,
  Order,
  Payment,
  Product,
  UserProfile
} from "../types";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Method = "POST";

async function request<T>(
  path: string,
  body: Record<string, unknown> | undefined,
  token?: string | null,
  method: Method = "POST"
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body ?? {})
  });

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload) ?? `请求失败: ${response.status}`, response.status);
  }

  if (payload && typeof payload === "object" && "code" in payload && Number(payload.code) !== 0) {
    throw new ApiError(extractErrorMessage(payload) ?? "接口返回异常", response.status);
  }

  return (payload ?? {}) as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { msg: text };
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const keys = ["msg", "message", "error"];
  for (const key of keys) {
    if (typeof candidate[key] === "string" && candidate[key]) {
      return candidate[key] as string;
    }
  }
  return null;
}

export { ApiError };

export async function login(mobile: string, password: string): Promise<LoginResponse> {
  const response = await request<{ accessToken: string; accessExpire: number }>(
    "/api/user/login",
    { mobile, password }
  );
  return {
    accessToken: response.accessToken,
    accessExpire: response.accessExpire
  };
}

export async function registerUser(input: {
  name: string;
  gender: number;
  mobile: string;
  password: string;
}): Promise<void> {
  await request("/api/user/register", input);
}

export async function fetchUserInfo(token: string): Promise<UserProfile> {
  return request<UserProfile>("/api/user/userinfo", {}, token);
}

export async function fetchProductDetail(id: number, token: string): Promise<Product> {
  return request<Product>("/api/product/detail", { id }, token);
}

export async function createProduct(
  token: string,
  input: Pick<Product, "name" | "desc" | "stock" | "amount" | "status">
): Promise<Product> {
  return request<Product>("/api/product/create", input, token);
}

export async function updateProduct(
  token: string,
  input: Partial<Product> & Pick<Product, "id">
): Promise<Product> {
  return request<Product>("/api/product/update", input, token);
}

export async function removeProduct(token: string, id: number): Promise<void> {
  await request("/api/product/remove", { id }, token);
}

export async function createOrder(
  token: string,
  input: { uid: number; pid: number; amount: number; status: number }
): Promise<{ id?: number }> {
  return request<{ id?: number }>("/api/order/create", input, token);
}

export async function fetchOrderDetail(token: string, id: number): Promise<Order> {
  return request<Order>("/api/order/detail", { id }, token);
}

export async function fetchOrdersByUser(token: string, uid: number): Promise<Order[]> {
  return request<Order[]>("/api/order/list", { uid }, token);
}

export async function createPayment(
  token: string,
  input: { uid: number; oid: number; source: number; amount: number }
): Promise<{ id: number }> {
  return request<{ id: number }>("/api/pay/create", input, token);
}

export async function fetchPaymentDetail(token: string, id: number): Promise<Payment> {
  return request<Payment>("/api/pay/detail", { id }, token);
}

export async function callbackPayment(
  token: string,
  input: { id: number; uid: number; oid: number; amount: number; source: number; status: number }
): Promise<void> {
  await request("/api/pay/callback", input, token);
}
