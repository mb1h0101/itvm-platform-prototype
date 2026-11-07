import { AlertTriangle, ArrowLeft, Clock, RefreshCw, Search, UserRound, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Checkin, Course, LineProfile, School, Student, supabase, Teacher } from "../lib/supabase";
import { isDefaultCourse } from "../App";
import { getAcademicTerm, getTermLabel, mergeRequiredSchools } from "../lib/academic";

type Props = {
  profile: LineProfile;
  teacher: Teacher;
  courses: Course[];
  isAdmin: boolean;
  onBack?: () => void;
};

type StudentCheckin = Checkin & {
  courses?: Pick<Course, "name" | "classroom" | "starts_at" | "ends_at"> | null;
};

type StudentSummary = {
  student: Student;
  total: number;
  present: number;
  questioned: number;
  excused: number;
  leaveHours: number;
};

type WarningGroup = {
  id: string;
  label: string;
  detail: string;
  students: StudentSummary[];
};

const statusLabels = {
  present: "已完成",
  late: "逾時",
  duplicate: "重複",
  questioned: "待確認",
  excused: "保留/免補",
};

function getCourseHours(row: StudentCheckin) {
  const start = row.courses?.starts_at ? new Date(row.courses.starts_at).getTime() : null;
  const end = row.courses?.ends_at ? new Date(row.courses.ends_at).getTime() : null;
  if (start && end && end > start) return Math.max(0.5, (end - start) / 1000 / 60 / 60);
  return 1;
}

