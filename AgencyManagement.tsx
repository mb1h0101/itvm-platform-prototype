import { Building2, Globe2, Link2, RefreshCw, Save, Search, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Agency, AgencyCountryCode, AgencyStudent, InterviewRecord, LineProfile, School, Student, supabase, Teacher } from "../lib/supabase";

type Props = {
  profile: LineProfile;
  teacher: Teacher;
  isAdmin: boolean;
};

type AgencyForm = {
  countryCode: AgencyCountryCode;
  name: string;
  contactName: string;
  contactLineUserId: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

const defaultAgencyForm: AgencyForm = {
  countryCode: "VN",
  name: "",
  contactName: "",
  contactLineUserId: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
};

const countryLabels: Record<AgencyCountryCode, string> = {
  VN: "越南",
  ID: "印尼",
  OTHER: "其他",
};

const statusLabels: Record<AgencyStudent["status"], string> = {
  prospect: "潛在學生",
  applied: "已申請",
  interviewing: "面試中",
  accepted: "已錄取",
  arrived: "已抵台",
  inactive: "暫停追蹤",
};

function inferCountryCode(country: string | null | undefined): AgencyCountryCode {
  const value = (country ?? "").toLowerCase();
  if (value.includes("越") || value.includes("vietnam") || value.includes("viet")) return "VN";
  if (value.includes("印尼") || value.includes("indonesia") || value.includes("bahasa")) return "ID";
  return "OTHER";
}

export function AgencyManagement({ profile, teacher, isAdmin }: Props) {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [assignments, setAssignments] = useState<AgencyStudent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [form, setForm] = useState<AgencyForm>(defaultAgencyForm);
  const [countryFilter, setCountryFilter] = useState<AgencyCountryCode | "all">("all");
  const [agencyId, setAgencyId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [recordId, setRecordId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedAgency = agencies.find((agency) => agency.id === agencyId) ?? null;

  const visibleAgencies = useMemo(() => {
    return agencies.filter((agency) => countryFilter === "all" || agency.country_code === countryFilter);
  }, [agencies, countryFilter]);

  const visibleAssignments = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    return assignments.filter((item) => {
      if (countryFilter !== "all" && item.country_code !== countryFilter) return false;
      if (agencyId && item.agency_id !== agencyId) return false;
      if (!key) return true;
      return [item.student_name, item.student_no ?? "", item.line_user_id ?? "", item.agencies?.name ?? "", item.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(key);
    });
  }, [agencyId, assignments, countryFilter, keyword]);

  const candidates = useMemo(() => {
    const rosterCandidates = students.map((student) => ({
      id: `student:${student.id}`,
      label: `${student.name} / ${student.student_no}`,
      detail: student.class_name || "學生名單",
      countryCode: selectedAgency?.country_code ?? "OTHER",
      student,
      record: null as InterviewRecord | null,
    }));

    const recordCandidates = records.map((record) => ({
      id: `record:${record.id}`,
      label: `${record.student_name} / ${record.country}`,
      detail: `${record.target_department} / ${record.readiness_status}`,
      countryCode: inferCountryCode(record.country),
      student: null as Student | null,
      record,
    }));

    const filtered = [...recordCandidates, ...rosterCandidates].filter((item) => {
      if (selectedAgency && item.countryCode !== "OTHER" && item.countryCode !== selectedAgency.country_code) return false;
      const key = keyword.trim().toLowerCase();
      if (!key) return true;
      return [item.label, item.detail].join(" ").toLowerCase().includes(key);
    });

    return filtered.slice(0, 80);
  }, [keyword, records, selectedAgency, students]);

  async function loadAll() {
    setLoading(true);
    setMessage("");

    let agencyQuery = supabase.from("agencies").select("*").eq("is_active", true).order("country_code").order("name");
    let studentQuery = supabase.from("students").select("*").order("student_no");
    let recordQuery = supabase.from("interview_records").select("*").order("created_at", { ascending: false }).limit(250);
    const agencyRelation = teacher.school_id ? "agencies!inner(name, country_code)" : "agencies(name, country_code)";
    let assignmentQuery = supabase
      .from("agency_students")
      .select(`*, ${agencyRelation}, students(name, student_no, class_name, line_user_id), interview_records(student_name, country, target_department, readiness_status)`)
      .order("updated_at", { ascending: false });

    if (teacher.school_id) {
      agencyQuery = agencyQuery.eq("school_id", teacher.school_id);
      studentQuery = studentQuery.eq("school_id", teacher.school_id);
      recordQuery = recordQuery.eq("school_id", teacher.school_id);
      assignmentQuery = assignmentQuery.eq("agencies.school_id", teacher.school_id);
    }

    const schoolQuery = supabase.from("schools").select("*").eq("is_active", true).order("name");
    const [{ data: agencyData, error: agencyError }, { data: studentData, error: studentError }, { data: recordData, error: recordError }, { data: assignmentData, error: assignmentError }, { data: schoolData }] =
      await Promise.all([agencyQuery, studentQuery, recordQuery, assignmentQuery, schoolQuery]);

    setLoading(false);
    const error = agencyError || studentError || recordError || assignmentError;
    if (error) {
      setMessage(error.message);
      return;
    }

    const nextAgencies = (agencyData ?? []) as Agency[];
    setAgencies(nextAgencies);
    setStudents((studentData ?? []) as Student[]);
    setRecords((recordData ?? []) as InterviewRecord[]);
    setAssignments((assignmentData ?? []) as AgencyStudent[]);
    setSchools((schoolData ?? []) as School[]);
    if (!agencyId && nextAgencies[0]) setAgencyId(nextAgencies[0].id);
  }

  function updateForm(field: keyof AgencyForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function createAgency(event: FormEvent) {
    event.preventDefault();
    if (!isAdmin) {
      setMessage("只有管理者可以建立代辦。");
      return;
    }
    if (!form.name.trim()) {
      setMessage("請先填代辦名稱。");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("agencies")
      .insert({
        school_id: teacher.school_id ?? null,
        country_code: form.countryCode,
        name: form.name.trim(),
        contact_name: form.contactName.trim() || null,
        contact_line_user_id: form.contactLineUserId.trim() || null,
        contact_email: form.contactEmail.trim() || null,
        contact_phone: form.contactPhone.trim() || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    const nextAgency = data as Agency;
    setAgencies((prev) => [nextAgency, ...prev]);
    setAgencyId(nextAgency.id);
    setForm(defaultAgencyForm);
    setMessage(`已建立 ${countryLabels[nextAgency.country_code]}代辦：${nextAgency.name}`);
  }

  async function assignCandidate() {
    if (!agencyId) {
      setMessage("請先選擇代辦。");
      return;
    }

    const selectedStudent = students.find((student) => student.id === studentId) ?? null;
    const selectedRecord = records.find((record) => record.id === recordId) ?? null;
    if (!selectedStudent && !selectedRecord) {
      setMessage("請選擇學生名單或面試紀錄。");
      return;
    }

    const countryCode = selectedAgency?.country_code ?? inferCountryCode(selectedRecord?.country);
    const payload = {
      agency_id: agencyId,
      student_id: selectedStudent?.id ?? null,
      interview_record_id: selectedRecord?.id ?? null,
      country_code: countryCode,
      student_name: selectedStudent?.name ?? selectedRecord?.student_name ?? profile.displayName,
      student_no: selectedStudent?.student_no ?? null,
      line_user_id: selectedStudent?.line_user_id ?? null,
      status: selectedRecord ? "interviewing" : "prospect",
      notes: selectedRecord ? `${selectedRecord.target_department} / ${selectedRecord.readiness_status}` : selectedStudent?.class_name ?? null,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    const { error } = await supabase.from("agency_students").insert(payload);
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setStudentId("");
    setRecordId("");
    setMessage("已完成代辦與學生歸屬設定。");
    await loadAll();
  }

  async function updateAssignmentStatus(item: AgencyStudent, status: AgencyStudent["status"]) {
    const { error } = await supabase.from("agency_students").update({ status, updated_at: new Date().toISOString() }).eq("id", item.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setAssignments((prev) => prev.map((row) => (row.id === item.id ? { ...row, status } : row)));
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="screen">
      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">國際學生營運分流</p>
          <h1>越南 / 印尼代辦與學生歸屬</h1>
          <p className="subtle">{teacher.name || profile.displayName} 可以在這裡設定代辦、學生來源、追蹤狀態與 LINE 聯繫資訊。</p>
        </div>
        <Globe2 aria-hidden="true" />
      </section>

      <section className="stats-grid">
        <div className="stat"><span>代辦總數</span><strong>{agencies.length}</strong></div>
        <div className="stat"><span>越南學生</span><strong>{assignments.filter((item) => item.country_code === "VN").length}</strong></div>
        <div className="stat"><span>印尼學生</span><strong>{assignments.filter((item) => item.country_code === "ID").length}</strong></div>
        <div className="stat"><span>學校</span><strong>{schools.length}</strong></div>
      </section>

      <section className="interview-layout">
        <form className="panel form-panel" onSubmit={createAgency}>
          <div className="form-section-title">
            <Building2 size={20} />
            <strong>建立代辦</strong>
          </div>
          <div className="two-column-fields">
            <label>
              國別
              <select value={form.countryCode} onChange={(event) => updateForm("countryCode", event.target.value as AgencyCountryCode)}>
                <option value="VN">越南</option>
                <option value="ID">印尼</option>
                <option value="OTHER">其他</option>
              </select>
            </label>
            <label>
              代辦名稱
              <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="例：河內合作代辦 A" />
            </label>
          </div>
          <div className="two-column-fields">
            <label>
              聯絡人
              <input value={form.contactName} onChange={(event) => updateForm("contactName", event.target.value)} />
            </label>
            <label>
              LINE userId
              <input value={form.contactLineUserId} onChange={(event) => updateForm("contactLineUserId", event.target.value)} />
            </label>
          </div>
          <div className="two-column-fields">
            <label>
              Email
              <input value={form.contactEmail} onChange={(event) => updateForm("contactEmail", event.target.value)} />
            </label>
            <label>
              電話
              <input value={form.contactPhone} onChange={(event) => updateForm("contactPhone", event.target.value)} />
            </label>
          </div>
          <label>
            備註
            <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
          </label>
          <button className="primary-button" type="submit" disabled={saving || !isAdmin}>
            {saving ? <RefreshCw className="spin" size={18} /> : <Save size={18} />}
            儲存代辦
          </button>
        </form>

        <section className="panel form-panel">
          <div className="form-section-title">
            <Link2 size={20} />
            <strong>指派學生</strong>
          </div>
          <label>
            代辦
            <select value={agencyId} onChange={(event) => setAgencyId(event.target.value)}>
              <option value="">選擇代辦</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>{countryLabels[agency.country_code]} - {agency.name}</option>
              ))}
            </select>
          </label>
          <label>
            搜尋候選學生
            <div className="search-box">
              <Search size={18} />
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="姓名、學號、國別、科系" />
            </div>
          </label>
          <label>
            從學生名單指派
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              <option value="">不選學生名單</option>
              {students.slice(0, 250).map((student) => (
                <option key={student.id} value={student.id}>{student.name} / {student.student_no} / {student.class_name || "未分班"}</option>
              ))}
            </select>
          </label>
          <label>
            從面試紀錄指派
            <select value={recordId} onChange={(event) => setRecordId(event.target.value)}>
              <option value="">不選面試紀錄</option>
              {candidates.filter((item) => item.record).map((item) => (
                <option key={item.id} value={item.record?.id}>{item.label} / {item.detail}</option>
              ))}
            </select>
          </label>
          <button className="ghost-button" type="button" onClick={assignCandidate} disabled={saving || !agencyId}>
            {saving ? <RefreshCw className="spin" size={18} /> : <UserPlus size={18} />}
            建立歸屬
          </button>
        </section>
      </section>

      <section className="panel filters interview-records-panel">
        <label>
          國別
          <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value as AgencyCountryCode | "all")}>
            <option value="all">全部</option>
            <option value="VN">越南</option>
            <option value="ID">印尼</option>
            <option value="OTHER">其他</option>
          </select>
        </label>
        <button className="ghost-button" type="button" onClick={loadAll}>
          {loading ? <RefreshCw className="spin" size={18} /> : <RefreshCw size={18} />}
          重新整理
        </button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="teacher-overview-grid">
        {visibleAgencies.map((agency) => (
          <button className={agencyId === agency.id ? "teacher-chip active" : "teacher-chip"} key={agency.id} type="button" onClick={() => setAgencyId(agency.id)}>
            <strong>{countryLabels[agency.country_code]} - {agency.name}</strong>
            <span>{agency.contact_name || "未填聯絡人"} / {assignments.filter((item) => item.agency_id === agency.id).length} 位學生</span>
          </button>
        ))}
      </section>

      <section className="records">
        {visibleAssignments.map((item) => (
          <article className="record interview-record" key={item.id}>
            <div className="record-main">
              <strong>{item.student_name}</strong>
              <span>{countryLabels[item.country_code]} / {item.agencies?.name ?? "未命名代辦"}</span>
              <small>{item.student_no || "未綁學號"} / {item.line_user_id || "未綁 LINE"}</small>
              {item.notes && <p>{item.notes}</p>}
            </div>
            <div className="record-actions">
              <span className="badge">{statusLabels[item.status]}</span>
              <select value={item.status} onChange={(event) => updateAssignmentStatus(item, event.target.value as AgencyStudent["status"])}>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </article>
        ))}
        {!loading && visibleAssignments.length === 0 && <p className="empty">目前沒有符合條件的代辦學生歸屬。</p>}
      </section>
    </main>
  );
}
