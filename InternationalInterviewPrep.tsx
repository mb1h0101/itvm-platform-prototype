import {
  ArrowLeft,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Languages,
  QrCode,
  RefreshCw,
  Search,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { isDefaultCourse } from "../App";
import { mergeRequiredSchools } from "../lib/academic";
import { generateStudentAiText, isExternalAiConfigured } from "../lib/ai";
import { Course, InterviewRecord, LineProfile, RosterImport, School, Student, supabase, Teacher } from "../lib/supabase";

type Props = {
  profile: LineProfile;
  teacher: Teacher;
  courses: Course[];
  isAdmin: boolean;
  audience?: "international" | "future";
  initialSection?: string;
  onBack?: () => void;
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
  courseId: string;
  assignedTeacherId: string;
};

const defaultForm: PrepForm = {
  studentName: "",
  country: "",
  targetDepartment: "",
  motivation: "",
  chineseLevel: "初級",
  nativeLanguage: "英文",
  contactPlatform: "Email",
  contactAccount: "",
  passportLast4: "",
  interviewDate: "",
  taiwanArrivalDate: "",
  courseId: "",
  assignedTeacherId: "",
};

const languageOptions = ["英文", "越南文", "印尼文", "泰文", "日文", "韓文", "西班牙文"];
const platformOptions = ["Email", "LINE", "WhatsApp", "Zalo", "Messenger", "WeChat", "Telegram", "Google Meet"];
const statusOptions = ["待準備", "已產生自介", "已完成翻譯", "已預約面試", "已報到", "已面試", "需補件"];

const languageLabels: Record<string, string> = {
  英文: "English",
  越南文: "Tieng Viet",
  印尼文: "Bahasa Indonesia",
  泰文: "Thai",
  日文: "Japanese",
  韓文: "Korean",
  西班牙文: "Spanish",
};

function normalizeName(name: string) {
  return name.trim() || "學生";
}

function buildCheckinCode(studentName: string, passportLast4: string) {
  const name = normalizeName(studentName).replace(/\s+/g, "-").toUpperCase();
  const suffix = passportLast4.trim() || Date.now().toString(36).slice(-4).toUpperCase();
  return `INT-${name}-${suffix}`;
}

function buildChineseIntro(form: PrepForm) {
  const name = normalizeName(form.studentName);
  const country = form.country.trim() || "我的國家";
  const department = form.targetDepartment.trim() || "申請科系";
  const motivation = form.motivation.trim() || "我希望到台灣學習專業知識，也期待認識不同文化，提升自己的中文能力。";

  return [
    `各位老師好，我叫 ${name}，我來自 ${country}。`,
    `我想申請 ${department}，因為${motivation}`,
    `我的中文程度目前是${form.chineseLevel}，我會持續練習聽說讀寫，希望未來能更順利地在台灣學習與生活。`,
    "謝謝老師給我這次面試的機會。",
  ].join("\n");
}

function buildBilingualDraft(form: PrepForm, intro: string) {
  const lang = languageLabels[form.nativeLanguage] ?? form.nativeLanguage;
  const name = normalizeName(form.studentName);
  const country = form.country.trim() || "my country";
  const department = form.targetDepartment.trim() || "the program";

  if (form.nativeLanguage === "英文") {
    return [
      "English version",
      `Hello professors, my name is ${name}, and I come from ${country}.`,
      `I would like to apply for ${department}. My motivation is: ${form.motivation.trim() || "I hope to study professional knowledge in Taiwan and improve my Chinese ability."}`,
      `My current Chinese level is ${form.chineseLevel}. I will keep practicing so I can study and live in Taiwan more smoothly.`,
    ].join("\n");
  }

  return [
    `${lang} assistant draft`,
    "This is a machine-assisted bilingual draft for checking meaning with the student.",
    "",
    intro,
    "",
    `Key meaning: ${name} is from ${country}, wants to apply for ${department}, and is preparing Chinese for the interview.`,
  ].join("\n");
}

function buildInterviewSummary(form: PrepForm, intro: string) {
  return [
    `學生：${normalizeName(form.studentName)} / ${form.country.trim() || "未填國家"}`,
    `申請：${form.targetDepartment.trim() || "未填科系"}`,
    `中文程度：${form.chineseLevel}`,
    `主要動機：${form.motivation.trim() || "尚未填寫"}`,
    `建議追問：請學生用中文說明申請動機、來台後的學習目標，以及遇到語言困難時會如何處理。`,
    "",
    "中文自介稿：",
    intro,
  ].join("\n");
}

function buildPracticeQuestions(form: PrepForm) {
  const department = form.targetDepartment.trim() || "這個科系";
  return [
    `1. 你為什麼想申請${department}？`,
    "2. 你為什麼想來台灣讀書？",
    "3. 你目前怎麼練習中文？",
    "4. 如果上課聽不懂，你會怎麼做？",
    "5. 請用中文介紹你的家鄉或學校。",
  ].join("\n");
}

function inferGradeLabel(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text) return "未分年級";
  const numberMatch = text.match(/([1-6])\s*年/);
  if (numberMatch) return `${numberMatch[1]}年級`;
  return "未分年級";
}

