import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, Plane, Send, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";

type Role = "student" | "school" | "company" | "agency";
type CaseRow = {
  id: string;
  user_id: string;
  current_stage: number;
  status: string;
  personal_data: Record<string, string>;
  skills_data: Record<string, string>;
  selected_offering_id: string | null;
  second_offering_id: string | null;
  declaration_confirmed: boolean;
  submitted_at: string | null;
};
type Offering = { id: string; school_name: string; department_name: string; program_name: string; language_requirement: string | null; start_term: string | null };
type RoleMessage = { id: string; subject: string; body: string; recipient_role: string | null; created_at: string; read_at: string | null };
type OfferRow = { id: string; case_id: string; offering_id: string | null; scholarship_name: string | null; tuition_support: string | null; loa_document_path: string | null; acceptance_status: "pending" | "accepted" | "declined"; response_due_at: string | null; responded_at: string | null };
type CompanyProfile = { id: string; company_name: string; contact_name: string; contact_email: string; contact_phone: string | null; company_description: string | null; region: string | null; city: string | null; industry: string | null; service_scope: string | null; searchable: boolean; status: string };

const stageNames = ["個人資料、文件與技能", "選擇學校與方案", "確認並送出申請", "面試與錄取函", "準備前往臺灣", "報到與資料確認"];

