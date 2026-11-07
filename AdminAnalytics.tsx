import { BarChart3, MousePointerClick, RefreshCw, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ANALYTICS_BUCKET } from "../lib/analytics";
import { AdEvent, AppUsageEvent, supabase } from "../lib/supabase";

type Props = {
  isAdmin: boolean;
};

async function readStorageJson<T>(path: string): Promise<T | null> {
  const { data, error } = await supabase.storage.from(ANALYTICS_BUCKET).download(path);
  if (error || !data) return null;

  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return null;
  }
}

async function loadStorageEvents<T>(kind: "ad" | "usage") {
  const root = `analytics/${kind}`;
  const { data: userDirs, error } = await supabase.storage.from(ANALYTICS_BUCKET).list(root, { limit: 1000 });
  if (error) throw error;

  const filePaths: string[] = [];
  for (const dir of userDirs ?? []) {
    if (!dir.name) continue;
    const { data: files } = await supabase.storage.from(ANALYTICS_BUCKET).list(`${root}/${dir.name}`, { limit: 1000 });
    (files ?? []).forEach((file) => {
      if (file.name.endsWith(".json")) filePaths.push(`${root}/${dir.name}/${file.name}`);
    });
  }

  const rows = await Promise.all(filePaths.slice(-1000).map((path) => readStorageJson<T>(path)));
  return rows.filter((row): row is NonNullable<typeof row> => Boolean(row)) as T[];
}

export function AdminAnalytics({ isAdmin }: Props) {
  const [adEvents, setAdEvents] = useState<AdEvent[]>([]);
  const [usageEvents, setUsageEvents] = useState<AppUsageEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const stats = useMemo(() => {
    const adViews = adEvents.filter((event) => event.event_type === "view").length;
    const adClicks = adEvents.filter((event) => event.event_type === "click").length;
    const uniqueUsers = new Set(usageEvents.map((event) => event.line_user_id)).size;
    const totalSessions = usageEvents.length;
    const clickRate = adViews > 0 ? Math.round((adClicks / adViews) * 100) : 0;

    return { adViews, adClicks, uniqueUsers, totalSessions, clickRate };
  }, [adEvents, usageEvents]);

  async function loadAnalytics() {
    if (!isAdmin) return;
    setLoading(true);
    setMessage("");

    const [{ data: nextAdEvents, error: adError }, { data: nextUsageEvents, error: usageError }] = await Promise.all([
      supabase.from("ad_events").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("app_usage_events").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);

    if (adError || usageError) {
      try {
        const [storageAdEvents, storageUsageEvents] = await Promise.all([
          loadStorageEvents<AdEvent>("ad"),
          loadStorageEvents<AppUsageEvent>("usage"),
        ]);
        setAdEvents(storageAdEvents.sort((a, b) => b.created_at.localeCompare(a.created_at)));
        setUsageEvents(storageUsageEvents.sort((a, b) => b.created_at.localeCompare(a.created_at)));
        setMessage("目前使用 Storage 統計備援；資料庫統計表建立後會自動改用資料表。");
      } catch (storageError) {
        setMessage(storageError instanceof Error ? storageError.message : "統計資料載入失敗。");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(false);
    setAdEvents((nextAdEvents ?? []) as AdEvent[]);
    setUsageEvents((nextUsageEvents ?? []) as AppUsageEvent[]);
  }

  useEffect(() => {
    void loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <section className="panel analytics-panel">
      <div className="preview-header">
        <div>
          <span>後台統計</span>
          <strong>廣告點擊與目前使用人數</strong>
        </div>
        <button className="tiny-button" type="button" onClick={loadAnalytics}>
          {loading ? <RefreshCw className="spin" size={14} /> : <RefreshCw size={14} />}
          更新
        </button>
      </div>
      <div className="stats-grid analytics-grid">
        <div className="stat">
          <span>目前使用人數</span>
          <strong>{stats.uniqueUsers}</strong>
        </div>
        <div className="stat">
          <span>使用次數</span>
          <strong>{stats.totalSessions}</strong>
        </div>
        <div className="stat">
          <span>廣告曝光</span>
          <strong>{stats.adViews}</strong>
        </div>
        <div className="stat">
          <span>廣告點擊</span>
          <strong>{stats.adClicks}</strong>
        </div>
      </div>
      <div className="analytics-note">
        <BarChart3 size={18} />
        <span>點擊率 {stats.clickRate}%</span>
        <MousePointerClick size={18} />
        <span>最近一筆點擊：{adEvents.find((event) => event.event_type === "click")?.display_name ?? "尚無"}</span>
        <UsersRound size={18} />
        <span>依 LINE userId 去重計算使用人數。</span>
      </div>
      {message && <p className="message">{message}</p>}
    </section>
  );
}
