import { ExternalLink, Megaphone } from "lucide-react";
import { useEffect, useRef } from "react";
import { trackAdEvent } from "../lib/analytics";
import { LineProfile } from "../lib/supabase";

const featuredAd = {
  key: "stust-electronics-can-lin-obd-part-time-2026",
  label: "合作廣告",
  source: "南臺電子 唐經洲",
  title: "CAN/LIN/OBD 工讀機會",
  cta: "查看工讀機會",
  url: "https://liff.line.me/2010268216-hfwvPatu",
  contact: "聯絡人：張先生 0919-781104",
  jobs: [
    {
      company: "協穎企業社",
      location: "正南三路",
      role: "工廠作業員",
      time: "17:00-23:00 任選",
    },
    {
      company: "博雄機械企業有限公司",
      location: "洲工街",
      role: "工廠作業員",
      time: "17:00-23:00 任選",
    },
    {
      company: "勝前五金",
      location: "中正南路242巷（南台舊大門口附近）",
      role: "作業員",
      time: "8:00-12:00，13:00-17:00 任選",
    },
  ],
};

type Props = {
  profile: LineProfile;
  entryMode?: string | null;
};

export function AdBanner({ profile, entryMode }: Props) {
  const trackedViewRef = useRef(false);

  useEffect(() => {
    if (trackedViewRef.current) return;
    trackedViewRef.current = true;
    void trackAdEvent(profile, featuredAd.key, "view", entryMode).catch(() => undefined);
  }, [entryMode, profile]);

  async function handleClick() {
    await trackAdEvent(profile, featuredAd.key, "click", entryMode).catch(() => undefined);
  }

  return (
    <section className="panel ad-panel bottom-ad">
      <a className="ad-link" href={featuredAd.url} target="_blank" rel="noreferrer" onClick={handleClick}>
        <div className="ad-header">
          <div>
            <p className="eyebrow">{featuredAd.label}</p>
            <h2>{featuredAd.title}</h2>
            <span>{featuredAd.source}</span>
          </div>
          <Megaphone aria-hidden="true" />
        </div>
        <div className="ad-list">
          {featuredAd.jobs.map((job, index) => (
            <article className="ad-item" key={job.company}>
              <strong>
                {index + 1}. [{job.company}]：{job.location} / {job.role}
              </strong>
              <span>工作時間：{job.time}</span>
            </article>
          ))}
        </div>
        <p className="ad-contact">{featuredAd.contact}</p>
        <span className="primary-button ad-cta">
          {featuredAd.cta}
          <ExternalLink size={18} />
        </span>
      </a>
    </section>
  );
}
