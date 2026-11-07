import { AlertCircle, ArrowLeft, Bot, Building2, ClipboardCheck, ClipboardList, Globe2, GraduationCap, Languages, Loader2, QrCode, School, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InternationalInterviewPrep } from "./components/InternationalInterviewPrep";
import { AdBanner } from "./components/AdBanner";
import { AdminAnalytics } from "./components/AdminAnalytics";
import { AgencyManagement } from "./components/AgencyManagement";
import { FutureStudentPrep } from "./components/FutureStudentPrep";
import { NewProgramWorkspace } from "./components/NewProgramWorkspace";
import { AppLanguage, PortalRole, ProgramOnboarding } from "./components/ProgramOnboarding";
import { StudentCheckin } from "./components/StudentCheckin";
import { StudentManagement } from "./components/StudentManagement";
import { StudentRosterSync } from "./components/StudentRosterSync";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { trackUsageEvent } from "./lib/analytics";
import { Course, isSupabaseConfigured, LineProfile, School as SchoolRecord, Student, supabase, Teacher } from "./lib/supabase";

export const DEFAULT_COURSE: Course = {
  id: "__default__",
  school_id: null,
  research_project_id: null,
  course_type: "attendance",
  name: "預設課程",
  classroom: "一般教室",
  teacher_id: null,
  starts_at: null,
  ends_at: null,
  late_after_minutes: 10,
};

const TEACHER_ALLOWLIST: Record<string, string> = {
  Uc9f53d7621af4ade73545db19a24ca39: "林韋成",
  U76bd42767c9727fa59cf48e7dab93549: "系統管理者",
};

type ViewMode = "student" | "dashboard" | "roster" | "students" | "agency" | "interview" | "future" | "new_program";
type EntryMode = "student" | "teacher" | "international" | "future";
type InterviewSection = "overview" | "schools" | "students" | "intro" | "checkin" | "ai" | "future-profile" | "future-intro" | "future-checkin";
type AppRole = "system_admin" | "school_admin" | "teacher" | "student";

const ADMIN_LINE_USER_IDS = new Set(Object.keys(TEACHER_ALLOWLIST));

export function isDefaultCourse(course: Course) {
  return course.id === DEFAULT_COURSE.id;
}

