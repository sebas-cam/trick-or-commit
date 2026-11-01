import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { callbackUrl, privateReposEnabled } from "@/lib/githubApp";
import { parseLang } from "@/lib/i18n";
import { cookieOptions, OAUTH_COOKIE, seal, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/session";
import { SITE_URL } from "@/lib/site";

export async function GET(req: Request) {
  const lang = parseLang(new URL(req.url).searchParams.get("lang"));
  if (!privateReposEnabled()) return NextResponse.redirect(`${SITE_URL}/?lang=${lang}`);

  if (process.env.MOCK === "1") {
    const res = NextResponse.redirect(`${SITE_URL}/me?lang=${lang}`);
    res.cookies.set(SESSION_COOKIE, seal({ token: "mock", login: "mock-user" }), cookieOptions(SESSION_SECONDS));
    return res;
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_APP_CLIENT_ID!);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, lang }), cookieOptions(600));
  return res;
}