export function ProgramWorkflow({ role }: { role: Role }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [arrivals, setArrivals] = useState<Record<string, any> | null>(null);
  const [referrals, setReferrals] = useState<Array<Record<string, string>>>([]);
  const [inbox, setInbox] = useState<RoleMessage[]>([]);
  const [offer, setOffer] = useState<OfferRow | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [companyResults, setCompanyResults] = useState<CompanyProfile[]>([]);
  const [companySearch, setCompanySearch] = useState("");

  const reload = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const offeringsResult = await supabase.from("program_offerings").select("id,school_name,department_name,program_name,language_requirement,start_term").eq("active", true);
    setOfferings((offeringsResult.data ?? []) as Offering[]);
    const inboxResult = await supabase.from("program_role_messages").select("id,subject,body,recipient_role,created_at,read_at").or(`sender_id.eq.${user.id},recipient_role.eq.${role}`).order("created_at", { ascending: false }).limit(20);
    setInbox((inboxResult.data ?? []) as RoleMessage[]);
    if (role === "student") {
      const result = await supabase.from("program_application_cases").select("*").eq("user_id", user.id).maybeSingle();
      setCaseRow((result.data ?? null) as CaseRow | null);
      if (result.data) {
        const arrivalResult = await supabase.from("program_case_arrivals").select("*").eq("case_id", result.data.id).maybeSingle();
        setArrivals(arrivalResult.data ?? null);
        const offerResult = await supabase.from("program_case_offers").select("id,case_id,offering_id,scholarship_name,tuition_support,loa_document_path,acceptance_status,response_due_at,responded_at").eq("case_id", result.data.id).maybeSingle();
        setOffer((offerResult.data ?? null) as OfferRow | null);
      }
    }
    if (role === "school") {
      const result = await supabase.from("program_application_cases").select("*").order("updated_at", { ascending: false });
      setCases((result.data ?? []) as CaseRow[]);
    }
    if (role === "agency") {
      const result = await supabase.from("program_agency_referrals").select("*").eq("agency_user_id", user.id).order("updated_at", { ascending: false });
      setReferrals((result.data ?? []) as Array<Record<string, string>>);
    }
    if (role === "company") {
      const result = await supabase.from("program_company_profiles").select("id,company_name,contact_name,contact_email,contact_phone,company_description,region,city,industry,service_scope,searchable,status").eq("user_id", user.id).maybeSingle();
      setCompanyProfile((result.data ?? null) as CompanyProfile | null);
    }
  };
  useEffect(() => { void reload(); }, [role]);

  const saveStudentStage = async (event: FormEvent<HTMLFormElement>, stage: number) => {
    event.preventDefault();
    if (!userId) return;
    setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const personal = Object.fromEntries(["passport_name", "nationality", "phone", "email", "education", "school_major", "chinese_level", "interview_note"].map((key) => [key, String(form.get(key) ?? "")]));
    const skills = Object.fromEntries(["vehicle_skills", "work_experience", "language_skills"].map((key) => [key, String(form.get(key) ?? "")]));
    const payload = {
      user_id: userId,
      current_stage: stage,
      status: stage >= 3 ? "submitted" : "draft",
      personal_data: { ...(caseRow?.personal_data ?? {}), ...personal },
      skills_data: { ...(caseRow?.skills_data ?? {}), ...skills },
      selected_offering_id: String(form.get("selected_offering_id") || caseRow?.selected_offering_id || "") || null,
      second_offering_id: String(form.get("second_offering_id") || caseRow?.second_offering_id || "") || null,
      declaration_confirmed: form.get("declaration") === "on" || caseRow?.declaration_confirmed || false,
      submitted_at: stage >= 3 ? new Date().toISOString() : caseRow?.submitted_at ?? null,
    };
    const result = await supabase.from("program_application_cases").upsert(payload, { onConflict: "user_id" }).select("*").single();
    setBusy(false);
    setMessage(result.error ? result.error.message : `第 ${stage} 階段已儲存。`);
    if (!result.error) { setCaseRow(result.data as CaseRow); await reload(); }
  };
  const saveArrival = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!caseRow) return;
    setBusy(true); const form = new FormData(event.currentTarget);
    const result = await supabase.from("program_case_arrivals").upsert({
      case_id: caseRow.id, visa_status: form.get("visa_status"), departure_date: form.get("departure_date") || null,
      arrival_date: form.get("arrival_date") || null, flight_number: form.get("flight_number") || null,
      pickup_required: form.get("pickup_required") === "on", pickup_notes: form.get("pickup_notes") || null,
      accommodation_status: form.get("accommodation_status"), checkin_status: form.get("checkin_status"),
      reconfirmed_at: form.get("reconfirmed") === "on" ? new Date().toISOString() : null,
    }, { onConflict: "case_id" });
    setBusy(false); setMessage(result.error ? result.error.message : "赴臺與報到資料已儲存。"); if (!result.error) await reload();
  };
  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!userId) return;
    const form = new FormData(event.currentTarget); const caseId = String(form.get("case_id") || "");
    setBusy(true);
    const decision = String(form.get("decision"));
    const nextStatus = decision === "approved" ? String(form.get("next_status") || "document_review") : decision === "rejected" ? "closed" : "document_review";
    const [review, update] = await Promise.all([
      supabase.from("program_case_reviews").insert({ case_id: caseId, reviewer_id: userId, review_type: form.get("review_type"), decision, score: Number(form.get("score") || 0) || null, notes: form.get("notes") || null }),
      supabase.from("program_application_cases").update({ status: nextStatus, current_stage: Number(form.get("next_stage") || 3) }).eq("id", caseId),
    ]);
    setBusy(false); setMessage(review.error?.message ?? update.error?.message ?? "審查結果已記錄並更新申請進度。"); if (!review.error && !update.error) await reload();
  };
  const submitOffer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const caseId = String(form.get("case_id") || "");
    if (!caseId) return; setBusy(true); setMessage("");
    const offerResult = await supabase.from("program_case_offers").upsert({
      case_id: caseId, offering_id: String(form.get("offering_id") || "") || null,
      scholarship_name: String(form.get("scholarship_name") || "") || null,
      tuition_support: String(form.get("tuition_support") || "") || null,
      loa_document_path: String(form.get("loa_reference") || "") || null,
      response_due_at: String(form.get("response_due_at") || "") || null,
    }, { onConflict: "case_id" });
    const caseResult = offerResult.error ? null : await supabase.from("program_application_cases").update({ status: "offered", current_stage: 4 }).eq("id", caseId);
    setBusy(false); setMessage(offerResult.error?.message ?? caseResult?.error?.message ?? "錄取通知已建立，學生可在私有工作台回覆。"); if (!offerResult.error && !caseResult?.error) await reload();
  };
  const respondToOffer = async (decision: "accepted" | "declined") => {
    if (!offer || !caseRow) return; setBusy(true); setMessage("");
    const offerResult = await supabase.from("program_case_offers").update({ acceptance_status: decision, responded_at: new Date().toISOString() }).eq("id", offer.id);
    const caseResult = offerResult.error ? null : await supabase.from("program_application_cases").update({ status: decision === "accepted" ? "accepted" : "closed", current_stage: decision === "accepted" ? 5 : 4 }).eq("id", caseRow.id);
    setBusy(false); setMessage(offerResult.error?.message ?? caseResult?.error?.message ?? (decision === "accepted" ? "已接受錄取，請繼續填寫赴臺準備資料。" : "已送出不接受錄取的回覆。")); if (!offerResult.error && !caseResult?.error) await reload();
  };
  const saveCompanyProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!userId) return; const form = new FormData(event.currentTarget); setBusy(true); setMessage("");
    const result = await supabase.from("program_company_profiles").upsert({
      user_id: userId, company_name: String(form.get("company_name") || ""), contact_name: String(form.get("contact_name") || ""), contact_email: String(form.get("contact_email") || ""), contact_phone: String(form.get("contact_phone") || "") || null,
      company_description: String(form.get("company_description") || "") || null, region: String(form.get("region") || "") || null, city: String(form.get("city") || "") || null,
      industry: String(form.get("industry") || "") || null, service_scope: String(form.get("service_scope") || "") || null, searchable: form.get("searchable") === "on", status: "submitted",
    }, { onConflict: "user_id" });
    setBusy(false); setMessage(result.error?.message ?? "企業資料已儲存；僅協會管理可在合作企業資料庫檢索。"); if (!result.error) await reload();
  };
  const searchCompanies = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const term = companySearch.trim(); setBusy(true); setMessage("");
    let query = supabase.from("program_company_profiles").select("id,company_name,contact_name,contact_email,contact_phone,company_description,region,city,industry,service_scope,searchable,status").eq("searchable", true).order("company_name").limit(50);
    if (term) query = query.or(`company_name.ilike.%${term}%,region.ilike.%${term}%,city.ilike.%${term}%,industry.ilike.%${term}%,service_scope.ilike.%${term}%`);
    const result = await query; setBusy(false); setCompanyResults((result.data ?? []) as CompanyProfile[]); setMessage(result.error?.message ?? `找到 ${(result.data ?? []).length} 家符合條件的合作企業。`);
  };
  const submitReferral = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!userId) return; const form = new FormData(event.currentTarget); setBusy(true);
    const result = await supabase.from("program_agency_referrals").insert({ agency_user_id: userId, applicant_email: form.get("applicant_email"), applicant_name: form.get("applicant_name") || null, country_code: form.get("country_code") || null, notes: form.get("notes") || null, status: "invited" });
    setBusy(false); setMessage(result.error ? result.error.message : "推薦學生已建立；學生完成註冊與申請後，校方可連結後續流程。"); if (!result.error) await reload();
  };
  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!userId) return; const form = new FormData(event.currentTarget); setBusy(true);
    const result = await supabase.from("program_role_messages").insert({ case_id: caseRow?.id ?? null, sender_id: userId, recipient_role: role === "student" ? "school" : "student", subject: form.get("subject"), body: form.get("body") });
    setBusy(false); setMessage(result.error ? result.error.message : "訊息已送出，相關角色可在工作台處理。");
  };
  const Inbox = () => <section className="spec-case-list" aria-label="角色收件匣"><h3>私有訊息</h3>{inbox.length === 0 ? <p>目前沒有訊息。</p> : inbox.map((item) => <article key={item.id}><strong>{item.subject}</strong><span>{item.body}</span><small>{new Date(item.created_at).toLocaleString()}</small></article>)}</section>;
  const OfferManagement = () => <form className="spec-form" onSubmit={submitOffer}><h3>建立錄取通知與回覆期限</h3><p>此處建立的是私有錄取資料；正式錄取函檔案應由受保護儲存交付，不使用公開網址。</p><label>申請個案<select required name="case_id"><option value="">請選擇</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.personal_data?.passport_name || item.user_id.slice(0, 8)}｜{item.status}</option>)}</select></label><label>錄取方案<select name="offering_id"><option value="">依個案志願／稍後確認</option>{offerings.map((item) => <option key={item.id} value={item.id}>{item.school_name}｜{item.program_name}</option>)}</select></label><label>獎助名稱<input name="scholarship_name" placeholder="例如：協會獎助方案"/></label><label>學費支持說明<textarea name="tuition_support"/></label><label>私有文件參考編號<input name="loa_reference" placeholder="不可填公開 URL"/></label><label>學生回覆期限<input name="response_due_at" type="date"/></label><button disabled={busy} type="submit">建立錄取通知</button></form>;
  const CompanySearch = () => <section className="spec-workflow"><form className="spec-form" onSubmit={searchCompanies}><h3>合作企業資料庫檢索</h3><p>僅協會管理可使用。可輸入「南部／臺南／高雄／汽車電子」等地區、城市、產業或公司名稱；資料不對外公開。</p><label>搜尋條件<input value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="例如：南部、臺南、汽車電子" /></label><button disabled={busy} type="submit">搜尋合作企業</button></form>{companyResults.length > 0 && <div className="spec-case-list">{companyResults.map((item) => <article key={item.id}><strong>{item.company_name}</strong><span>{[item.region, item.city, item.industry].filter(Boolean).join("｜") || "尚未分類"}</span><small>{item.service_scope || item.company_description || "未提供服務範圍"}</small></article>)}</div>}</section>;

  if (role === "student") return <section className="spec-workflow" aria-label="六階段申請流程">
    <header><span>六階段申請流程</span><h2>依序完成資料、選校、送件、面試、赴臺與報到</h2></header>
    <ol className="spec-stage-list">{stageNames.map((name, index) => <li key={name} className={(caseRow?.current_stage ?? 1) >= index + 1 ? "done" : ""}><b>{index + 1}</b><span>{name}</span></li>)}</ol>
    <form className="spec-form" onSubmit={(e) => saveStudentStage(e, 1)}>
      <h3>第 1 階段｜個人資料、文件與技能</h3><p>文件請在上方申請問卷上傳；此處補齊正式個案資料。</p>
      <label>護照英文姓名<input required name="passport_name" defaultValue={caseRow?.personal_data?.passport_name ?? ""} /></label><label>國籍<input required name="nationality" defaultValue={caseRow?.personal_data?.nationality ?? ""} /></label><label>Email<input required type="email" name="email" defaultValue={caseRow?.personal_data?.email ?? ""} /></label><label>電話／WhatsApp／Zalo<input required name="phone" defaultValue={caseRow?.personal_data?.phone ?? ""} /></label><label>最高學歷<input required name="education" defaultValue={caseRow?.personal_data?.education ?? ""} /></label><label>畢業學校與科系<input required name="school_major" defaultValue={caseRow?.personal_data?.school_major ?? ""} /></label><label>中文程度<input required name="chinese_level" defaultValue={caseRow?.personal_data?.chinese_level ?? ""} /></label><label>專業技能與實作經驗<textarea required name="vehicle_skills" defaultValue={caseRow?.skills_data?.vehicle_skills ?? ""} /></label><label>工作／實習經驗<textarea name="work_experience" defaultValue={caseRow?.skills_data?.work_experience ?? ""} /></label><button disabled={busy} type="submit">儲存第 1 階段</button>
    </form>
    <form className="spec-form" onSubmit={(e) => saveStudentStage(e, 2)}><h3>第 2 階段｜選擇學校與方案</h3><label>第一志願<select required name="selected_offering_id" defaultValue={caseRow?.selected_offering_id ?? ""}><option value="">請選擇</option>{offerings.map((item) => <option key={item.id} value={item.id}>{item.school_name}｜{item.program_name}｜{item.start_term}</option>)}</select></label><label>第二志願<select name="second_offering_id" defaultValue={caseRow?.second_offering_id ?? ""}><option value="">尚未選擇</option>{offerings.map((item) => <option key={item.id} value={item.id}>{item.program_name}</option>)}</select></label><button disabled={busy} type="submit">儲存方案選擇</button></form>
    <form className="spec-form" onSubmit={(e) => saveStudentStage(e, 3)}><h3>第 3 階段｜確認並送出申請</h3><label className="spec-check"><input required type="checkbox" name="declaration" defaultChecked={caseRow?.declaration_confirmed} />我確認個人資料、文件與技能資訊均屬實，並同意校方依申請流程審查。</label><button disabled={busy} type="submit">確認送出申請</button></form>
    <section className="spec-info"><h3>第 4 階段｜面試與錄取函</h3>{!offer ? <p>協會完成書審與面試後，會在此個案提供錄取與獎助資訊。</p> : <><p>錄取狀態：<strong>{offer.acceptance_status === "pending" ? "等待您的回覆" : offer.acceptance_status === "accepted" ? "您已接受錄取" : "您已婉拒錄取"}</strong></p><p>獎助：{offer.scholarship_name || "未提供"}　學費支持：{offer.tuition_support || "未提供"}</p>{offer.response_due_at && <p>回覆期限：{new Date(offer.response_due_at).toLocaleDateString()}</p>}{offer.loa_document_path && <p>錄取文件已由協會以受保護方式建立；請於私有訊息確認交付方式。</p>}{offer.acceptance_status === "pending" && <p><button type="button" disabled={busy} onClick={() => void respondToOffer("accepted")}>接受錄取</button><button type="button" disabled={busy} onClick={() => void respondToOffer("declined")}>婉拒錄取</button></p>}</>}</section>
    <form className="spec-form" onSubmit={saveArrival}><h3><Plane size={18}/>第 5、6 階段｜赴臺與報到</h3><label>簽證狀態<select name="visa_status" defaultValue={arrivals?.visa_status ?? "not_started"}><option value="not_started">尚未開始</option><option value="preparing">準備中</option><option value="submitted">已送件</option><option value="approved">已核准</option></select></label><label>預計出發日<input name="departure_date" type="date" defaultValue={arrivals?.departure_date ?? ""}/></label><label>抵臺日期<input name="arrival_date" type="date" defaultValue={arrivals?.arrival_date ?? ""}/></label><label>班機資訊<input name="flight_number" defaultValue={arrivals?.flight_number ?? ""}/></label><label>住宿狀態<select name="accommodation_status" defaultValue={arrivals?.accommodation_status ?? "not_started"}><option value="not_started">尚未開始</option><option value="requested">已申請</option><option value="confirmed">已確認</option></select></label><label>報到狀態<select name="checkin_status" defaultValue={arrivals?.checkin_status ?? "not_started"}><option value="not_started">尚未開始</option><option value="scheduled">已安排</option><option value="completed">已完成</option></select></label><label className="spec-check"><input name="pickup_required" type="checkbox" defaultChecked={arrivals?.pickup_required === true || arrivals?.pickup_required === "true"}/>需要接機協助</label><label className="spec-check"><input name="reconfirmed" type="checkbox" defaultChecked={Boolean(arrivals?.reconfirmed_at)}/>我已重新確認個人資料</label><button disabled={busy || !caseRow} type="submit">儲存赴臺／報到資料</button></form>
    <form className="spec-form spec-message" onSubmit={sendMessage}><h3><MessageCircle size={18}/>聯繫校方</h3><label>主旨<input required name="subject" placeholder="例如：文件補件問題"/></label><label>內容<textarea required name="body"/></label><button disabled={busy} type="submit"><Send size={16}/>送出訊息</button></form><Inbox />{message && <p className="account-message">{message}</p>}
  </section>;

  if (role === "school") return <section className="spec-workflow"><header><span>協會管理流程</span><h2>書審、面試、錄取、來臺與報到管理</h2></header><form className="spec-form" onSubmit={submitReview}><h3><ShieldCheck size={18}/>建立審查紀錄</h3><label>申請個案<select required name="case_id"><option value="">請選擇</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.personal_data?.passport_name || item.user_id.slice(0, 8)}｜第 {item.current_stage} 階段｜{item.status}</option>)}</select></label><label>審查類型<select name="review_type"><option value="document">文件審查</option><option value="interview">面試</option><option value="admission">錄取</option><option value="scholarship">獎助</option></select></label><label>結果<select name="decision"><option value="approved">通過</option><option value="revision_requested">補件</option><option value="rejected">不通過</option></select></label><label>分數<input name="score" type="number" min="0" max="100"/></label><label>下一階段<select name="next_stage"><option value="3">確認送件</option><option value="4">面試與錄取函</option><option value="5">赴臺準備</option><option value="6">報到</option></select></label><label>個案狀態<select name="next_status"><option value="document_review">文件審查</option><option value="interview">面試</option><option value="offered">已發錄取</option><option value="accepted">已接受</option><option value="preparing_arrival">赴臺準備</option><option value="enrolled">已報到</option></select></label><label>備註<textarea name="notes"/></label><button disabled={busy} type="submit">記錄審查並更新流程</button></form><OfferManagement /><CompanySearch /><div className="spec-case-list">{cases.map((item) => <article key={item.id}><strong>{item.personal_data?.passport_name || "申請者"}</strong><span>第 {item.current_stage} 階段｜{item.status}</span></article>)}</div><Inbox />{message && <p className="account-message">{message}</p>}</section>;

  if (role === "agency") return <section className="spec-workflow"><header><span>留學代辦工作台</span><h2>建立推薦學生、追蹤申請與面試流程</h2></header><form className="spec-form" onSubmit={submitReferral}><h3>新增推薦學生</h3><label>學生英文姓名<input name="applicant_name"/></label><label>學生 Email<input required type="email" name="applicant_email"/></label><label>國家／地區<input name="country_code" placeholder="VN / ID"/></label><label>推薦與協助說明<textarea name="notes"/></label><button disabled={busy} type="submit">建立推薦紀錄</button></form><div className="spec-case-list">{referrals.map((item) => <article key={item.id}><strong>{item.applicant_name || item.applicant_email}</strong><span>{item.country_code || "—"}｜{item.status}</span></article>)}</div>{message && <p className="account-message">{message}</p>}</section>;

  return <section className="spec-workflow"><header><span>合作企業工作台</span><h2>企業資料、職缺、推薦候選人與面試</h2></header><p className="spec-info">完成企業資料後，協會管理才能依地區、城市與產業檢索合作企業；候選人資訊仍只會在授權媒合後顯示。</p><form className="spec-form" onSubmit={saveCompanyProfile}><h3>企業可檢索資料</h3><label>公司名稱<input required name="company_name" defaultValue={companyProfile?.company_name ?? ""}/></label><label>聯絡人<input required name="contact_name" defaultValue={companyProfile?.contact_name ?? ""}/></label><label>聯絡 Email<input required type="email" name="contact_email" defaultValue={companyProfile?.contact_email ?? ""}/></label><label>聯絡電話<input name="contact_phone" defaultValue={companyProfile?.contact_phone ?? ""}/></label><label>服務區域<select name="region" defaultValue={companyProfile?.region ?? ""}><option value="">請選擇</option><option value="北部">北部</option><option value="中部">中部</option><option value="南部">南部</option><option value="東部">東部</option><option value="離島">離島</option></select></label><label>城市／縣市<input name="city" placeholder="例如：臺南市" defaultValue={companyProfile?.city ?? ""}/></label><label>產業分類<input name="industry" placeholder="例如：汽車維修、車用電子" defaultValue={companyProfile?.industry ?? ""}/></label><label>合作／服務範圍<textarea name="service_scope" defaultValue={companyProfile?.service_scope ?? ""}/></label><label>公司簡介<textarea name="company_description" defaultValue={companyProfile?.company_description ?? ""}/></label><label className="spec-check"><input type="checkbox" name="searchable" defaultChecked={companyProfile?.searchable ?? true}/>同意提供協會管理於私有合作企業資料庫檢索</label><button disabled={busy} type="submit">儲存企業資料</button></form>{message && <p className="account-message">{message}</p>}</section>;
}