export default function App() {
  const [profile, setProfile] = useState<LineProfile | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [currentSchool, setCurrentSchool] = useState<SchoolRecord | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [interviewSection, setInterviewSection] = useState<InterviewSection>("overview");
  const [portalRole, setPortalRole] = useState<PortalRole | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [openLegacyPrep, setOpenLegacyPrep] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>(() => {
    const saved = window.localStorage.getItem("program-language") as AppLanguage | null;
    return saved === "en" || saved === "id" || saved === "vi" || saved === "zh-TW" ? saved : "zh-TW";
  });

  const isSystemAdmin = Boolean(teacher && ADMIN_LINE_USER_IDS.has(teacher.line_user_id));
  const isSchoolAdmin = Boolean(teacher && teacher.role === "admin" && !isSystemAdmin);
  const isAdmin = Boolean(teacher && (teacher.role === "admin" || isSystemAdmin));
  const isTeacherAccount = Boolean(teacher);
  const isStudentAccount = Boolean(student && !teacher);
  const appRole: AppRole = isSystemAdmin ? "system_admin" : isSchoolAdmin ? "school_admin" : teacher ? "teacher" : "student";
  const teacherCourses = useMemo(() => {
    if (!teacher) return courses;
    if (isAdmin) return courses;
    return courses.filter((course) => course.teacher_id === teacher.id);
  }, [courses, isAdmin, teacher]);
  const visibleCourses = useMemo(() => {
    const courseSource = teacher ? teacherCourses : courses;
    return courseSource.length > 0 ? courseSource : [DEFAULT_COURSE];
  }, [courses, teacher, teacherCourses]);

  async function loadCourses(nextTeacher: Teacher | null, nextStudent: Student | null = null) {
    const nextTeacherIsGlobalAdmin = Boolean(nextTeacher && ADMIN_LINE_USER_IDS.has(nextTeacher.line_user_id));
    let courseQuery = supabase
      .from("courses")
      .select("*")
      .eq("is_active", true)
      .order("starts_at", { ascending: true, nullsFirst: false });

    if (nextTeacher?.school_id && !nextTeacherIsGlobalAdmin) {
      courseQuery = courseQuery.eq("school_id", nextTeacher.school_id);
    } else if (!nextTeacher && nextStudent?.school_id) {
      courseQuery = courseQuery.eq("school_id", nextStudent.school_id);
    }

    const { data: courseData } = await courseQuery;
    setCourses((courseData as Course[] | null) ?? []);
  }

  useEffect(() => {
    if (!portalRole || !onboardingComplete) return;
    async function boot() {
      try {
        if (!isSupabaseConfigured) {
          setError("尚未設定 Supabase，請確認 Vercel 環境變數。");
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const authenticatedUser = sessionData.session?.user;
        if (!authenticatedUser) {
          setError("請先使用 Google 或 Email 完成帳號驗證。");
          return;
        }
        const nextProfile: LineProfile = {
          userId: authenticatedUser.id,
          displayName: authenticatedUser.user_metadata.full_name || authenticatedUser.user_metadata.name || authenticatedUser.email || "使用者",
          pictureUrl: authenticatedUser.user_metadata.avatar_url,
        };
        setProfile(nextProfile);
        void trackUsageEvent(nextProfile, "startup").catch(() => undefined);

        const lineIdentity = authenticatedUser.identities?.find(
          (identity) => identity.provider === "custom:line-oauth2" || identity.provider === "custom:line",
        );
        const lineUserId = (lineIdentity?.identity_data as { sub?: string } | undefined)?.sub ?? "";
        const [teacherByEmail, teacherByLine, studentByLine, programProfile] = await Promise.all([
          authenticatedUser.email
            ? supabase.from("teachers").select("*").eq("email", authenticatedUser.email).eq("is_active", true).maybeSingle()
            : Promise.resolve({ data: null }),
          lineUserId
            ? supabase.from("teachers").select("*").eq("line_user_id", lineUserId).eq("is_active", true).maybeSingle()
            : Promise.resolve({ data: null }),
          lineUserId
            ? supabase.from("students").select("*").eq("line_user_id", lineUserId).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase.from("program_user_profiles").select("requested_role").eq("user_id", authenticatedUser.id).maybeSingle(),
        ]);

        const allowlistedName = TEACHER_ALLOWLIST[nextProfile.userId];
        const allowlistedTeacher: Teacher | null = allowlistedName
          ? {
              id: "00000000-0000-0000-0000-000000000000",
              school_id: null,
              line_user_id: nextProfile.userId,
              name: allowlistedName,
              email: null,
              role: "admin",
              is_active: true,
          }
          : null;

        const nextTeacher = (teacherByEmail.data as Teacher | null) ?? (teacherByLine.data as Teacher | null) ?? allowlistedTeacher;
        const nextStudent = (studentByLine.data as Student | null) ?? null;
        const storedRole = (programProfile.data as { requested_role?: PortalRole } | null)?.requested_role;
        // A role picked immediately before OAuth is the user's current intent.
        // Previously the stale profile default (usually "student") won here and
        // sent school/company/agency users into the student questionnaire.
        // A recognised teacher remains school unconditionally; protected data is
        // still enforced by Supabase RLS, never by this client-side selection.
        const resolvedPortalRole: PortalRole = nextTeacher ? "school" : portalRole ?? storedRole ?? "student";
        if (!nextTeacher && programProfile.data && storedRole !== resolvedPortalRole) {
          void supabase
            .from("program_user_profiles")
            .update({ requested_role: resolvedPortalRole, updated_at: new Date().toISOString() })
            .eq("user_id", authenticatedUser.id);
        }
        setPortalRole(resolvedPortalRole);
        const schoolId = nextTeacher?.school_id ?? nextStudent?.school_id ?? null;

        setTeacher(nextTeacher);
        setStudent(nextStudent);

        if (schoolId) {
          const { data: schoolData } = await supabase
            .from("schools")
            .select("*")
            .eq("id", schoolId)
            .maybeSingle();
          setCurrentSchool((schoolData as SchoolRecord | null) ?? null);
        }

        if (nextTeacher) {
          setEntryMode("teacher");
          if (ADMIN_LINE_USER_IDS.has(nextTeacher.line_user_id) || nextTeacher.role === "admin") {
            setViewMode("new_program");
          }
        } else if (resolvedPortalRole === "student" || nextStudent) {
          setEntryMode("future");
          setViewMode("future");
        } else if (resolvedPortalRole === "agency" || resolvedPortalRole === "company") {
          setEntryMode("future");
          setViewMode("future");
        } else if (nextStudent) {
          setEntryMode("student");
          setViewMode("student");
        } else {
          setEntryMode("student");
          setViewMode("student");
        }

        await loadCourses(nextTeacher, nextStudent);
      } catch (bootError) {
        setError(bootError instanceof Error ? bootError.message : "載入系統失敗，請稍後再試。");
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    void boot();
  }, [onboardingComplete, portalRole]);

  useEffect(() => {
    const resumeAuthenticatedPortal = () => {
      const pendingRole = window.localStorage.getItem("program-pending-role") as PortalRole | null;
      setPortalRole(pendingRole ?? "student");
      setOnboardingComplete(true);
    };
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) resumeAuthenticatedPortal();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) resumeAuthenticatedPortal();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (loading) return;
    if (teacher && !entryMode && !viewMode) setEntryMode("teacher");
    if (!teacher && student && (!entryMode || entryMode !== "student")) {
      setEntryMode("student");
      setViewMode("student");
    }
  }, [entryMode, loading, student, teacher, viewMode]);

  const schoolName = currentSchool?.name ?? (teacher?.school_id || student?.school_id ? "你的學校" : "");
  const roleLabelByRole: Record<AppRole, string> = {
    system_admin: "系統管理者",
    school_admin: "校方管理者",
    teacher: "老師",
    student: "學生",
  };
  const landingTitleByRole: Record<AppRole, string> = {
    system_admin: "系統管理者工作台",
    school_admin: "校方工作台",
    teacher: "老師工作台",
    student: "學生簽到",
  };
  const actorName = teacher?.name || student?.name || profile?.displayName || roleLabelByRole[appRole];
  const identityText = schoolName
    ? `你是 ${schoolName} 的 ${actorName}，身分為${roleLabelByRole[appRole]}。`
    : `你是 ${actorName}，身分為${roleLabelByRole[appRole]}。`;
  const landingText = `${identityText} 即將導入你的${landingTitleByRole[appRole]}。`;

  if (!onboardingComplete) {
    return <ProgramOnboarding language={language} onLanguageChange={(nextLanguage) => { window.localStorage.setItem("program-language", nextLanguage); setLanguage(nextLanguage); }} onComplete={(role) => { window.localStorage.setItem("program-pending-role", role); window.localStorage.setItem("new-program-guide-step", "0"); setPortalRole(role); setOnboardingComplete(true); }} />;
  }

  // The new-program portal owns its role-specific workflow.  Do not send an
  // OAuth user back into the older LINE attendance screens after sign-in.
  if (portalRole) {
    if (openLegacyPrep && profile) {
      return <FutureStudentPrep profile={profile} initialSection="future-profile" />;
    }
    return <ProgramOnboarding language={language} onLanguageChange={(nextLanguage) => { window.localStorage.setItem("program-language", nextLanguage); setLanguage(nextLanguage); }} authenticatedRole={portalRole} onOpenLegacyPrep={() => setOpenLegacyPrep(true)} onComplete={(role) => { window.localStorage.setItem("program-pending-role", role); setPortalRole(role); setOnboardingComplete(true); }} />;
  }

  if (loading) {
    return (
      <main className="center-screen">
        <Loader2 className="spin" />
        <p>載入中</p>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="center-screen error-screen">
        <AlertCircle />
        <h1>無法開啟系統</h1>
        <p>{error || "請重新登入帳號。"}</p>
      </main>
    );
  }

  if (!entryMode && !viewMode) {
    return (
      <main className="screen">
        <section className="panel hero-panel">
          <div>
            <img className="school-logo" src="/stust-logo-en.png" alt="Southern Taiwan University of Science and Technology Logo" />
            <p className="eyebrow">LINE 教室系統</p>
            <h1>選擇入口</h1>
          </div>
          <ShieldCheck aria-hidden="true" />
        </section>

        <section className="mode-choice-grid">
          {!isTeacherAccount && !isStudentAccount && (
            <button className="mode-choice" type="button" onClick={() => setViewMode("student")}>
              <UserRound aria-hidden="true" />
              <strong>學生</strong>
              <span>課堂出席簽到、拍照佐證、送出時間與 LINE 身分。</span>
            </button>
          )}
          {!isStudentAccount && (
            <button className="mode-choice" type="button" onClick={() => setEntryMode("teacher")}>
              <ClipboardCheck aria-hidden="true" />
              <strong>老師</strong>
              <span>協助點名、匯入名單、查看出席紀錄與學生狀態。</span>
            </button>
          )}
          {isAdmin && !isStudentAccount && (
            <button className="mode-choice" type="button" onClick={() => setEntryMode("international")}>
              <Globe2 aria-hidden="true" />
              <strong>國際處</strong>
              <span>跨老師管理國外學生、面試、自介與報到。</span>
            </button>
          )}
          {!isTeacherAccount && !isStudentAccount && (
            <button className="mode-choice" type="button" onClick={() => setEntryMode("future")}>
              <GraduationCap aria-hidden="true" />
              <strong>未來學生</strong>
              <span>準備中文自我介紹、面試資訊與入學報到資料。</span>
            </button>
          )}
        </section>

        <AdBanner profile={profile} entryMode="home" />
      </main>
    );
  }

  if (entryMode === "teacher" && !teacher) {
    return (
      <main className="screen">
        <button className="back-button ghost-button" type="button" onClick={() => setEntryMode(null)}>
          <ArrowLeft size={18} />
          回到上一步
        </button>
        <section className="panel hero-panel">
          <div>
            <p className="eyebrow">老師入口</p>
            <h1>目前沒有老師權限</h1>
          </div>
          <ShieldCheck aria-hidden="true" />
        </section>
        <p className="message">請使用已授權的老師或教務處 LINE 帳號開啟。</p>
      </main>
    );
  }

  if (entryMode === "teacher" && teacher && !viewMode) {
    return (
      <main className="screen">
        {!isTeacherAccount && (
          <button className="back-button ghost-button" type="button" onClick={() => setEntryMode(null)}>
            <ArrowLeft size={18} />
            回到上一步
          </button>
        )}

        <section className="panel hero-panel">
          <div>
            <img className="school-logo" src="/stust-logo-en.png" alt="Southern Taiwan University of Science and Technology Logo" />
            <p className="eyebrow">{roleLabelByRole[appRole]}</p>
            <h1>{landingTitleByRole[appRole]}</h1>
            <p className="subtle">{landingText}</p>
          </div>
          <School aria-hidden="true" />
        </section>

        <section className="mode-choice-grid">
          {(appRole === "system_admin" || appRole === "school_admin") && (
            <button className="mode-choice" type="button" onClick={() => setViewMode("student")}>
              <UserRound aria-hidden="true" />
              <strong>學生</strong>
              <span>協助學生完成課堂簽到；學生或第一次登入者只會看到這個功能。</span>
            </button>
          )}
          {(appRole === "system_admin" || appRole === "school_admin" || appRole === "teacher") && (
            <button className="mode-choice" type="button" onClick={() => setViewMode("dashboard")}>
              <UsersRound aria-hidden="true" />
              <strong>老師</strong>
              <span>{schoolName && !isSystemAdmin ? `只顯示 ${schoolName} 與你負責課程的出席、學生與請假狀態。` : "查看老師課程、出席紀錄、照片、定位與審核狀態。"}</span>
            </button>
          )}
          {appRole === "teacher" && (
            <button className="mode-choice" type="button" onClick={() => setViewMode("student")}>
            <UserRound aria-hidden="true" />
            <strong>協助學生點名</strong>
            <span>老師現場代學生完成簽到，不會開放一般學生功能選單。</span>
            </button>
          )}
          {(appRole === "system_admin" || appRole === "school_admin") && (
            <button className="mode-choice" type="button" onClick={() => setViewMode("students")}>
              <Building2 aria-hidden="true" />
              <strong>校方</strong>
              <span>{schoolName && !isSystemAdmin ? `管理 ${schoolName} 的學生名單、匯入、國際學生與代辦分流。` : "管理學生名單、校方資料、國際學生與代辦分流。"}</span>
            </button>
          )}
          {(appRole === "system_admin" || appRole === "school_admin") && (
            <button className="mode-choice" type="button" onClick={() => setViewMode("new_program")}>
              <Globe2 aria-hidden="true" />
              <strong>新型專班（英／印／越）</strong>
              <span>直接處理專班、國際學生、代辦分流、面試、錄取與報到。</span>
            </button>
          )}
        </section>
        <AdminAnalytics isAdmin={isAdmin} />
      </main>
    );
  }

  if (entryMode === "international" && (!teacher || !isAdmin)) {
    return (
      <main className="screen">
        <button className="back-button ghost-button" type="button" onClick={() => setEntryMode(null)}>
          <ArrowLeft size={18} />
          回到上一步
        </button>
        <section className="panel hero-panel">
          <div>
            <img className="school-logo" src="/stust-logo-en.png" alt="Southern Taiwan University of Science and Technology Logo" />
            <p className="eyebrow">國際處入口</p>
            <h1>目前沒有國際處權限</h1>
          </div>
          <ShieldCheck aria-hidden="true" />
        </section>
      </main>
    );
  }

  if ((entryMode === "international" || entryMode === "future") && !viewMode) {
    const isFuture = entryMode === "future";
    const openInterview = (section: InterviewSection) => {
      setInterviewSection(section);
      setViewMode(isFuture ? "future" : "interview");
    };
    return (
      <main className="screen">
        <button className="back-button ghost-button" type="button" onClick={() => setEntryMode(null)}>
          <ArrowLeft size={18} />
          回到上一步
        </button>

        <section className="panel hero-panel">
          <div>
            <img className="school-logo" src="/stust-logo-en.png" alt="Southern Taiwan University of Science and Technology Logo" />
            <p className="eyebrow">{isFuture ? "未來學生入口" : "國際處入口"}</p>
            <h1>{isFuture ? "面試與入學準備" : "國外學生管理工作台"}</h1>
          </div>
          <Globe2 aria-hidden="true" />
        </section>

        {!isFuture ? (
          <section className="workflow-grid">
            <button className="workflow-card" type="button" onClick={() => openInterview("schools")}>
              <Building2 aria-hidden="true" />
              <strong>學校與專班</strong>
            </button>
            <button className="workflow-card" type="button" onClick={() => openInterview("students")}>
              <ClipboardList aria-hidden="true" />
              <strong>國外學生名冊</strong>
            </button>
            <button className="workflow-card" type="button" onClick={() => openInterview("intro")}>
              <Languages aria-hidden="true" />
              <strong>面試前中文自我介紹</strong>
            </button>
            <button className="workflow-card" type="button" onClick={() => openInterview("checkin")}>
              <QrCode aria-hidden="true" />
              <strong>面試當日報到</strong>
            </button>
            <button className="workflow-card" type="button" onClick={() => openInterview("ai")}>
              <Bot aria-hidden="true" />
              <strong>AI 協作</strong>
            </button>
            <button className="workflow-card" type="button" onClick={() => setEntryMode("future")}>
              <GraduationCap aria-hidden="true" />
              <strong>串接未來學生</strong>
            </button>
          </section>
        ) : (
          <section className="workflow-grid">
            <button className="workflow-card" type="button" onClick={() => openInterview("future-profile")}>
              <UserRound aria-hidden="true" />
              <strong>個人基本資料</strong>
            </button>
            <button className="workflow-card" type="button" onClick={() => openInterview("future-intro")}>
              <Languages aria-hidden="true" />
              <strong>中文自我介紹</strong>
            </button>
            <button className="workflow-card" type="button" onClick={() => openInterview("future-checkin")}>
              <ClipboardCheck aria-hidden="true" />
              <strong>面試前資料</strong>
            </button>
            <button className="workflow-card" type="button" onClick={() => openInterview("future-checkin")}>
              <QrCode aria-hidden="true" />
              <strong>面試當日報到</strong>
            </button>
          </section>
        )}

        {!isFuture && <button className="primary-button wide-action" type="button" onClick={() => openInterview("overview")}>
          進入國外學生管理
        </button>}
      </main>
    );
  }

  if (viewMode) {
    return (
      <>
        <label className="global-language-switch" aria-label="切換語言">
          <Languages size={16} />
          <select value={language} onChange={(event) => { const nextLanguage = event.target.value as AppLanguage; window.localStorage.setItem("program-language", nextLanguage); setLanguage(nextLanguage); }}>
            <option value="zh-TW">繁體中文</option>
            <option value="en">English</option>
            <option value="id">Bahasa Indonesia</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </label>
        {entryMode !== "student" && (
          <div className="screen mode-switch">
            <button className="ghost-button" type="button" onClick={() => setViewMode(null)}>
              <ArrowLeft size={18} />
              回到上一步
            </button>
            {entryMode === "teacher" && (
              <>
                <button className={viewMode === "student" ? "primary-button" : "ghost-button"} type="button" onClick={() => setViewMode("student")}>
                  <UserRound size={18} />
                  {appRole === "teacher" ? "協助點名" : "學生"}
                </button>
                <button className={viewMode === "dashboard" ? "primary-button" : "ghost-button"} type="button" onClick={() => setViewMode("dashboard")}>
                  <ClipboardCheck size={18} />
                  老師
                </button>
                {isAdmin && <button className={viewMode === "roster" ? "primary-button" : "ghost-button"} type="button" onClick={() => setViewMode("roster")}>
                  <UsersRound size={18} />
                  名單同步
                </button>}
                {isAdmin && <button className={viewMode === "students" ? "primary-button" : "ghost-button"} type="button" onClick={() => setViewMode("students")}>
                  <GraduationCap size={18} />
                  校方
                </button>}
                {isAdmin && <button className={viewMode === "interview" ? "primary-button" : "ghost-button"} type="button" onClick={() => {
                  setInterviewSection("overview");
                  setViewMode("interview");
                }}>
                  <Globe2 size={18} />
                  國際學生
                </button>}
                {isAdmin && <button className={viewMode === "agency" ? "primary-button" : "ghost-button"} type="button" onClick={() => setViewMode("agency")}>
                  <Building2 size={18} />
                  代辦分流
                </button>}
                {isAdmin && <button className={viewMode === "new_program" ? "primary-button" : "ghost-button"} type="button" onClick={() => setViewMode("new_program")}>
                  <Globe2 size={18} />
                  新型專班
                </button>}
              </>
            )}
          </div>
        )}
        {viewMode === "new_program" && teacher && isAdmin ? (
          <NewProgramWorkspace
            onProgramSetup={() => { setEntryMode("international"); setInterviewSection("schools"); setViewMode("interview"); }}
            onApplicantReview={() => { setEntryMode("international"); setInterviewSection("students"); setViewMode("interview"); }}
            onAidReview={() => { setEntryMode("international"); setInterviewSection("overview"); setViewMode("interview"); }}
            onInterviewSchedule={() => { setEntryMode("international"); setInterviewSection("checkin"); setViewMode("interview"); }}
            onAgencyReferral={() => { setEntryMode("teacher"); setViewMode("agency"); }}
            onAdmissionFollowup={() => { setEntryMode("international"); setInterviewSection("overview"); setViewMode("interview"); }}
            onAttendance={() => { setEntryMode("teacher"); setViewMode("dashboard"); }}
          />
        ) : viewMode === "future" ? (
          <FutureStudentPrep profile={profile} initialSection={interviewSection} />
        ) : viewMode === "dashboard" && teacher ? (
          <TeacherDashboard profile={profile} teacher={teacher} courses={visibleCourses} isAdmin={isAdmin} />
        ) : viewMode === "roster" && teacher && isAdmin ? (
          <StudentRosterSync profile={profile} teacher={teacher} isAdmin={isAdmin} onCoursesChanged={() => loadCourses(teacher, student)} />
        ) : viewMode === "students" && teacher ? (
          <StudentManagement profile={profile} teacher={teacher} courses={visibleCourses} isAdmin={isAdmin} />
        ) : viewMode === "agency" && teacher && isAdmin ? (
          <AgencyManagement profile={profile} teacher={teacher} isAdmin={isAdmin} />
        ) : viewMode === "interview" && teacher ? (
          <InternationalInterviewPrep
            profile={profile}
            teacher={teacher}
            courses={visibleCourses}
            isAdmin={isAdmin}
            audience={entryMode === "future" ? "future" : "international"}
            initialSection={interviewSection}
          />
        ) : (
          <StudentCheckin profile={profile} courses={visibleCourses} />
        )}
      </>
    );
  }

  return <StudentCheckin profile={profile} courses={visibleCourses} />;
}
