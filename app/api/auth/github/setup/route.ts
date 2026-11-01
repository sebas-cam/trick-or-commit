import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";

// Where GitHub lands after someone installs the app or changes its repos. installation_id
// can be forged, so it's ignored: /me re-reads what the session's own token can reach.
export function GET() {
  return NextResponse.redirect(`${SITE_URL}/me`);
}
