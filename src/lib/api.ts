const BASE = "https://whisperbox.koyeb.app";

// Token storage — memory only (no localStorage for raw tokens)
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(at: string, rt: string) {
  accessToken = at;
  refreshToken = rt;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

export function getAccessToken() { return accessToken; }
export function getRefreshToken() { return refreshToken; }

export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  accessToken = data.access_token;
  return true;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as Record<string, string> || {}) };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401 && retry) {
    const ok = await refreshAccessToken();
    if (ok) return request<T>(path, init, false);
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail?.[0]?.msg || body?.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  public_key: string;
  wrapped_private_key: string;
  pbkdf2_salt: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserProfile;
}

export function register(body: {
  username: string; display_name: string; password: string;
  public_key: string; wrapped_private_key: string; pbkdf2_salt: string;
}): Promise<AuthResponse> {
  return request("/auth/register", { method: "POST", body: JSON.stringify(body) });
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function logout(): Promise<unknown> {
  return request("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) });
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface UserPublicInfo { id: string; username: string; display_name: string; }

export function searchUsers(q: string): Promise<UserPublicInfo[]> {
  return request(`/users/search?q=${encodeURIComponent(q)}`);
}

export function getUserPublicKey(userId: string): Promise<{ public_key: string }> {
  return request(`/users/${userId}/public-key`);
}

// ── Messages ──────────────────────────────────────────────────────────────────

export interface EncryptedPayload {
  ciphertext: string; iv: string; encryptedKey: string; encryptedKeyForSelf: string;
}

export interface MessageResponse {
  id: string; from_user_id: string; to_user_id: string;
  payload: EncryptedPayload; delivered: boolean; created_at: string;
}

export interface ConversationSummary {
  user_id: string; display_name: string; username: string; last_message_at: string | null;
}

export function listConversations(): Promise<ConversationSummary[]> {
  return request("/conversations");
}

export function getMessages(userId: string, before?: string): Promise<MessageResponse[]> {
  const q = before ? `?before=${encodeURIComponent(before)}` : "";
  return request(`/conversations/${userId}/messages${q}`);
}

export function sendMessageRest(to: string, payload: EncryptedPayload): Promise<MessageResponse> {
  return request("/messages", { method: "POST", body: JSON.stringify({ to, payload }) });
}
