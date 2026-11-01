import { NextResponse, type NextRequest } from "next/server";

// Layouts can't read the query string, so hand them the chosen language as a header.
export function proxy(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang");
  if (lang !== "es" && lang !== "en") return NextResponse.next();
  const headers = new Headers(req.headers);
  headers.set("x-lang", lang);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/", "/me", "/u/:path*"] };
