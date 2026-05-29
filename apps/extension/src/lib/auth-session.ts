import type { AuthTokens, AuthUser } from "@linvo-ai/shared";

const AUTH_SESSION_KEY = "linvo-ai.auth-session";

export interface StoredAuthSession {
  tokens: AuthTokens;
  user: AuthUser;
}

export async function getAuthSession(): Promise<StoredAuthSession | null> {
  const result = await chrome.storage.local.get(AUTH_SESSION_KEY);
  return (result[AUTH_SESSION_KEY] as StoredAuthSession | undefined) ?? null;
}

export async function setAuthSession(session: StoredAuthSession): Promise<void> {
  await chrome.storage.local.set({ [AUTH_SESSION_KEY]: session });
}

export async function clearAuthSession(): Promise<void> {
  await chrome.storage.local.remove(AUTH_SESSION_KEY);
}
