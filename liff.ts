import liff from "@line/liff";
import type { LineProfile } from "./supabase";

export async function initLiff(): Promise<LineProfile | null> {
  const liffId = import.meta.env.VITE_LINE_LIFF_ID;

  if (!liffId) {
    return {
      userId: "dev-user",
      displayName: "開發測試使用者",
    };
  }

  await liff.init({ liffId });

  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }

  const profile = await liff.getProfile();
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl,
  };
}

export function isInClient() {
  return liff.isInClient();
}
