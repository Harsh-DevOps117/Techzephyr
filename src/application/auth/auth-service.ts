import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { config } from "../../infrastructure/config/env.js";
import { query } from "../../infrastructure/database/postgres.js";
import { logger } from "../../infrastructure/logging/logger.js";

const secret = new TextEncoder().encode(config.JWT_SECRET);

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function issue(user: { id: string; role: string }) {
  const accessToken = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${config.ACCESS_TOKEN_MINUTES}m`)
    .sign(secret);
  const refreshToken = randomBytes(32).toString("base64url");
  await query(
    "INSERT INTO auth_session (id, user_id, refresh_hash, expires_at) VALUES ($1, $2, $3, now() + ($4::int * interval '1 day'))",
    [uuidv7(), user.id, hashToken(refreshToken), config.REFRESH_TOKEN_DAYS],
  );
  return { accessToken, refreshToken, expiresIn: config.ACCESS_TOKEN_MINUTES * 60, role: user.role };
}

export async function login(email: string, password: string) {
  const found = await query<{ id: string; role: string; password_hash: string }>(
    "SELECT id, role, password_hash FROM app_user WHERE email = $1",
    [email],
  );
  const user = found.rows[0];
  if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    logger.warn("auth.login_failed", { email });
    throw new Error("invalid_credentials");
  }
  logger.info("auth.login", { userId: user.id, role: user.role });
  return issue(user);
}

export async function refresh(refreshToken: string) {
  const found = await query<{ id: string; user_id: string; role: string }>(
    `SELECT s.id, s.user_id, u.role
     FROM auth_session s JOIN app_user u ON u.id = s.user_id
     WHERE s.refresh_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [hashToken(refreshToken)],
  );
  const session = found.rows[0];
  if (!session) throw new Error("invalid_refresh");
  await query("UPDATE auth_session SET revoked_at = now() WHERE id = $1", [session.id]);
  logger.info("auth.refresh", { userId: session.user_id });
  return issue({ id: session.user_id, role: session.role });
}

function codeHash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function requestPasswordReset(email: string, phone: string) {
  const found = await query<{ id: string }>("SELECT id FROM app_user WHERE email = $1", [email.toLowerCase()]);
  const user = found.rows[0];
  if (!user) throw new Error("unknown_account");
  const code = String(randomInt(100000, 1000000));
  await query("DELETE FROM password_reset WHERE user_id = $1", [user.id]);
  await query(
    "INSERT INTO password_reset (id, user_id, code_hash, phone, expires_at) VALUES ($1, $2, $3, $4, now() + interval '10 minutes')",
    [uuidv7(), user.id, codeHash(code), phone],
  );
  const sid = config.TWILIO_ACCOUNT_SID;
  const token = config.TWILIO_AUTH_TOKEN;
  const from = config.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    logger.info("auth.password_reset_demo", { userId: user.id });
    return { sent: true, demo: true, demoCode: code };
  }
  const body = new URLSearchParams({ To: phone, From: from, Body: `TechZephyr password code: ${code}. It expires in 10 minutes.` });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    await query("DELETE FROM password_reset WHERE user_id = $1", [user.id]);
    logger.warn("auth.password_reset_sms_failed", { userId: user.id, status: response.status });
    throw new Error("sms_failed");
  }
  logger.info("auth.password_reset_sent", { userId: user.id });
  return { sent: true, demo: false };
}

export async function confirmPasswordReset(email: string, code: string, password: string) {
  const found = await query<{ id: string; code_hash: string }>(
    `SELECT u.id, r.code_hash
     FROM password_reset r JOIN app_user u ON u.id = r.user_id
     WHERE u.email = $1 AND r.expires_at > now()
     ORDER BY r.created_at DESC LIMIT 1`,
    [email.toLowerCase()],
  );
  const row = found.rows[0];
  const expected = Buffer.from(row?.code_hash ?? codeHash("000000"));
  const actual = Buffer.from(codeHash(code));
  if (!row || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("invalid_code");
  const passwordHash = await bcrypt.hash(password, 12);
  await query("UPDATE app_user SET password_hash = $2 WHERE id = $1", [row.id, passwordHash]);
  await query("DELETE FROM password_reset WHERE user_id = $1", [row.id]);
  await query("UPDATE auth_session SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [row.id]);
  logger.info("auth.password_reset_confirmed", { userId: row.id });
}

export async function logout(refreshToken: string) {
  await query("UPDATE auth_session SET revoked_at = now() WHERE refresh_hash = $1 AND revoked_at IS NULL", [hashToken(refreshToken)]);
  logger.info("auth.logout");
}

export async function authenticate(token: string) {
  const verified = await jwtVerify(token, secret);
  if (!verified.payload.sub) throw new Error("invalid_token");
  return { id: verified.payload.sub, role: String(verified.payload.role) };
}
