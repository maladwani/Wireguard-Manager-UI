// Copyright (c) 2026 Mohammed Aladwani
// Licensed under the MIT License

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicPaths = ["/login", "/api/auth", "/login/local", "/login/sso-complete"];

const roleProtectedPaths: Record<string, string[]> = {
  "/users": ["super_admin"],
  "/settings": ["super_admin"],
  "/api/users": ["super_admin"],
};

const writeProtectedApiPaths: Record<string, string[]> = {
  "/api/clients": ["super_admin", "admin"],
};

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    // Only allow same-origin relative paths as callbackUrl to prevent open redirect
    const rawCallback = req.nextUrl.searchParams.get("callbackUrl");
    const safeCallback =
      rawCallback && /^\/[^/\\]/.test(rawCallback) ? rawCallback : pathname;
    loginUrl.searchParams.set("callbackUrl", safeCallback);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = req.auth.user?.role;

  for (const [path, roles] of Object.entries(roleProtectedPaths)) {
    if (pathname.startsWith(path) && !roles.includes(userRole as string)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (req.method !== "GET") {
    for (const [path, roles] of Object.entries(writeProtectedApiPaths)) {
      if (pathname.startsWith(path) && !roles.includes(userRole as string)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.ico$|.*\\.woff2?$).*)",
  ],
};