export function StudentManagement({ profile, teacher, courses, isAdmin, onBack }: Props) {
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [checkins, setCheckins] = useState<StudentCheckin[]>([]);
  const [keyword, setKeyword] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState(teacher.school_id ?? "all");
  const [selectedClassName, setSelectedClassName] = useState("all");
  const [selectedTermKey, setSelectedTermKey] = useState("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedWarningId, setSelectedWarningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const managedCourses = useMemo(() => courses.filter((course) => !isDefaultCourse(course)), [courses]);
  const managedCourseIds = useMemo(() => managedCourses.map((course) => course.id), [managedCourses]);
  const managedClassNames = useMemo(
    () => new Set(managedCourses.flatMap((course) => [course.classroom, course.name]).filter(Boolean)),
    [managedCourses],
  );

  const schoolScopedCheckins = useMemo(() => {
    return checkins.filter((row) => {
      if (!isAdmin && (!row.course_id || !managedCourseIds.includes(row.course_id))) return false;
      if (selectedSchoolId !== "all" && (row.school_id ?? "none") !== selectedSchoolId) return false;
      return true;
    });
  }, [checkins, isAdmin, managedCourseIds, selectedSchoolId]);

  const schoolScopedStudents = useMemo(() => {
    return students.filter((student) => {
      if (!isAdmin) {
        const isSameSchool = !teacher.school_id || (student.school_id ?? null) === teacher.school_id;
        const isManagedClass = Boolean(student.class_name && managedClassNames.has(student.class_name));
        const hasManagedCheckin = checkins.some(
          (row) =>
            (row.student_id === student.id || row.student_no === student.student_no) &&
            Boolean(row.course_id && managedCourseIds.includes(row.course_id)),
        );
        if (!isSameSchool || (!isManagedClass && !hasManagedCheckin)) return false;
      }
      if (selectedSchoolId !== "all" && (student.school_id ?? "none") !== selectedSchoolId) return false;
      return true;
    });
  }, [checkins, isAdmin, managedClassNames, managedCourseIds, selectedSchoolId, students, teacher.school_id]);

  const visibleCheckins = useMemo(() => {
    return schoolScopedCheckins.filter((row) => {
      if (selectedClassName !== "all" && (row.class_name || row.classroom || "未填班級") !== selectedClassName) return false;
      if (selectedTermKey !== "all") {
        const term = getAcademicTerm(row.courses?.starts_at ?? row.checked_in_at);
        if (term?.key !== selectedTermKey) return false;
      }
      return true;
    });
  }, [schoolScopedCheckins, selectedClassName, selectedTermKey]);

  const visibleStudents = useMemo(() => {
    return schoolScopedStudents.filter((student) => {
      if (selectedClassName !== "all" && (student.class_name || "未填班級") !== selectedClassName) return false;
      return true;
    });
  }, [schoolScopedStudents, selectedClassName]);

  const classOptions = useMemo(() => {
    const classes = new Set<string>();
    schoolScopedStudents.forEach((student) => classes.add(student.class_name || "未填班級"));
    schoolScopedCheckins.forEach((row) => classes.add(row.class_name || row.classroom || "未填班級"));
    return Array.from(classes).sort((a, b) => a.localeCompare(b, "zh-TW"));
  }, [schoolScopedCheckins, schoolScopedStudents]);

  const termOptions = useMemo(() => {
    const terms = new Map<string, string>();
    schoolScopedCheckins.forEach((row) => {
      const term = getAcademicTerm(row.courses?.starts_at ?? row.checked_in_at);
      if (term) terms.set(term.key, term.label);
    });
    return Array.from(terms.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [schoolScopedCheckins]);

  const allStudentSummaries = useMemo<StudentSummary[]>(() => {
    return visibleStudents.map((student) => {
        const rows = visibleCheckins.filter((row) => row.student_id === student.id || row.student_no === student.student_no);
        const excusedRows = rows.filter((row) => row.status === "excused");
        const leaveHours = excusedRows.reduce((total, row) => total + getCourseHours(row), 0);
        return {
          student,
          total: rows.length,
          present: rows.filter((row) => row.status === "present").length,
          questioned: rows.filter((row) => row.status === "questioned").length,
          excused: excusedRows.length,
          leaveHours,
        };
      });
  }, [visibleStudents, visibleCheckins]);

  const studentSummaries = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    if (!key) return allStudentSummaries;
    return allStudentSummaries.filter(({ student }) =>
      [student.student_no, student.name, student.class_name ?? "", student.line_user_id].join(" ").toLowerCase().includes(key),
    );
  }, [allStudentSummaries, keyword]);

  const warningGroups = useMemo<WarningGroup[]>(() => {
    return [
      {
        id: "not-reported",
        label: "未報到",
        detail: "沒有任何點名紀錄",
        students: allStudentSummaries.filter((item) => item.total === 0),
      },
      {
        id: "leave-low",
        label: "請假 0.5-2 小時",
        detail: "已有請假/免補紀錄",
        students: allStudentSummaries.filter((item) => item.leaveHours > 0 && item.leaveHours < 2),
      },
      {
        id: "leave-mid",
        label: "請假 2-4 小時",
        detail: "請假時數偏高",
        students: allStudentSummaries.filter((item) => item.leaveHours >= 2 && item.leaveHours < 4),
      },
      {
        id: "leave-high",
        label: "請假 4 小時以上",
        detail: "優先關注",
        students: allStudentSummaries.filter((item) => item.leaveHours >= 4),
      },
    ];
  }, [allStudentSummaries]);

  const selectedSummary = studentSummaries.find((item) => item.student.id === selectedStudentId) ?? null;
  const selectedWarningGroup = warningGroups.find((group) => group.id === selectedWarningId) ?? null;
  const selectedRows = selectedSummary
    ? visibleCheckins
        .filter((row) => row.student_id === selectedSummary.student.id || row.student_no === selectedSummary.student.student_no)
        .sort((a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime())
    : [];

  async function loadStudents() {
    setLoading(true);
    setMessage("");

    let studentQuery = supabase.from("students").select("*").order("class_name", { ascending: true }).order("student_no", { ascending: true });
    if (teacher.school_id) studentQuery = studentQuery.eq("school_id", teacher.school_id);

    let checkinQuery = supabase
      .from("checkins")
      .select("*, courses(name, classroom, starts_at, ends_at)")
      .order("checked_in_at", { ascending: false });
    if (teacher.school_id) checkinQuery = checkinQuery.eq("school_id", teacher.school_id);

    const schoolQuery = supabase.from("schools").select("*").eq("is_active", true).order("name", { ascending: true });
    const [{ data: studentData, error: studentError }, { data: checkinData, error: checkinError }, { data: schoolData }] = await Promise.all([
      studentQuery,
      checkinQuery,
      schoolQuery,
    ]);
    setLoading(false);

    const error = studentError || checkinError;
    if (error) {
      setMessage(error.message);
      return;
    }

    setSchools(mergeRequiredSchools((schoolData ?? []) as School[]));
    setStudents((studentData ?? []) as Student[]);
    setCheckins((checkinData ?? []) as StudentCheckin[]);
  }

  useEffect(() => {
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="screen">
      {onBack && (
        <button className="back-button ghost-button" type="button" onClick={onBack}>
          <ArrowLeft size={18} />
          回到上一步
        </button>
      )}

      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">老師掌握</p>
          <h1>學生名單與請假時數</h1>
          <p className="subtle">{teacher.name || profile.displayName}，可查看每位匯入學生的點名紀錄、請假小時與需確認狀態。</p>
        </div>
        <UsersRound aria-hidden="true" />
      </section>

      <section className="panel filters">
        <label>
          學校
          <select
            value={selectedSchoolId}
            onChange={(event) => {
              setSelectedSchoolId(event.target.value);
              setSelectedClassName("all");
              setSelectedTermKey("all");
            }}
            disabled={!isAdmin && Boolean(teacher.school_id)}
          >
            {isAdmin && <option value="all">全部學校</option>}
            {!teacher.school_id && !isAdmin && <option value="all">未指定學校</option>}
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          班級 / 名單
          <select value={selectedClassName} onChange={(event) => setSelectedClassName(event.target.value)}>
            <option value="all">全部班級</option>
            {classOptions.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
        </label>
        <label>
          學期
          <select value={selectedTermKey} onChange={(event) => setSelectedTermKey(event.target.value)}>
            <option value="all">全部學期</option>
            {termOptions.map((term) => (
              <option key={term.key} value={term.key}>
                {getTermLabel(term.key)}
              </option>
            ))}
          </select>
        </label>
        <label>
          搜尋學生
          <div className="search-box">
            <Search size={18} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="學號、姓名、班級、LINE userId" />
          </div>
        </label>
        <button className="ghost-button" type="button" onClick={loadStudents}>
          {loading ? <RefreshCw className="spin" size={18} /> : <RefreshCw size={18} />}
          重新整理
        </button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="panel leave-warning-panel">
        <div className="form-section-title">
          <AlertTriangle size={20} />
          <strong>請假時數警告</strong>
        </div>
        <section className="leave-warning-grid">
          {warningGroups.map((group) => (
            <button
              className={group.students.length > 0 ? "leave-warning-card active" : "leave-warning-card"}
              type="button"
              key={group.id}
              onClick={() => group.students.length > 0 && setSelectedWarningId(group.id)}
              disabled={group.students.length === 0}
            >
              <span>{group.label}</span>
              <strong>{group.students.length} 人</strong>
              <small>{group.detail}</small>
            </button>
          ))}
        </section>
      </section>

      <section className="records">
        {studentSummaries.map(({ student, total, present, questioned, excused, leaveHours }) => (
          <article className="record student-record" key={student.id}>
            <div className="record-main">
              <div>
                <strong>{student.name}</strong>
                <span>{student.student_no}｜{student.class_name || "未填班級"}</span>
              </div>
              <small>點名 {total} 筆｜已完成 {present}｜待確認 {questioned}｜請假/免補 {excused}</small>
            </div>
            <div className="record-actions">
              <span className="badge">
                <Clock size={14} />
                {leaveHours.toFixed(1)} 小時
              </span>
              <button className="ghost-button" type="button" onClick={() => setSelectedStudentId(student.id)}>
                <UserRound size={18} />
                學生頁面
              </button>
            </div>
          </article>
        ))}
        {!loading && studentSummaries.length === 0 && <p className="empty">目前沒有匯入學生，或沒有符合搜尋的學生。</p>}
      </section>

      {selectedSummary && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setSelectedStudentId(null)}>
          <section className="student-modal panel" onClick={(event) => event.stopPropagation()}>
            <div className="preview-header">
              <div>
                <span>{selectedSummary.student.student_no}｜{selectedSummary.student.class_name || "未填班級"}</span>
                <strong>{selectedSummary.student.name}</strong>
              </div>
              <button className="tiny-button" type="button" onClick={() => setSelectedStudentId(null)}>關閉</button>
            </div>
            <section className="sync-summary">
              <div><span>點名紀錄</span><strong>{selectedSummary.total}</strong></div>
              <div><span>請假/免補</span><strong>{selectedSummary.excused}</strong></div>
              <div><span>請假小時</span><strong>{selectedSummary.leaveHours.toFixed(1)}</strong></div>
            </section>
            <div className="student-history">
              {selectedRows.map((row) => (
                <article className="student-history-item" key={row.id}>
                  <strong>{row.courses?.name ?? "未指定課程"}｜{row.classroom}</strong>
                  <span>{new Date(row.checked_in_at).toLocaleString("zh-TW")}｜{statusLabels[row.status]}</span>
                  {row.status === "excused" && <small>請假/免補：{getCourseHours(row).toFixed(1)} 小時</small>}
                </article>
              ))}
              {selectedRows.length === 0 && <p className="empty">這位學生目前還沒有點名紀錄。</p>}
            </div>
          </section>
        </div>
      )}

      {selectedWarningGroup && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setSelectedWarningId(null)}>
          <section className="student-modal panel" onClick={(event) => event.stopPropagation()}>
            <div className="preview-header">
              <div>
                <span>{selectedClassName === "all" ? "全部班級" : selectedClassName}</span>
                <strong>{selectedWarningGroup.label}：{selectedWarningGroup.students.length} 人</strong>
              </div>
              <button className="tiny-button" type="button" onClick={() => setSelectedWarningId(null)}>關閉</button>
            </div>
            <div className="student-history">
              {selectedWarningGroup.students.map(({ student, total, excused, leaveHours }) => (
                <article className="student-history-item" key={student.id}>
                  <strong>{student.name}｜{student.student_no}</strong>
                  <span>{student.class_name || "未填班級"}</span>
                  <small>點名 {total} 筆｜請假/免補 {excused}｜請假 {leaveHours.toFixed(1)} 小時</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
