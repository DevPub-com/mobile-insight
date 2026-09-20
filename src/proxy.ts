import { NextResponse } from "next/server";

// Public access is intentional until account registration and authentication are added.
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/apps", "/api/dashboard/:path*", "/api/ai/:path*"],
};
