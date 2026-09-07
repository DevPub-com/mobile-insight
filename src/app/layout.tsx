import type { Metadata } from "next";

import "@daypicker/react/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mobile Insight",
  description: "Mobile App Performance Dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
