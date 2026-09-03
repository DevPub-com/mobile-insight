"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

import type { AppInfo } from "@/domain/types";

export function AppSelector({ apps, current }: { apps: AppInfo[]; current: string }) {
  const router = useRouter();
  const currentApp = apps.find((app) => app.code === current);

  return (
    <Select.Root value={current} onValueChange={(code) => router.push(`/dashboard/${code}`)}>
      <Select.Trigger className="app-selector" aria-label="분석할 앱 선택">
        <span className="app-selector__label">APP</span>
        <Select.Value>{currentApp?.name ?? "앱 선택"}</Select.Value>
        <Select.Icon><ChevronDown size={15} /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="select-content" position="popper" sideOffset={8}>
          <Select.Viewport>
            {apps.map((app) => (
              <Select.Item className="select-item" value={app.code} key={app.id}>
                <Select.ItemText>{app.name}</Select.ItemText>
                <Select.ItemIndicator><Check size={14} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
