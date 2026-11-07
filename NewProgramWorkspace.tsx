import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Globe2,
  GraduationCap,
  Handshake,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import "./NewProgramWorkspace.css";

type Props = {
  onProgramSetup: () => void;
  onApplicantReview: () => void;
  onAidReview: () => void;
  onInterviewSchedule: () => void;
  onAgencyReferral: () => void;
  onAdmissionFollowup: () => void;
  onAttendance: () => void;
};

export function NewProgramWorkspace({
  onProgramSetup,
  onApplicantReview,
  onAidReview,
  onInterviewSchedule,
  onAgencyReferral,
  onAdmissionFollowup,
  onAttendance,
}: Props) {
  const [guideStep, setGuideStep] = useState(() => {
    const saved = Number(window.localStorage.getItem("new-program-guide-step") ?? "0");
    return Number.isFinite(saved) ? Math.min(Math.max(saved, 0), 6) : 0;
  });

  const stages = useMemo(
    () => [
      { icon: Building2, title: "建立專班", action: "設定專班、名額與報名條件", run: onProgramSetup },
      { icon: UsersRound, title: "審核申請", action: "查看申請者與 A2 語言資格", run: onApplicantReview },
      { icon: ShieldCheck, title: "核對補助", action: "確認學費、TOCFL B1 與成績條件", run: onAidReview },
      { icon: CalendarDays, title: "安排面試", action: "建立面試時段與當日報到", run: onInterviewSchedule },
      { icon: Handshake, title: "代辦與廠商", action: "追蹤代辦推薦與企業媒合", run: onAgencyReferral },
      { icon: ClipboardCheck, title: "錄取與報到", action: "持續追蹤錄取、來臺與報到", run: onAdmissionFollowup },
      { icon: GraduationCap, title: "教學與點名", action: "進入既有班級、課程與點名系統", run: onAttendance },
    ],
    [onAdmissionFollowup, onAgencyReferral, onAidReview, onApplicantReview, onInterviewSchedule, onProgramSetup],
  );

  const currentStage = stages[Math.min(guideStep, stages.length - 1)];
  const handleStage = (index: number) => {
    const nextStep = Math.max(guideStep, Math.min(index + 1, stages.length));
    window.localStorage.setItem("new-program-guide-step", String(nextStep));
    setGuideStep(nextStep);
    stages[index].run();
  };

  return (
    <main className="screen new-program-screen">
      <section className="new-program-header">
        <div>
          <p className="eyebrow">115 學年度新型專班</p>
          <h1>智慧節能水電專班</h1>
        </div>
        <GraduationCap aria-hidden="true" />
      </section>

      <section className="program-metric-grid" aria-label="專班條件">
        <div><strong>2027 年 2 月</strong><span>預計入學</span></div>
        <div><strong>2 年制學士班</strong><span>STEM 專班</span></div>
        <div><strong>A2</strong><span>入學中文門檻</span></div>
        <div><strong>TOCFL B1</strong><span>補助續領條件</span></div>
        <div><strong>天成輸配電工程</strong><span>合作企業</span></div>
      </section>

      {guideStep >= stages.length && (
        <button className="replay-guide" type="button" onClick={() => { window.localStorage.setItem("new-program-guide-step", "0"); setGuideStep(0); }}>
          <CheckCircle2 size={17} /> 重看首次操作導引
        </button>
      )}

      <section className="program-stage-grid" aria-label="新型專班工作流程">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const isCurrent = guideStep < stages.length && index === guideStep;
          const isDone = index < guideStep;
          return (
            <button
              key={stage.title}
              className={`program-stage ${isCurrent ? "is-current" : ""} ${isDone ? "is-done" : ""}`}
              type="button"
              onClick={() => handleStage(index)}
            >
              <span className="stage-number">{isDone ? <CheckCircle2 size={19} /> : index + 1}</span>
              <Icon aria-hidden="true" />
              <strong>{stage.title}</strong>
              <span>{stage.action}</span>
              {isCurrent && <em>導引第 {guideStep + 1} 步：{currentStage.action}</em>}
            </button>
          );
        })}
      </section>

      <section className="program-rule-grid" aria-label="DM 核心條件">
        <div><strong>每學期學雜費</strong><span>NT$61,700；最高補助 NT$50,000</span></div>
        <div><strong>住宿</strong><span>每學期 NT$14,500，含 Wi‑Fi</span></div>
        <div><strong>企業生活津貼</strong><span>每月最低 NT$10,000，最長 2 年</span></div>
        <div><strong>實習薪資</strong><span>每月基本薪資至少 NT$29,500</span></div>
      </section>
    </main>
  );
}
