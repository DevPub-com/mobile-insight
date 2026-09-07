"use client";

import * as Select from "@radix-ui/react-select";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { KoboyoIcon } from "@/components/ui/koboyo-icon";
import type { AppInfo } from "@/domain/types";

export function appIconEndpoint(app: AppInfo) {
  return app.iosAppId && /^\d+$/.test(app.iosAppId)
    ? `/api/apps/icon?iosAppId=${encodeURIComponent(app.iosAppId)}`
    : null;
}

function AppIcon({ app }: { app: AppInfo }) {
  const source = appIconEndpoint(app);

  return (
    <span className="app-selector__icon" aria-hidden="true">
      <span className="app-selector__icon-fallback">{app.name.slice(0, 1)}</span>
      {source && (
        <Image
          className="app-selector__icon-image"
          src={source}
          alt=""
          width={28}
          height={28}
          unoptimized
          onError={(event) => event.currentTarget.remove()}
        />
      )}
    </span>
  );
}

export function AppSelector({ apps, current }: { apps: AppInfo[]; current: string }) {
  const router = useRouter();
  const currentApp = apps.find((app) => app.code === current);

  return (
    <Select.Root value={current} onValueChange={(code) => router.push(`/dashboard/${code}`)}>
      <Select.Trigger className="app-selector" aria-label="분석할 앱 선택">
        {currentApp && <AppIcon app={currentApp} />}
        <span className="app-selector__value">
          <Select.Value>{currentApp?.name ?? "앱 선택"}</Select.Value>
        </span>
        <Select.Icon className="app-selector__chevron">
          <KoboyoIcon name="chevron-down" size={15} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="select-content" position="popper" sideOffset={8}>
          <Select.Viewport>
            {apps.map((app) => (
              <Select.Item className="select-item" value={app.code} key={app.id}>
                <Select.ItemText>
                  <span className="select-item__app">
                    <AppIcon app={app} />
                    <span>{app.name}</span>
                  </span>
                </Select.ItemText>
                <Select.ItemIndicator><KoboyoIcon name="star" size={14} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
