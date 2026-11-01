import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCode, getLogin, getSharedRepos, installUrl } from "@/lib/githubApp";
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
        const login = await getLogin(token);
        // First time here: go straight to picking repos. GitHub sends them back through the Setup URL.
        const { installed } = await getSharedRepos(token, login).catch(() => ({ installed: true }));
        res = NextResponse.redirect(installed ? `${SITE_URL}/me?lang=${lang}` : installUrl());
        res.cookies.set(SESSION_COOKIE, seal({ token, login }), cookieOptions(SESSION_SECONDS));
      }
    } catch {
      res = NextResponse.redirect(`${SITE_URL}/?lang=${lang}&auth=failed`);
    }
  }
  res.cookies.set(OAUTH_COOKIE, "", cookieOptions(0));
  return res;
}
