import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCode, getLogin } from "@/lib/githubApp";
import { parseLang } from "@/lib/i18n";
import { cookieOptions, OAUTH_COOKIE, seal, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/session";
import { SITE_URL } from "@/lib/site";

function readPending(raw: string | undefined) {
  try {
    const p = JSON.parse(raw ?? "");
    return typeof p.state === "string" && typeof p.verifier === "string" ? p : null;
  } catch {
    return null;
  }
}

function sameState(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const pending = readPending((await cookies()).get(OAUTH_COOKIE)?.value);
  const lang = parseLang(pending?.lang);
  const code = params.get("code"), state = params.get("state");

  let res = NextResponse.redirect(`${SITE_URL}/?lang=${lang}&auth=failed`);
  if (pending && code && state && sameState(state, pending.state)) {
    try {
      const token = await exchangeCode(code, pending.verifier);
      if (token) {
        res = NextResponse.redirect(`${SITE_URL}/me?lang=${lang}`);
        res.cookies.set(SESSION_COOKIE, seal({ token, login: await getLogin(token) }), cookieOptions(SESSION_SECONDS));
      }
    } catch {
      res = NextResponse.redirect(`${SITE_URL}/?lang=${lang}&auth=failed`);
    }
  }
  res.cookies.set(OAUTH_COOKIE, "", cookieOptions(0));
  return res;
}
