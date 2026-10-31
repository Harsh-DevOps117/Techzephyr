import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
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

export async function logout(refreshToken: string) {
  await query("UPDATE auth_session SET revoked_at = now() WHERE refresh_hash = $1 AND revoked_at IS NULL", [hashToken(refreshToken)]);
  logger.info("auth.logout");
}

export async function authenticate(token: string) {
  const verified = await jwtVerify(token, secret);
  if (!verified.payload.sub) throw new Error("invalid_token");
  return { id: verified.payload.sub, role: String(verified.payload.role) };
}
