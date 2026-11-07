import {
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Languages,
  Loader2,
  QrCode,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { generateStudentAiText, isExternalAiConfigured } from "../lib/ai";
import { InterviewRecord, LineProfile, supabase } from "../lib/supabase";

type Props = {
  profile: LineProfile;
  initialSection?: string;
};

type PrepForm = {
  studentName: string;
  country: string;
  targetDepartment: string;
  motivation: string;
  chineseLevel: string;
  nativeLanguage: string;
  contactPlatform: string;
  contactAccount: string;
  passportLast4: string;
  interviewDate: string;
  taiwanArrivalDate: string;
};

const defaultForm: PrepForm = {
  studentName: "",
  country: "",
  targetDepartment: "",
  motivation: "",
  chineseLevel: "初級",
  nativeLanguage: "English",
  contactPlatform: "LINE",
  contactAccount: "",
  passportLast4: "",
  interviewDate: "",
  taiwanArrivalDate: "",
};

const chineseLevelOptions = ["零基礎", "初級", "中級", "可用中文面試"];
const nativeLanguageOptions = ["English", "Tiếng Việt", "Bahasa Indonesia", "Thai", "Japanese", "Korean", "Spanish"];
const contactPlatformOptions = ["LINE", "Email", "WhatsApp", "Zalo", "Messenger", "WeChat", "Telegram"];

function cleanText(value: string, fallback: string) {
  return value.trim() || fallback;
}

function normalizeName(name: string) {
  return cleanText(name, "同學");
}

function buildCheckinCode(studentName: string, passportLast4: string) {
  const nameKey = normalizeName(studentName)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
  const suffix = passportLast4.trim().toUpperCase() || Date.now().toString(36).slice(-4).toUpperCase();
  return `FUT-${nameKey || "STUDENT"}-${suffix}`;
}

function buildChineseIntro(form: PrepForm) {
  const name = normalizeName(form.studentName);
  const country = cleanText(form.country, "我的國家");
  const department = cleanText(form.targetDepartment, "我想申請的科系");
  const motivation = cleanText(
    form.motivation,
    "我希望到臺灣學習專業知識，也希望提升中文能力，認識不同文化。",
  );

  return [
    `各位老師好，我叫 ${name}，我來自 ${country}。`,
    `我想申請 ${department}，因為 ${motivation}`,
    `我目前的中文程度是 ${form.chineseLevel}。我會持續練習聽、說、讀、寫，希望未來能更順利地在臺灣學習與生活。`,
    "謝謝老師給我這次面試的機會。",
  ].join("\n");
}

function buildBilingualDraft(form: PrepForm, intro: string) {
  const name = normalizeName(form.studentName);
  const country = cleanText(form.country, "my country");
  const department = cleanText(form.targetDepartment, "the program");
  const motivation = cleanText(
    form.motivation,
    "I hope to study professional knowledge in Taiwan and improve my Chinese ability.",
  );

  return [
    "中文稿",
    intro,
    "",
    `${form.nativeLanguage} / English reference`,
    `Hello professors, my name is ${name}, and I come from ${country}.`,
    `I would like to apply for ${department}. My motivation is: ${motivation}`,
    `My current Chinese level is ${form.chineseLevel}. I will keep practicing so I can study and live in Taiwan more smoothly.`,
  ].join("\n");
}

function buildPracticeQuestions(form: PrepForm) {
  const department = cleanText(form.targetDepartment, "這個科系");
  const country = cleanText(form.country, "你的國家");

  return [
    `1. 請用中文簡單介紹你自己，以及你來自 ${country} 的哪個城市。`,
    `2. 你為什麼想申請 ${department}？`,
    "3. 你為什麼想來臺灣讀書？",
    "4. 如果上課聽不懂中文，你會怎麼解決？",
    "5. 你未來畢業後想做什麼？",
  ].join("\n");
}

function buildSavedScript(form: PrepForm, intro: string, bilingual: string, questions: string) {
  return [
    "中文自我介紹",
    intro,
    "",
    "雙語稿",
    bilingual,
    "",
    "面試練習題",
    questions,
    "",
    "聯絡資訊",
    `母語：${form.nativeLanguage}`,
    `聯絡方式：${form.contactPlatform}`,
    `帳號：${form.contactAccount || "未填寫"}`,
    `護照後四碼：${form.passportLast4 || "未填寫"}`,
  ].join("\n");
}

function sectionFromInitial(initialSection?: string) {
  if (initialSection === "future-checkin") return "checkin";
  if (initialSection === "future-intro") return "intro";
  return "profile";
}

export function FutureStudentPrep({ profile, initialSection }: Props) {
  const [section, setSection] = useState(sectionFromInitial(initialSection));
  const [form, setForm] = useState<PrepForm>(() => ({
    ...defaultForm,
    studentName: profile.displayName || "",
    contactAccount: profile.userId,
  }));
  const [record, setRecord] = useState<InterviewRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [generatedIntro, setGeneratedIntro] = useState("");
  const [bilingualDraft, setBilingualDraft] = useState("");
  const [practiceQuestions, setPracticeQuestions] = useState("");
  const [checkinCode, setCheckinCode] = useState("");
  const [lookupCode, setLookupCode] = useState("");

  const activeIntro = useMemo(() => generatedIntro || buildChineseIntro(form), [form, generatedIntro]);
  const activeBilingual = useMemo(() => bilingualDraft || buildBilingualDraft(form, activeIntro), [activeIntro, bilingualDraft, form]);
  const activeQuestions = useMemo(() => practiceQuestions || buildPracticeQuestions(form), [form, practiceQuestions]);

  function updateField(field: keyof PrepForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function applyRecord(nextRecord: InterviewRecord) {
    setRecord(nextRecord);
    setCheckinCode(nextRecord.checkin_code);
    setLookupCode(nextRecord.checkin_code);
    setForm((prev) => ({
      ...prev,
      studentName: nextRecord.student_name || prev.studentName,
      country: nextRecord.country || prev.country,
      targetDepartment: nextRecord.target_department || prev.targetDepartment,
      motivation: nextRecord.motivation || prev.motivation,
      chineseLevel: nextRecord.chinese_level || prev.chineseLevel,
      interviewDate: nextRecord.interview_date || prev.interviewDate,
      taiwanArrivalDate: nextRecord.taiwan_arrival_date || prev.taiwanArrivalDate,
    }));
    if (nextRecord.intro_script) setGeneratedIntro(nextRecord.intro_script.split("雙語稿")[0]?.replace("中文自我介紹", "").trim() || "");
  }

  async function loadOwnRecord() {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase
      .from("interview_records")
      .select("*")
      .ilike("motivation", `%LINE userId: ${profile.userId}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    const nextRecord = data?.[0] as InterviewRecord | undefined;
    if (nextRecord) applyRecord(nextRecord);
  }

  async function generateIntro() {
    setSaving(true);
    const text = await generateStudentAiText({ task: "intro", locale: "zh-TW", ...form }, () => buildChineseIntro(form));
    setGeneratedIntro(text);
    setSaving(false);
    setMessage(isExternalAiConfigured ? "AI 已產生中文自我介紹。" : "已用本地規則產生中文自我介紹。");
  }

  async function generateBilingual() {
    setSaving(true);
    const text = await generateStudentAiText(
      { task: "translation", locale: form.nativeLanguage, context: activeIntro, ...form },
      () => buildBilingualDraft(form, activeIntro),
    );
    setBilingualDraft(text);
    setSaving(false);
    setMessage(isExternalAiConfigured ? "AI 已產生雙語稿。" : "已用本地規則產生雙語稿。");
  }

  async function generateQuestions() {
    setSaving(true);
    const text = await generateStudentAiText({ task: "questions", locale: "zh-TW", ...form }, () => buildPracticeQuestions(form));
    setPracticeQuestions(text);
    setSaving(false);
    setMessage(isExternalAiConfigured ? "AI 已產生面試練習題。" : "已用本地規則產生面試練習題。");
  }

  function generateCode() {
    const code = checkinCode || buildCheckinCode(form.studentName, form.passportLast4);
    setCheckinCode(code);
    setLookupCode(code);
    setMessage("已產生報到碼，儲存後即可用於報到。");
  }

  async function saveRecord(event?: FormEvent) {
    event?.preventDefault();
    setMessage("");

    if (!form.studentName.trim() || !form.country.trim() || !form.targetDepartment.trim()) {
      setMessage("請先填寫姓名、國家與申請科系。");
      return;
    }

    setSaving(true);
    const code = checkinCode || buildCheckinCode(form.studentName, form.passportLast4);
    const intro = activeIntro;
    const bilingual = activeBilingual;
    const questions = activeQuestions;
    const savedScript = buildSavedScript(form, intro, bilingual, questions);
    const motivationWithMeta = [
      form.motivation.trim(),
      "",
      `LINE userId: ${profile.userId}`,
      `LINE displayName: ${profile.displayName}`,
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      student_name: form.studentName.trim(),
      country: form.country.trim(),
      target_department: form.targetDepartment.trim(),
      motivation: motivationWithMeta,
      chinese_level: form.chineseLevel,
      interview_date: form.interviewDate || null,
      taiwan_arrival_date: form.taiwanArrivalDate || null,
      intro_script: savedScript,
      checkin_code: code,
      readiness_status: bilingualDraft ? "已完成翻譯" : "已產生自介",
      updated_at: new Date().toISOString(),
    };

    const result = record
      ? await supabase.from("interview_records").update(payload).eq("id", record.id).select("*").single()
      : await supabase.from("interview_records").insert(payload).select("*").single();

    setSaving(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    applyRecord(result.data as InterviewRecord);
    setCheckinCode(code);
    setMessage("已儲存面試資料、中文稿、雙語稿、練習題與報到碼。");
  }

  async function checkInWithCode() {
    const code = lookupCode.trim();
    if (!code) {
      setMessage("請輸入報到碼。");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("interview_records")
      .update({ readiness_status: "已報到", updated_at: new Date().toISOString() })
      .eq("checkin_code", code)
      .select("*")
      .single();

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    applyRecord(data as InterviewRecord);
    setMessage("報到完成，老師端會看到狀態已更新。");
  }

  useEffect(() => {
    void loadOwnRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.userId]);

  if (loading) {
    return (
      <main className="center-screen">
        <Loader2 className="spin" />
        <p>正在載入你的面試準備資料</p>
      </main>
    );
  }

  return (
    <main className="screen">
      <section className="panel hero-panel">
        <div>
          <img className="school-logo" src="/stust-logo-en.png" alt="Southern Taiwan University of Science and Technology Logo" />
          <p className="eyebrow">未來學生面試準備</p>
          <h1>中文自介、面試練習與報到</h1>
          <p className="subtle">{profile.displayName}，你可以先準備自介，面試當天用報到碼報到。</p>
        </div>
        <GraduationCap aria-hidden="true" />
      </section>

      <section className="mode-switch">
        <button className={section === "profile" ? "primary-button" : "ghost-button"} type="button" onClick={() => setSection("profile")}>
          <UserRound size={18} />
          基本資料
        </button>
        <button className={section === "intro" ? "primary-button" : "ghost-button"} type="button" onClick={() => setSection("intro")}>
          <Languages size={18} />
          自介與練習
        </button>
        <button className={section === "checkin" ? "primary-button" : "ghost-button"} type="button" onClick={() => setSection("checkin")}>
          <QrCode size={18} />
          報到
        </button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="interview-layout">
        <form className="panel form-panel" onSubmit={saveRecord}>
          <div className="form-section-title">
            {section === "checkin" ? <QrCode size={20} /> : section === "intro" ? <Languages size={20} /> : <UserRound size={20} />}
            <strong>{section === "checkin" ? "報到碼報到" : section === "intro" ? "中文自介與面試練習" : "填寫面試基本資料"}</strong>
          </div>

          {section !== "checkin" && (
            <>
              <div className="two-column-fields">
                <label>
                  姓名
                  <input value={form.studentName} onChange={(event) => updateField("studentName", event.target.value)} required />
                </label>
                <label>
                  國家
                  <input value={form.country} onChange={(event) => updateField("country", event.target.value)} required />
                </label>
              </div>

              <label>
                申請科系
                <input value={form.targetDepartment} onChange={(event) => updateField("targetDepartment", event.target.value)} required />
              </label>

              <label>
                申請動機 / 自我介紹重點
                <textarea value={form.motivation} onChange={(event) => updateField("motivation", event.target.value)} />
              </label>

              <div className="two-column-fields">
                <label>
                  中文程度
                  <select value={form.chineseLevel} onChange={(event) => updateField("chineseLevel", event.target.value)}>
                    {chineseLevelOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  母語 / 參考語言
                  <select value={form.nativeLanguage} onChange={(event) => updateField("nativeLanguage", event.target.value)}>
                    {nativeLanguageOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <div className="two-column-fields">
                <label>
                  聯絡方式
                  <select value={form.contactPlatform} onChange={(event) => updateField("contactPlatform", event.target.value)}>
                    {contactPlatformOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  聯絡帳號
                  <input value={form.contactAccount} onChange={(event) => updateField("contactAccount", event.target.value)} />
                </label>
              </div>

              <div className="two-column-fields">
                <label>
                  護照後四碼
                  <input value={form.passportLast4} maxLength={4} onChange={(event) => updateField("passportLast4", event.target.value.toUpperCase())} />
                </label>
                <label>
                  面試日期
                  <input type="date" value={form.interviewDate} onChange={(event) => updateField("interviewDate", event.target.value)} />
                </label>
              </div>

              <label>
                預計抵台日期
                <input type="date" value={form.taiwanArrivalDate} onChange={(event) => updateField("taiwanArrivalDate", event.target.value)} />
              </label>

              <div className="button-row">
                <button className="ghost-button" type="button" onClick={generateIntro}>
                  <Languages size={18} />
                  產生中文自介
                </button>
                <button className="ghost-button" type="button" onClick={generateBilingual}>
                  <Bot size={18} />
                  產生雙語稿
                </button>
                <button className="ghost-button" type="button" onClick={generateQuestions}>
                  <ClipboardList size={18} />
                  產生練習題
                </button>
                <button className="ghost-button" type="button" onClick={generateCode}>
                  <QrCode size={18} />
                  產生報到碼
                </button>
              </div>

              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? <RefreshCw className="spin" size={18} /> : <CalendarCheck size={18} />}
                儲存面試資料
              </button>
            </>
          )}

          {section === "checkin" && (
            <>
              <label>
                報到碼
                <input value={lookupCode} onChange={(event) => setLookupCode(event.target.value.toUpperCase())} placeholder="FUT-STUDENT-1234" />
              </label>
              <button className="primary-button" type="button" onClick={checkInWithCode} disabled={saving}>
                {saving ? <RefreshCw className="spin" size={18} /> : <CheckCircle2 size={18} />}
                使用報到碼報到
              </button>
            </>
          )}
        </form>

        <section className="panel prep-output">
          <div className="form-section-title">
            <ClipboardList size={20} />
            <strong>準備結果</strong>
          </div>
          <article className="intro-card">
            <span>中文自我介紹</span>
            <p>{activeIntro}</p>
          </article>
          <article className="intro-card">
            <span>雙語稿</span>
            <p>{activeBilingual}</p>
          </article>
          <article className="intro-card">
            <span>面試練習題</span>
            <p>{activeQuestions}</p>
          </article>
          <article className="qr-checkin-card">
            <div>
              <QrCode aria-hidden="true" />
              <strong>面試報到碼</strong>
              <span>{record?.readiness_status ?? "尚未儲存"}</span>
            </div>
            <code>{checkinCode || "按「產生報到碼」後顯示"}</code>
          </article>
        </section>
      </section>
    </main>
  );
}
