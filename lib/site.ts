const raw = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").trim().replace(/\/+$/, "");

// Tolerates a bare domain: a missing scheme here would otherwise take down every page.
export const SITE_URL = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
