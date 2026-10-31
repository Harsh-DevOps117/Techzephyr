import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { query } from "../../infrastructure/database/postgres.js";
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "replace-this-development-secret-before-production");
export async function login(email:string,password:string){const r=await query<{id:string;role:string;password_hash:string}>("SELECT id,role,password_hash FROM app_user WHERE email=$1",[email]);if(!r.rowCount||!r.rows[0].password_hash||!await bcrypt.compare(password,r.rows[0].password_hash))throw new Error("invalid_credentials");const u=r.rows[0];const access=await new SignJWT({role:u.role}).setProtectedHeader({alg:"HS256"}).setSubject(u.id).setIssuedAt().setExpirationTime("15m").sign(secret);const refresh=uuidv7()+uuidv7();await query("INSERT INTO auth_session (id,user_id,refresh_hash,expires_at) VALUES ($1,$2,$3,now()+interval '7 days')",[uuidv7(),u.id,createHash("sha256").update(refresh).digest("hex")]);return {accessToken:access,refreshToken:refresh,expiresIn:900,role:u.role};}
export async function authenticate(token:string){const v=await jwtVerify(token,secret);return {id:v.payload.sub!,role:String(v.payload.role)};}
