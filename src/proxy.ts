import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getDashboardBasicCredentials,
  isProduction,
  isTrustReverseProxy,
} from "@/lib/env";

export function proxy(request: NextRequest) {
  const { username, password } = getDashboardBasicCredentials();
  const trustsReverseProxy = isTrustReverseProxy();
  const hasPartialCredentials = Boolean(username) !== Boolean(password);

  if (trustsReverseProxy || (!username && !password)) {
    return NextResponse.next();
  }
  if (hasPartialCredentials) {
    return new NextResponse("Dashboard authentication credentials are incomplete", {
      status: 503,
    });
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const supplied = atob(authorization.slice(6));
      if (supplied === `${username}:${password}`) {
        return NextResponse.next();
      }
    } catch {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Mobile Insight", charset="UTF-8"',
        },
      });
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Mobile Insight", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/apps", "/api/dashboard/:path*"],
};
