import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { SITE_URL } from "./site";

export const SESSION_COOKIE = "toc_session";
export const OAUTH_COOKIE = "toc_oauth";
// Shorter than the token's own 8 hours: nothing outlives a sitting.
export const SESSION_SECONDS = 3600;

export type Session = { token: string; login: string };

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: SITE_URL.startsWith("https://"),
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHash("sha256").update(secret).digest();
}

/** The token lives only in this encrypted cookie: there's no server-side store. */
export function seal(session: Session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal(value: string | undefined): Session | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const body = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    const session = JSON.parse(body.toString("utf8"));
    return typeof session.token === "string" && typeof session.login === "string" ? session : null;
  } catch {
    return null;
  }
}
