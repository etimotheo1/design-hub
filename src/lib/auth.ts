import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getDb, get, run } from "./db";
import type { SessionUser, User } from "./types";

const SESSION_COOKIE = "dh_session";
const SESSION_DURATION_DAYS = 30;

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: SessionUser;
}

export async function registerUser(
  username: string,
  password: string,
  displayName: string,
  role: User["role"] = "tech"
): Promise<AuthResult> {
  username = username.trim().toLowerCase();
  if (!username || !password) return { ok: false, error: "Username and password are required." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const existing = get<User>(`SELECT * FROM users WHERE username = ?`, [username]);
  if (existing) return { ok: false, error: "That username is already taken." };

  const hash = await hashPassword(password);
  const result = run(
    `INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)`,
    [username, hash, displayName.trim() || username, role]
  );

  const user: SessionUser = {
    id: Number(result.lastInsertRowid),
    username,
    display_name: displayName.trim() || username,
    role,
  };
  return { ok: true, user };
}

export async function loginUser(username: string, password: string): Promise<AuthResult> {
  username = username.trim().toLowerCase();
  const row = get<User & { password_hash: string }>(
    `SELECT * FROM users WHERE username = ?`,
    [username]
  );
  if (!row) return { ok: false, error: "Invalid username or password." };

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return { ok: false, error: "Invalid username or password." };

  return {
    ok: true,
    user: {
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      role: row.role,
    },
  };
}

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  run(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
    [token, userId, isoDaysFromNow(SESSION_DURATION_DAYS)]
  );
  return token;
}

export function destroySession(token: string) {
  run(`DELETE FROM sessions WHERE token = ?`, [token]);
}

export function getCurrentUser(): SessionUser | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = get<{
    id: number;
    username: string;
    display_name: string;
    role: User["role"];
    expires_at: string;
  }>(
    `SELECT u.id, u.username, u.display_name, u.role, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
    [token]
  );
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    destroySession(token);
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
  };
}

export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

// Bootstrap: ensure at least one admin user exists. Called on first DB access
// from the home page so the user has something to log in with.
export async function ensureAdminSeed() {
  // Touch the DB so schema is created.
  getDb();
  const anyAdmin = get<{ c: number }>(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`);
  if (anyAdmin && anyAdmin.c > 0) return;

  const hash = await hashPassword("changeme");
  run(
    `INSERT OR IGNORE INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)`,
    ["elia", hash, "Elia", "admin"]
  );
}
