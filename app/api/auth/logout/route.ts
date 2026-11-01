import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revokeToken } from "@/lib/githubApp";
import { parseLang } from "@/lib/i18n";
import { cookieOptions, SESSION_COOKIE, unseal } from "@/lib/session";
import { SITE_URL } from "@/lib/site";

// POST only, and the session cookie is SameSite=Lax, so other sites can't sign someone out.
export async function POST(req: Request) {
  const session = unseal((await cookies()).get(SESSION_COOKIE)?.value);
  if (session && session.token !== "mock") await revokeToken(session.token);
  const lang = parseLang(new URL(req.url).searchParams.get("lang"));
  const res = NextResponse.redirect(`${SITE_URL}/?lang=${lang}`, 303);
  res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return res;
}
