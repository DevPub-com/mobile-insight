import { redirect } from "next/navigation";

import { getDefaultAppCode } from "@/lib/env";

export default function Home() {
  redirect(`/dashboard/${getDefaultAppCode()}`);
}
