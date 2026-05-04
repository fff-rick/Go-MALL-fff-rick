export interface LoginResponse {
  accessToken: string;
  accessExpire: number;
}

export interface UserProfile {
  id: number;
  name: string;
  gender: number;
  mobile: string;
}

export interface Product {
  id: number;
  name: string;
  desc: string;
  stock: number;
  amount: number;
  status: number;
}

export interface Order {
  id: number;
  uid: number;
  pid: number;
  amount: number;
  status: number;
}

export interface Payment {
  id: number;
  uid: number;
  oid: number;
  amount: number;
  source: number;
  status: number;
}

export interface SessionState {
  token: string | null;
  expiresAt: number | null;
  user: UserProfile | null;
}
