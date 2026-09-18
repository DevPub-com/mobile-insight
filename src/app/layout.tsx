import type { Metadata } from "next";

import "@daypicker/react/style.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mobile-insight-five.vercel.app"),
  title: "Mobile Insight | 모바일 앱 통합 대시보드",
  description: "Android·iOS의 활성 사용자, 평점·리뷰, 크래시 및 배포 전후 변화를 한곳에서 확인하세요.",
  openGraph: {
    images: [{url:"/share-preview.png",width:1200,height:630,alt:"Mobile Insight 앱 성과 통합 대시보드"}],
    type: "website",
    locale: "ko_KR",
    siteName: "Mobile Insight",
    title: "Mobile Insight | 모바일 앱 통합 대시보드",
    description: "Android·iOS의 활성 사용자, 평점·리뷰, 크래시 및 배포 전후 변화를 한곳에서 확인하세요.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mobile Insight | 모바일 앱 통합 대시보드",
    description: "Android·iOS 앱 지표와 사용자 반응, 배포 영향을 한눈에 확인하세요.",
    images: [{ url: "/share-preview.png", alt: "Mobile Insight 앱 성과 통합 대시보드" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
