"use client";
import { DpBadge } from "@/components/ui/dp/DpBadge";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import type { Platform } from "@/domain/types";
import { syncDate } from "../../utils/dashboard-formatters";
import { PlatformIcon } from "../../shared/platform-icon";

import type { DashboardModel } from "../../hooks/use-dashboard-model";

type Props = Pick<
  DashboardModel,
  | "data"
  | "connectedPlatforms"
  | "latestOverallSync"
  | "connectionRatio"
  | "healthyPlatforms"
  | "latestSync"
>;

export function AppManagementView({
  data,
  connectedPlatforms,
  latestOverallSync,
  connectionRatio,
  healthyPlatforms,
  latestSync,
}: Props) {
  const appRows = data.apps.map((app) => {
    const isSelectedApp = app.id === data.app.id;
    const platforms = (["android", "ios"] as Platform[]).filter((platform) =>
      platform === "android"
        ? app.androidPackageName
        : app.iosBundleId || app.iosAppId,
    );
    const latestAppSync = isSelectedApp
      ? (platforms
          .map((platform) => latestSync(platform)?.finishedAt ?? null)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null)
      : null;
    const appStatus = !isSelectedApp
      ? "상태 미수집"
      : platforms.length > 0 &&
          platforms.every(
            (platform) => latestSync(platform)?.status === "success",
          )
        ? "정상"
        : data.syncRuns.length
          ? "확인 필요"
          : "동기화 전";
    return (
      <DpLayout as="article" key={app.id}>
        <DpText as="strong">{app.name}</DpText>
        <DpText as="span" className="mi-app-platforms">
          {platforms.map((platform) => (
            <PlatformIcon key={platform} platform={platform} size={15} />
          ))}
          {platforms
            .map((platform) => (platform === "android" ? "Android" : "iOS"))
            .join(" · ")}
        </DpText>
        <DpText as="code">
          {app.androidPackageName ??
            app.iosBundleId ??
            app.iosAppId ??
            "미설정"}
        </DpText>
        <DpText as="time">{syncDate(latestAppSync)}</DpText>
        <DpBadge>{appStatus}</DpBadge>
      </DpLayout>
    );
  });

  return (
    <>
      <DpLayout as="section" className="mi-app-summary-grid">
        {[
          ["등록 앱 수", `${data.apps.length}`, "전체 활성 앱"],
          [
            "연결된 스토어",
            `${connectedPlatforms.length}`,
            connectedPlatforms
              .map((item) => (item === "android" ? "Google Play" : "App Store"))
              .join(", ") || "연결 없음",
          ],
          [
            "최근 동기화 상태",
            syncDate(latestOverallSync?.finishedAt ?? null),
            latestOverallSync
              ? `선택 앱 ${latestOverallSync.status}`
              : "동기화 기록 없음",
          ],
          [
            "정상 연동 비율",
            connectionRatio === null ? "—" : `${connectionRatio.toFixed(0)}%`,
            `${healthyPlatforms.length} / ${connectedPlatforms.length} 스토어 정상 연동`,
          ],
        ].map(([label, value, detail]) => (
          <DpCard as="article" key={label}>
            <DpText as="span">{label}</DpText>
            <DpText as="strong">{value}</DpText>
            {detail && <DpText as="small">{detail}</DpText>}
          </DpCard>
        ))}
      </DpLayout>
      <DpCard className="mi-panel mi-app-panel">
        <DpLayout
          direction="row"
          align="center"
          justify="between"
          className="mi-panel-head"
        >
          <DpLayout>
            <DpText as="h3">
              앱 목록{" "}
              <DpText as="small" wrap="inherit">
                {data.apps.length}
              </DpText>
            </DpText>
            <DpText>등록 앱과 스토어 데이터 연결 상태입니다.</DpText>
          </DpLayout>
          <DpButton className="mi-add-app">앱 추가 +</DpButton>
        </DpLayout>
        <DpLayout className="mi-app-table">
          <DpLayout className="mi-app-table-head">
            <DpText as="span">앱 이름</DpText>
            <DpText as="span">플랫폼</DpText>
            <DpText as="span">식별자</DpText>
            <DpText as="span">최근 동기화</DpText>
            <DpText as="span">상태</DpText>
          </DpLayout>
          {appRows}
        </DpLayout>
      </DpCard>
      <DpCard className="mi-panel mi-connections">
        <DpLayout className="mi-panel-head">
          <DpText as="h3">스토어 연결 관리</DpText>
          <DpText>
            스토어 계정을 연결하여 앱 데이터를 자동으로 동기화하세요.
          </DpText>
        </DpLayout>
        {[
          ["Google Play Console", data.app.androidPackageName, "android"],
          [
            "App Store Connect",
            data.app.iosBundleId ?? data.app.iosAppId,
            "ios",
          ],
        ].map(([service, identifier, platform]) => (
          <DpLayout as="article" direction="row" align="center" key={service}>
            <DpText as="strong">{service}</DpText>
            <DpText as="span">{identifier ?? "식별자 미설정"}</DpText>
            <DpBadge>
              {identifier
                ? (latestSync(platform as Platform)?.status ?? "동기화 전")
                : "미연동"}
            </DpBadge>
            <DpButton>관리</DpButton>
          </DpLayout>
        ))}
      </DpCard>
    </>
  );
}