function extraInfo(form: PrepForm) {
  return [
    `母語：${form.nativeLanguage}`,
    `通訊軟體：${form.contactPlatform}`,
    `通訊帳號：${form.contactAccount || "未填"}`,
    `護照末四碼：${form.passportLast4 || "未填"}`,
  ].join("\n");
}

export function InternationalInterviewPrep({ profile, teacher, courses, isAdmin, initialSection = "overview", onBack }: Props) {
  const [form, setForm] = useState<PrepForm>(() => ({
    ...defaultForm,
    courseId: courses.find((course) => !isDefaultCourse(course))?.id ?? "",
    assignedTeacherId: isAdmin ? "" : teacher.id,
  }));
  const [section, setSection] = useState(initialSection);
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [rosterStudents, setRosterStudents] = useState<Student[]>([]);
  const [rosterImports, setRosterImports] = useState<RosterImport[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [keyword, setKeyword] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState(teacher.school_id ?? "all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedIntro, setGeneratedIntro] = useState("");
  const [translation, setTranslation] = useState("");
  const [summary, setSummary] = useState("");
  const [questions, setQuestions] = useState("");
  const [checkinCode, setCheckinCode] = useState("");

  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const schoolNameById = useMemo(() => new Map(schools.map((school) => [school.id, school.name])), [schools]);
  const managedCourseIds = useMemo(() => courses.filter((course) => !isDefaultCourse(course)).map((course) => course.id), [courses]);
  const activeIntro = generatedIntro || buildChineseIntro(form);

  const classOptions = useMemo(() => {
    const values = new Set<string>();
    rosterStudents.forEach((student) => values.add(student.class_name || "未分班"));
    courses.filter((course) => !isDefaultCourse(course)).forEach((course) => values.add(course.classroom || course.name || "未分班"));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "zh-TW"));
  }, [courses, rosterStudents]);

  const gradeOptions = useMemo(() => {
    const values = new Set<string>();
    classOptions.forEach((item) => values.add(inferGradeLabel(item)));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "zh-TW"));
  }, [classOptions]);

  const scopedCourses = useMemo(() => {
    return courses.filter((course) => {
      if (isDefaultCourse(course)) return false;
      if (schoolFilter !== "all" && (course.school_id ?? "none") !== schoolFilter) return false;
      return true;
    });
  }, [courses, schoolFilter]);

  const teacherClassrooms = useMemo(() => {
    const map = new Map<string, Set<string>>();
    courses
      .filter((course) => !isDefaultCourse(course) && course.teacher_id)
      .forEach((course) => {
        const values = map.get(course.teacher_id as string) ?? new Set<string>();
        values.add(course.classroom);
        values.add(course.name);
        map.set(course.teacher_id as string, values);
      });
    return map;
  }, [courses]);

  const visibleRecords = useMemo(() => {
    const baseRecords = isAdmin
      ? records
      : records.filter((record) => {
          const belongsToCourse = Boolean(record.course_id && managedCourseIds.includes(record.course_id));
          return belongsToCourse || record.assigned_teacher_id === teacher.id || record.created_by_teacher_id === teacher.id;
        });

    const filteredRecords = baseRecords.filter((record) => {
      const course = record.course_id ? courseById.get(record.course_id) : null;
      const className = course?.classroom ?? record.courses?.classroom ?? "";
      if (teacherFilter !== "all" && record.assigned_teacher_id !== teacherFilter && record.created_by_teacher_id !== teacherFilter) return false;
      if (schoolFilter !== "all" && (record.school_id ?? course?.school_id ?? "none") !== schoolFilter) return false;
      if (courseFilter !== "all" && record.course_id !== courseFilter) return false;
      if (classFilter !== "all" && className !== classFilter) return false;
      if (gradeFilter !== "all" && inferGradeLabel(className || record.target_department) !== gradeFilter) return false;
      return true;
    });

    const key = keyword.trim().toLowerCase();
    if (!key) return filteredRecords;

    return filteredRecords.filter((record) =>
      [
        record.student_name,
        record.country,
        record.target_department,
        record.chinese_level,
        record.readiness_status,
        record.checkin_code,
        record.courses?.name ?? "",
        record.courses?.classroom ?? "",
        schoolNameById.get(record.school_id ?? "") ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(key),
    );
  }, [classFilter, courseById, courseFilter, gradeFilter, isAdmin, keyword, managedCourseIds, records, schoolFilter, schoolNameById, teacher.id, teacherFilter]);

  const visibleRosterStudents = useMemo(() => {
    const baseStudents = isAdmin
      ? rosterStudents
      : rosterStudents.filter((student) => {
          const isSameSchool = !teacher.school_id || (student.school_id ?? null) === teacher.school_id;
          const teacherClasses = teacherClassrooms.get(teacher.id);
          const isTeacherClass = Boolean(student.class_name && teacherClasses?.has(student.class_name));
          return isSameSchool && isTeacherClass;
        });

    const filteredStudents = baseStudents.filter((student) => {
      if (schoolFilter !== "all" && (student.school_id ?? "none") !== schoolFilter) return false;
      if (classFilter !== "all" && (student.class_name || "未分班") !== classFilter) return false;
      if (gradeFilter !== "all" && inferGradeLabel(student.class_name) !== gradeFilter) return false;
      if (courseFilter !== "all") {
        const course = courseById.get(courseFilter);
        if (!course || (student.class_name || "未分班") !== course.classroom) return false;
      }
      return true;
    });

    const key = keyword.trim().toLowerCase();
    if (!key) return filteredStudents;

    return filteredStudents.filter((student) =>
      [student.student_no, student.name, student.class_name ?? "", student.line_user_id, schoolNameById.get(student.school_id ?? "") ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(key),
    );
  }, [classFilter, courseById, courseFilter, gradeFilter, isAdmin, keyword, rosterStudents, schoolFilter, schoolNameById, teacher.id, teacher.school_id, teacherClassrooms]);

  const teacherSummaries = useMemo(() => {
    return teachers.map((item) => ({
      teacher: item,
      count: rosterStudents.filter((student) => {
        const teacherClasses = teacherClassrooms.get(item.id);
        return Boolean(student.class_name && teacherClasses?.has(student.class_name));
      }).length,
      courseCount: courses.filter((course) => course.teacher_id === item.id).length,
    }));
  }, [courses, rosterStudents, teacherClassrooms, teachers]);

  const totalManagedStudentCount = rosterStudents.length || rosterImports.reduce((total, item) => total + item.imported_rows, 0);

  function updateField(field: keyof PrepForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function runAiIntro() {
    const intro = buildChineseIntro(form);
    setGeneratedIntro(intro);
    setMessage("已產生可編輯的中文自我介紹。");
  }

  function runAiTranslation() {
    const intro = activeIntro;
    setTranslation(buildBilingualDraft(form, intro));
    setMessage("已產生雙語輔助稿。");
  }

  function runAiSummary() {
    const intro = activeIntro;
    setSummary(buildInterviewSummary(form, intro));
    setQuestions(buildPracticeQuestions(form));
    setMessage("已產生面試官摘要與練習題。");
  }

  function generateCode() {
    const code = buildCheckinCode(form.studentName, form.passportLast4);
    setCheckinCode(code);
    setMessage("已產生報到碼，可直接儲存到面試資料。");
  }

  async function runExternalAiIntro() {
    setSaving(true);
    const intro = await generateStudentAiText({ task: "intro", locale: "zh-TW", ...form }, () => buildChineseIntro(form));
    setGeneratedIntro(intro);
    setSaving(false);
    setMessage(isExternalAiConfigured ? "AI 已產生中文自我介紹。" : "已用本地規則產生中文自我介紹。");
  }

  async function runExternalAiTranslation() {
    setSaving(true);
    const intro = activeIntro;
    const text = await generateStudentAiText(
      { task: "translation", locale: form.nativeLanguage, context: intro, ...form },
      () => buildBilingualDraft(form, intro),
    );
    setTranslation(text);
    setSaving(false);
    setMessage(isExternalAiConfigured ? "AI 已產生雙語輔助稿。" : "已用本地規則產生雙語輔助稿。");
  }

  async function runExternalAiSummary() {
    setSaving(true);
    const intro = activeIntro;
    const [nextSummary, nextQuestions] = await Promise.all([
      generateStudentAiText({ task: "summary", locale: "zh-TW", context: intro, ...form }, () => buildInterviewSummary(form, intro)),
      generateStudentAiText({ task: "questions", locale: "zh-TW", context: intro, ...form }, () => buildPracticeQuestions(form)),
    ]);
    setSummary(nextSummary);
    setQuestions(nextQuestions);
    setSaving(false);
    setMessage(isExternalAiConfigured ? "AI 已產生面試摘要與練習題。" : "已用本地規則產生面試摘要與練習題。");
  }

  async function loadRecords() {
    setLoading(true);
    setMessage("");

    let query = supabase.from("interview_records").select("*, courses(name, classroom)").order("created_at", { ascending: false });
    if (teacher.school_id) query = query.eq("school_id", teacher.school_id);

    let teacherQuery = supabase.from("teachers").select("*").eq("is_active", true).order("name", { ascending: true });
    if (teacher.school_id) teacherQuery = teacherQuery.eq("school_id", teacher.school_id);

    let studentQuery = supabase.from("students").select("*").order("class_name", { ascending: true }).order("student_no", { ascending: true });
    if (teacher.school_id) studentQuery = studentQuery.eq("school_id", teacher.school_id);

    let importQuery = supabase.from("roster_imports").select("*").order("submitted_at", { ascending: false });
    if (teacher.school_id) importQuery = importQuery.eq("school_id", teacher.school_id);

    const schoolQuery = supabase.from("schools").select("*").eq("is_active", true).order("name", { ascending: true });
    const [{ data, error }, { data: teacherData, error: teacherError }, { data: studentData, error: studentError }, { data: importData }, { data: schoolData }] =
      await Promise.all([query, teacherQuery, studentQuery, importQuery, schoolQuery]);

    setLoading(false);
    if (error || teacherError || studentError) {
      setMessage(error?.message || teacherError?.message || studentError?.message || "");
      return;
    }

    setRecords((data ?? []) as InterviewRecord[]);
    setTeachers((teacherData ?? []) as Teacher[]);
    setRosterStudents((studentData ?? []) as Student[]);
    setRosterImports((importData ?? []) as RosterImport[]);
    setSchools(mergeRequiredSchools((schoolData ?? []) as School[]));
  }

  async function updateRecordStatus(recordId: string, status: string) {
    const { error } = await supabase.from("interview_records").update({ readiness_status: status, updated_at: new Date().toISOString() }).eq("id", recordId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setRecords((prev) => prev.map((record) => (record.id === recordId ? { ...record, readiness_status: status } : record)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const selectedCourse = courses.find((course) => course.id === form.courseId);
    const courseId = selectedCourse && !isDefaultCourse(selectedCourse) ? selectedCourse.id : null;
    const code = checkinCode || buildCheckinCode(form.studentName, form.passportLast4);
    const intro = activeIntro;
    const combinedIntro = [
      intro,
      "",
      "雙語輔助稿：",
      translation || buildBilingualDraft(form, intro),
      "",
      "面試官摘要：",
      summary || buildInterviewSummary(form, intro),
      "",
      "練習題：",
      questions || buildPracticeQuestions(form),
      "",
      extraInfo(form),
    ].join("\n");

    const payload = {
      school_id: selectedCourse?.school_id ?? (teacher.school_id || null),
      student_name: form.studentName.trim(),
      country: form.country.trim(),
      target_department: form.targetDepartment.trim(),
      motivation: [form.motivation.trim(), extraInfo(form)].filter(Boolean).join("\n\n"),
      chinese_level: form.chineseLevel,
      interview_date: form.interviewDate || null,
      taiwan_arrival_date: form.taiwanArrivalDate || null,
      intro_script: combinedIntro,
      checkin_code: code,
      readiness_status: translation ? "已完成翻譯" : "已產生自介",
      course_id: courseId,
      assigned_teacher_id: isAdmin ? form.assignedTeacherId || null : teacher.id,
      created_by_teacher_id: teacher.id === "00000000-0000-0000-0000-000000000000" ? null : teacher.id,
    };

    const { error } = await supabase.from("interview_records").insert(payload);
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setCheckinCode(code);
    setMessage("已儲存面試資料、AI 輔助稿與報到碼。");
    await loadRecords();
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  return (
    <main className="screen">
      {onBack && (
        <button className="back-button ghost-button" type="button" onClick={onBack}>
          <ArrowLeft size={18} />
          回上一頁
        </button>
      )}

      <section className="panel hero-panel">
        <div>
          <img className="school-logo" src="/stust-logo-en.png" alt="Southern Taiwan University of Science and Technology Logo" />
          <p className="eyebrow">國際面試管理</p>
          <h1>{isAdmin ? "國際學生面試工作台" : "面試準備管理"}</h1>
        </div>
        <UserCheck aria-hidden="true" />
      </section>

      {section !== "overview" && (
        <button className="wide-action ghost-button" type="button" onClick={() => setSection("overview")}>
          <ArrowLeft size={18} />
          回到工作台選單
        </button>
      )}

      {section === "overview" && (
        <>
          <section className="mode-switch">
            <button className="ghost-button" type="button" onClick={() => setSection("students")}>
              <ClipboardList size={18} />
              學生名冊
            </button>
            <button className="ghost-button" type="button" onClick={() => setSection("intro")}>
              <Languages size={18} />
              中文自我介紹
            </button>
            <button className="ghost-button" type="button" onClick={() => setSection("checkin")}>
              <QrCode size={18} />
              面試報到
            </button>
            <button className="ghost-button" type="button" onClick={() => setSection("ai")}>
              <Bot size={18} />
              AI 輔助
            </button>
          </section>

          {isAdmin && (
            <section className="teacher-overview-grid">
              <button className={teacherFilter === "all" ? "teacher-chip active" : "teacher-chip"} type="button" onClick={() => setTeacherFilter("all")}>
                <strong>全部老師</strong>
                <span>{loading ? "讀取中" : `${totalManagedStudentCount} 位學生`}</span>
              </button>
              {teacherSummaries.map(({ teacher: item, count, courseCount }) => (
                <button className={teacherFilter === item.id ? "teacher-chip active" : "teacher-chip"} type="button" key={item.id} onClick={() => setTeacherFilter(item.id)}>
                  <strong>{item.name}</strong>
                  <span>{courseCount} 門課 / {count} 位學生</span>
                </button>
              ))}
            </section>
          )}
        </>
      )}

      {section !== "overview" && section !== "students" && (
        <section className="interview-layout">
          <form className="panel form-panel" onSubmit={handleSubmit}>
            <div className="form-section-title">
              {section === "checkin" ? <QrCode size={20} /> : section === "ai" ? <Bot size={20} /> : <Languages size={20} />}
              <strong>{section === "checkin" ? "建立面試報到資料" : section === "ai" ? "可使用的 AI 輔助功能" : "中文自我介紹資料"}</strong>
            </div>

            {isAdmin && (
              <label>
                指派老師
                <select value={form.assignedTeacherId} onChange={(event) => updateField("assignedTeacherId", event.target.value)}>
                  <option value="">不指定老師</option>
                  {teachers.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
            )}

            <label>
              課程 / 班級
              <select value={form.courseId} onChange={(event) => updateField("courseId", event.target.value)}>
                <option value="">不指定課程</option>
                {courses.filter((course) => !isDefaultCourse(course)).map((course) => (
                  <option key={course.id} value={course.id}>{course.name} - {course.classroom}</option>
                ))}
              </select>
            </label>

            <div className="two-column-fields">
              <label>
                學生姓名
                <input value={form.studentName} onChange={(event) => updateField("studentName", event.target.value)} required />
              </label>
              <label>
                國家
                <input value={form.country} onChange={(event) => updateField("country", event.target.value)} required />
              </label>
            </div>

            <div className="two-column-fields">
              <label>
                申請科系
                <input value={form.targetDepartment} onChange={(event) => updateField("targetDepartment", event.target.value)} required />
              </label>
              <label>
                中文程度
                <select value={form.chineseLevel} onChange={(event) => updateField("chineseLevel", event.target.value)}>
                  <option value="零基礎">零基礎</option>
                  <option value="初級">初級</option>
                  <option value="中級">中級</option>
                  <option value="可面試溝通">可面試溝通</option>
                </select>
              </label>
            </div>

            <label>
              申請動機 / 自介重點
              <textarea value={form.motivation} onChange={(event) => updateField("motivation", event.target.value)} />
            </label>

            <div className="two-column-fields">
              <label>
                母語 / 輔助語言
                <select value={form.nativeLanguage} onChange={(event) => updateField("nativeLanguage", event.target.value)}>
                  {languageOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                通訊軟體
                <select value={form.contactPlatform} onChange={(event) => updateField("contactPlatform", event.target.value)}>
                  {platformOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>

            <div className="two-column-fields">
              <label>
                通訊帳號
                <input value={form.contactAccount} onChange={(event) => updateField("contactAccount", event.target.value)} />
              </label>
              <label>
                護照末四碼
                <input value={form.passportLast4} maxLength={4} onChange={(event) => updateField("passportLast4", event.target.value.toUpperCase())} />
              </label>
            </div>

            <div className="two-column-fields">
              <label>
                面試日期
                <input type="date" value={form.interviewDate} onChange={(event) => updateField("interviewDate", event.target.value)} />
              </label>
              <label>
                預計抵台日
                <input type="date" value={form.taiwanArrivalDate} onChange={(event) => updateField("taiwanArrivalDate", event.target.value)} />
              </label>
            </div>

            <div className="button-row">
              <button className="ghost-button" type="button" onClick={runExternalAiIntro}>
                <Languages size={18} />
                產生中文自介
              </button>
              <button className="ghost-button" type="button" onClick={runExternalAiTranslation}>
                <Bot size={18} />
                產生雙語稿
              </button>
              <button className="ghost-button" type="button" onClick={runExternalAiSummary}>
                <ClipboardList size={18} />
                產生摘要題目
              </button>
              <button className="ghost-button" type="button" onClick={generateCode}>
                <QrCode size={18} />
                產生報到碼
              </button>
            </div>

            <button className="primary-button" type="submit" disabled={saving}>
              <CalendarCheck size={18} />
              {saving ? "儲存中" : "儲存可用功能資料"}
            </button>
          </form>

          <section className="panel prep-output">
            <div className="form-section-title">
              <UserCheck size={20} />
              <strong>即時產生結果</strong>
            </div>
            <article className="intro-card">
              <span>中文自我介紹</span>
              <p>{activeIntro}</p>
            </article>
            {translation && (
              <article className="intro-card">
                <span>雙語輔助稿</span>
                <p>{translation}</p>
              </article>
            )}
            {summary && (
              <article className="intro-card">
                <span>面試官摘要</span>
                <p>{summary}</p>
              </article>
            )}
            {questions && (
              <article className="intro-card">
                <span>AI 練習題</span>
                <p>{questions}</p>
              </article>
            )}
            <article className="qr-checkin-card">
              <div>
                <QrCode aria-hidden="true" />
                <strong>面試報到碼</strong>
                <span>{form.interviewDate || "尚未設定面試日期"}</span>
              </div>
              <code>{checkinCode || "按「產生報到碼」後顯示"}</code>
            </article>
          </section>
        </section>
      )}

      {section !== "overview" && (
        <section className="panel filters interview-records-panel">
          <div className="form-section-title">
            <ClipboardList size={20} />
            <strong>{section === "students" ? "學生名冊搜尋" : "面試資料搜尋"}</strong>
          </div>
          <label>
            老師
            <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}>
              <option value="all">全部老師</option>
              {teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            學校
            <select
              value={schoolFilter}
              onChange={(event) => {
                setSchoolFilter(event.target.value);
                setCourseFilter("all");
              }}
              disabled={!isAdmin && Boolean(teacher.school_id)}
            >
              <option value="all">全部學校</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
          </label>
          <label>
            課程
            <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
              <option value="all">全部課程</option>
              {scopedCourses.map((course) => <option key={course.id} value={course.id}>{course.name} - {course.classroom}</option>)}
            </select>
          </label>
          <label>
            班級
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="all">全部班級</option>
              {classOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            年級
            <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}>
              <option value="all">全部年級</option>
              {gradeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            搜尋
            <div className="search-box">
              <Search size={18} />
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={section === "students" ? "姓名、學號、班級、LINE ID" : "姓名、國家、科系、報到碼"} />
            </div>
          </label>
          <button className="ghost-button" type="button" onClick={loadRecords}>
            {loading ? <RefreshCw className="spin" size={18} /> : <RefreshCw size={18} />}
            搜尋
          </button>
        </section>
      )}

      {message && <p className="message">{message}</p>}

      {section !== "overview" && (
        <section className="records">
          {section === "students" && visibleRosterStudents.map((student) => (
            <article className="record interview-record" key={student.id}>
              <div className="record-main">
                <strong>{student.name}</strong>
                <span>{student.student_no} - {student.class_name || "未分班"}</span>
                <small>{student.line_user_id.startsWith("pending:") ? "尚未綁定 LINE" : "已綁定 LINE"}</small>
              </div>
              <div className="record-actions">
                <span className="badge">{student.school_id ? "有學校資料" : "未分學校"}</span>
              </div>
            </article>
          ))}

          {section !== "students" && visibleRecords.map((record) => (
            <article className="record interview-record" key={record.id}>
              <div className="record-main">
                <strong>{record.student_name}</strong>
                <span>{record.country} - {record.target_department}</span>
                <small>{schoolNameById.get(record.school_id ?? "") ?? "未分學校"} / {record.courses?.name ?? "未指定課程"} - {record.courses?.classroom ?? "未指定班級"}</small>
                <time>面試：{record.interview_date || "未設定"} / 抵台：{record.taiwan_arrival_date || "未設定"}</time>
                <small>中文程度：{record.chinese_level} / 狀態：{record.readiness_status}</small>
                {record.intro_script && <p>{record.intro_script}</p>}
              </div>
              <div className="record-actions">
                <span className="badge">{record.checkin_code}</span>
                <select value={record.readiness_status} onChange={(event) => updateRecordStatus(record.id, event.target.value)}>
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <CheckCircle2 size={20} />
              </div>
            </article>
          ))}

          {!loading && section === "students" && visibleRosterStudents.length === 0 && <p className="empty">目前沒有符合條件的學生。</p>}
          {!loading && section !== "students" && visibleRecords.length === 0 && <p className="empty">目前沒有符合條件的面試資料。</p>}
        </section>
      )}
    </main>
  );
}
