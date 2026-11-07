import { LineProfile, supabase } from "./supabase";

export const ANALYTICS_BUCKET = "checkin-photos";

type AnalyticsPayload = {
  line_user_id: string;
  display_name: string | null;
  entry_mode: string | null;
  created_at: string;
};

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "anonymous";
}

function eventPath(kind: "ad" | "usage", profile: LineProfile) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const random = Math.random().toString(36).slice(2, 8);
  return `analytics/${kind}/${safeId(profile.userId)}/${timestamp}-${random}.json`;
}

async function uploadAnalyticsFallback(kind: "ad" | "usage", profile: LineProfile, payload: Record<string, unknown>) {
  const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
  await supabase.storage.from(ANALYTICS_BUCKET).upload(eventPath(kind, profile), body, {
    cacheControl: "60",
    upsert: false,
  });
}

export async function trackUsageEvent(profile: LineProfile, entryMode?: string | null) {
  const payload: AnalyticsPayload = {
    line_user_id: profile.userId,
    display_name: profile.displayName,
    entry_mode: entryMode ?? null,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("app_usage_events").insert(payload);
  if (!error) return;
  await uploadAnalyticsFallback("usage", profile, payload);
}

export async function trackAdEvent(profile: LineProfile, adKey: string, eventType: "view" | "click", entryMode?: string | null) {
  const payload = {
    ad_key: adKey,
    event_type: eventType,
    line_user_id: profile.userId,
    display_name: profile.displayName,
    entry_mode: entryMode ?? null,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("ad_events").insert(payload);
  if (!error) return;
  await uploadAnalyticsFallback("ad", profile, payload);
}

