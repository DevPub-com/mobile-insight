"use client";
import { AppSelector } from "@/components/dashboard/layout/app-selector";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";

import { KoboyoIcon } from "@/components/ui/koboyo-icon";
import type { ReactNode } from "react";
import type { View } from "./dashboard-navigation";
import type { DashboardModel } from "../hooks/use-dashboard-model";

const nav: Array<[View, string, ReactNode]> = [
  [
    "dashboard",
    "대시보드",
    <KoboyoIcon name="dashboard" size={17} key="dashboard" />,
  ],
  [
    "impact",
    "배포 후 변화",
    <KoboyoIcon name="bar-chart" size={17} key="impact" />,
  ],
  ["reviews", "평점 & 리뷰", <KoboyoIcon name="star" size={17} key="review" />],
  ["releases", "릴리스", <KoboyoIcon name="rocket" size={17} key="release" />],
  [
    "downloads",
    "다운로드",
    <KoboyoIcon name="download" size={17} key="download" />,
  ],
];

type Props = Pick<
  DashboardModel,
  "data" | "view" | "setView" | "setReviewPage"
>;

export function DashboardSidebar({
  data,
  view,
  setView,
  setReviewPage,
}: Props) {
  return (
    <DpLayout as="aside" className="mi-sidebar">
      <DpLayout direction="row" align="center" className="mi-brand">
        <DpLayout direction="row" align="end" className="mi-logo">
          <i />
          <i />
          <i />
        </DpLayout>
        <DpText as="strong">Mobile Insight</DpText>
      </DpLayout>
      <DpLayout className="mi-sidebar-app">
        <AppSelector apps={data.apps} current={data.app.code} />
      </DpLayout>
      <DpLayout as="nav" aria-label="Mobile Insight 메뉴">
        <DpText as="span" className="mi-nav-label">
          성과
        </DpText>
        {nav.map(([key, label, icon]) => (
          <DpButton
            key={key}
            className={view === key ? "is-active" : ""}
            onClick={() => {
              setView(key);
              setReviewPage(1);
            }}
          >
            {icon}
            {label}
          </DpButton>
        ))}
      </DpLayout>
    </DpLayout>
  );
}
