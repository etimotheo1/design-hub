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
  role: User["role"] = "tech",
  email: string | null = null,
  mustChangePassword: boolean = false
): Promise<AuthResult> {
  username = username.trim().toLowerCase();
  if (!username || !password) return { ok: false, error: "Username and password are required." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const existing = get<User>(`SELECT * FROM users WHERE username = ?`, [username]);
  if (existing) return { ok: false, error: "That username is already taken." };

  const hash = await hashPassword(password);
  const result = run(
    `INSERT INTO users (username, password_hash, display_name, role, email, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [username, hash, displayName.trim() || username, role, email?.trim() || null, mustChangePassword ? 1 : 0]
  );

  const user: SessionUser = {
    id: Number(result.lastInsertRowid),
    username,
    display_name: displayName.trim() || username,
    role,
    must_change_password: mustChangePassword ? 1 : 0,
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
      must_change_password: row.must_change_password ?? 0,
    },
  };
}

// Set a new password and clear the must_change_password flag.
export async function changeUserPassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: "New password must be at least 6 characters." };
  }
  const row = get<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = ?`,
    [userId]
  );
  if (!row) return { ok: false, error: "User not found." };
  const ok = await verifyPassword(currentPassword, row.password_hash);
  if (!ok) return { ok: false, error: "Current password is incorrect." };

  const hash = await hashPassword(newPassword);
  run(
    `UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`,
    [hash, userId]
  );
  return { ok: true };
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
    must_change_password: number;
    expires_at: string;
  }>(
    `SELECT u.id, u.username, u.display_name, u.role, u.must_change_password, s.expires_at
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
    must_change_password: row.must_change_password ?? 0,
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
// from the home page so the user has something to log in with. Admin is NOT
// forced through the change-password modal — they can use the "Password"
// link in the top nav whenever they want.
export async function ensureAdminSeed() {
  getDb();
  const anyAdmin = get<{ c: number }>(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`);
  if (anyAdmin && anyAdmin.c > 0) return;

  const hash = await hashPassword("changeme");
  run(
    `INSERT OR IGNORE INTO users (username, password_hash, display_name, role, must_change_password)
     VALUES (?, ?, ?, ?, 0)`,
    ["elia", hash, "Elia", "admin"]
  );
}

// Bootstrap: pseudo-user for external form submitters. Cards created from a
// public /s/[token] form are attributed to this user. They can never log in
// (random un-guessable hash). Returns the user id.
export async function ensureExternalUser(): Promise<number> {
  const existing = get<{ id: number }>(`SELECT id FROM users WHERE username = 'external'`);
  if (existing) return existing.id;
  // Random hash — nobody can ever sign in as this user.
  const randomHash = await hashPassword(`external-${Math.random()}-${Date.now()}`);
  const result = run(
    `INSERT INTO users (username, password_hash, display_name, role, access_policy)
     VALUES ('external', ?, 'External Submitter', 'non_tech', 'restricted')`,
    [randomHash]
  );
  return Number(result.lastInsertRowid);
}

// Bootstrap: an "Inbox" project that holds form submissions awaiting project
// assignment. Visible to admins only.
export function ensureInboxProject(creatorId: number): number {
  const existing = get<{ id: number }>(`SELECT id FROM projects WHERE name = '📥 Submission Inbox'`);
  if (existing) return existing.id;
  const result = run(
    `INSERT INTO projects (name, description, color, visibility, created_by, archived)
     VALUES ('📥 Submission Inbox', 'Form submissions waiting for project assignment.', 'amber', 'private', ?, 0)`,
    [creatorId]
  );
  return Number(result.lastInsertRowid);
}

// Generate a memorable yet random temporary password for invited users.
// Format: <word>-<word>-<3 digits> (e.g. "river-otter-482"). Easy to type, hard to guess.
const WORDS = [
  "river","mountain","forest","harbor","meadow","valley","desert","island","ocean","summit",
  "garden","prairie","canyon","glacier","savanna","tundra","volcano","jungle","lagoon","beach",
  "otter","raven","heron","falcon","wolf","fox","badger","lynx","owl","hawk",
  "amber","azure","crimson","ember","ivory","jade","onyx","silver","topaz","violet",
];
export function generateTempPassword(): string {
  const w1 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const w2 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const n = Math.floor(Math.random() * 900) + 100;
  return `${w1}-${w2}-${n}`;
}
