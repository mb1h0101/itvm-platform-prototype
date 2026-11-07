import { ArrowLeft, Copy, Download, Eye, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isDefaultCourse } from "../App";
import { downloadCheckinsCsv } from "../lib/exportCsv";
import { getAcademicTerm, getNearbyAcademicTerms, getTermLabel, mergeRequiredSchools } from "../lib/academic";
import { Checkin, CheckinStatus, Course, LineProfile, School, Student, supabase, Teacher } from "../lib/supabase";

type Props = {
  profile: LineProfile;
  teacher: Teacher;
  courses: Course[];
  isAdmin: boolean;
  onBack?: () => void;
};

const statusLabels: Record<CheckinStatus, string> = {
  present: "已完成",
  late: "逾時",
  duplicate: "重複",
  questioned: "待確認",
  excused: "保留/免補",
};

const attendanceStatusLabels: Record<CheckinStatus | "absent", string> = {
  ...statusLabels,
  absent: "未請假未出席",
};

type AttendanceResult = {
  key: string;
  student: Student | null;
  row: Checkin | null;
  schoolName: string;
  className: string;
  status: CheckinStatus | "absent";
  checkedInAt: string | null;
};

export function TeacherDashboard({ profile, teacher, courses, isAdmin, onBack }: Props) {
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [schoolId, setSchoolId] = useState(teacher.school_id ?? "all");
  const [className, setClassName] = useState("all");
  const [termKey, setTermKey] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const managedCourseIds = useMemo(
    () => courses.filter((course) => !isDefaultCourse(course)).map((course) => course.id),
    [courses],
  );
  const schoolScopedStudents = useMemo(() => {
    return students.filter((student) => schoolId === "all" || (student.school_id ?? "none") === schoolId);
  }, [schoolId, students]);
  const schoolScopedRows = useMemo(() => {
    return rows.filter((row) => schoolId === "all" || (row.school_id ?? "none") === schoolId);
  }, [rows, schoolId]);
  const classOptions = useMemo(() => {
    const values = new Set<string>();
    schoolScopedStudents.forEach((student) => values.add(student.class_name || "未填班級"));
    schoolScopedRows.forEach((row) => values.add(row.class_name || row.classroom || "未填班級"));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "zh-TW"));
  }, [schoolScopedRows, schoolScopedStudents]);
  const courseOptions = useMemo(() => {
    return courses.filter((course) => {
      if (schoolId !== "all" && course.school_id && course.school_id !== schoolId) return false;
      return true;
    });
  }, [courses, schoolId]);
  const schoolNameById = useMemo(() => {
    return new Map(schools.map((school) => [school.id, school.name]));
  }, [schools]);

  const filteredRows = useMemo(() => {
    const baseRows = schoolScopedRows.filter((row) => {
      if (className !== "all" && (row.class_name || row.classroom || "未填班級") !== className) return false;
      if (termKey !== "all") {
        const term = getAcademicTerm(row.checked_in_at);
        if (term?.key !== termKey) return false;
      }
      return true;
    });
    const key = keyword.trim().toLowerCase();
    if (!key) return baseRows;
    return baseRows.filter((row) =>
      [row.student_no, row.student_name, row.line_user_id, row.class_name ?? "", row.classroom, row.courses?.name ?? "未指定課程"]
        .join(" ")
        .toLowerCase()
        .includes(key),
    );
  }, [className, keyword, schoolScopedRows, termKey]);

  const filteredStudents = useMemo(() => {
    const baseStudents = schoolScopedStudents.filter((student) => {
      if (className !== "all" && (student.class_name || "未填班級") !== className) return false;
      return true;
    });
    const key = keyword.trim().toLowerCase();
    if (!key) return baseStudents;
    return baseStudents.filter((student) =>
      [student.student_no, student.name, student.class_name ?? "", student.line_user_id].join(" ").toLowerCase().includes(key),
    );
  }, [className, keyword, schoolScopedStudents]);

  const stats = useMemo(() => {
    const studentKeys = new Set<string>();
    filteredStudents.forEach((student) => {
      studentKeys.add(student.id);
      studentKeys.add(student.student_no);
    });
    const attendedKeys = new Set<string>();
    const excusedKeys = new Set<string>();

    filteredRows.forEach((row) => {
      const key = row.student_id || row.student_no;
      if (!key) return;
      if (row.status === "excused") {
        excusedKeys.add(key);
        return;
      }
      if (["present", "late", "duplicate", "questioned"].includes(row.status)) attendedKeys.add(key);
    });

    const expected = filteredStudents.length;
    const excused = Array.from(excusedKeys).filter((key) => studentKeys.has(key)).length;
    const attended = Array.from(attendedKeys).filter((key) => studentKeys.has(key)).length;

    return {
      expected,
      excused,
      absent: Math.max(0, expected - excused - attended),
      attended,
    };
  }, [filteredRows, filteredStudents]);

  const attendanceResults = useMemo(() => {
    const rowByStudentKey = new Map<string, Checkin>();
    filteredRows.forEach((row) => {
      const keys = [row.student_id, row.student_no].filter(Boolean) as string[];
      keys.forEach((key) => {
        const current = rowByStudentKey.get(key);
        if (!current || new Date(row.checked_in_at).getTime() > new Date(current.checked_in_at).getTime()) {
          rowByStudentKey.set(key, row);
        }
      });
    });

    const studentKeys = new Set<string>();
    const results: AttendanceResult[] = filteredStudents.map((student) => {
      studentKeys.add(student.id);
      studentKeys.add(student.student_no);
      const row = rowByStudentKey.get(student.id) ?? rowByStudentKey.get(student.student_no) ?? null;

      return {
        key: student.id,
        student,
        row,
        schoolName: schoolNameById.get(student.school_id ?? "") ?? "未指定學校",
        className: student.class_name || row?.class_name || "未填班級",
        status: row?.status ?? "absent",
        checkedInAt: row?.checked_in_at ?? null,
      };
    });

    filteredRows.forEach((row) => {
      const rowKey = row.student_id || row.student_no || row.id;
      if (studentKeys.has(rowKey) || studentKeys.has(row.student_no)) return;
      results.push({
        key: `row-${row.id}`,
        student: null,
        row,
        schoolName: schoolNameById.get(row.school_id ?? "") ?? "未指定學校",
        className: row.class_name || row.classroom || "未填班級",
        status: row.status,
        checkedInAt: row.checked_in_at,
      });
    });

    return results.sort((a, b) => {
      const schoolSort = a.schoolName.localeCompare(b.schoolName, "zh-TW");
      if (schoolSort !== 0) return schoolSort;
      const classSort = a.className.localeCompare(b.className, "zh-TW");
      if (classSort !== 0) return classSort;
      const aTime = a.checkedInAt ? new Date(a.checkedInAt).getTime() : 0;
      const bTime = b.checkedInAt ? new Date(b.checkedInAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [filteredRows, filteredStudents, schoolNameById]);

  async function loadRows() {
    setLoading(true);
    setMessage("");

    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    if (!isAdmin && managedCourseIds.length === 0) {
      setRows([]);
      setLoading(false);
      setMessage("尚未指派課程，請由管理者在課程資料綁定負責教師。");
      return;
    }

    let query = supabase
      .from("checkins")
      .select("*, courses(name, classroom)")
      .gte("checked_in_at", start.toISOString())
      .lt("checked_in_at", end.toISOString())
      .order("checked_in_at", { ascending: false });

    if (courseId !== "all") {
      query = courseId === "__default__" ? query.is("course_id", null) : query.eq("course_id", courseId);
    } else if (!isAdmin) {
      query = query.in("course_id", managedCourseIds);
    }

    if (schoolId !== "all") {
      query = query.eq("school_id", schoolId);
    } else if (!isAdmin && teacher.school_id) {
      query = query.eq("school_id", teacher.school_id);
    }

    let studentQuery = supabase.from("students").select("*").order("class_name", { ascending: true }).order("student_no", { ascending: true });
    if (schoolId !== "all") {
      studentQuery = studentQuery.eq("school_id", schoolId);
    } else if (!isAdmin && teacher.school_id) {
      studentQuery = studentQuery.eq("school_id", teacher.school_id);
    }

    const schoolQuery = supabase.from("schools").select("*").eq("is_active", true).order("name", { ascending: true });
    const [{ data, error }, { data: studentData, error: studentError }, { data: schoolData }] = await Promise.all([
      query,
      studentQuery,
      schoolQuery,
    ]);
    setLoading(false);

    const nextError = error || studentError;
    if (nextError) {
      setMessage(nextError.message);
      return;
    }

    setSchools(mergeRequiredSchools((schoolData ?? []) as School[]));
    setStudents((studentData ?? []) as Student[]);
    setRows((data ?? []) as Checkin[]);
  }

  async function updateStatus(row: Checkin, status: CheckinStatus) {
    const payload =
      teacher.id === "00000000-0000-0000-0000-000000000000"
        ? { status, reviewed_at: new Date().toISOString() }
        : { status, reviewed_by: teacher.id, reviewed_at: new Date().toISOString() };

    const { error } = await supabase
      .from("checkins")
      .update(payload)
      .eq("id", row.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status } : item)));
  }

  async function copyLineUserId(lineUserId: string) {
    try {
      await navigator.clipboard.writeText(lineUserId);
      setMessage(`已複製 LINE userId：${lineUserId}`);
    } catch {
      setMessage(`LINE userId：${lineUserId}`);
    }
  }

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, courseId, schoolId]);

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
          <p className="eyebrow">教師後台</p>
          <h1>出席紀錄管理</h1>
          <p className="subtle">{teacher.name || profile.displayName}，可查看 LINE 出席紀錄、照片、定位與審核狀態。</p>
        </div>
        <ShieldCheck aria-hidden="true" />
      </section>

      <section className="panel identity-panel">
        <span>LINE userId</span>
        <code>{profile.userId}</code>
      </section>

      <section className="stats-grid">
        <div className="stat"><span>應出席</span><strong>{stats.expected}</strong></div>
        <div className="stat"><span>請假</span><strong>{stats.excused}</strong></div>
        <div className="stat"><span>未請假未出席</span><strong>{stats.absent}</strong></div>
        <div className="stat"><span>實際出席</span><strong>{stats.attended}</strong></div>
      </section>

      <section className="panel filters">
        <label>
          學校
          <select
            value={schoolId}
            onChange={(e) => {
              setSchoolId(e.target.value);
              setClassName("all");
              setCourseId("all");
            }}
            disabled={!isAdmin && Boolean(teacher.school_id)}
          >
            {isAdmin && <option value="all">全部學校</option>}
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
        </label>
        <label>
          班級 / 名單
          <select value={className} onChange={(e) => setClassName(e.target.value)}>
            <option value="all">全部班級</option>
            {classOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          日期
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          學期
          <select value={termKey} onChange={(e) => setTermKey(e.target.value)}>
            <option value="all">全部學期</option>
            {getNearbyAcademicTerms().map((term) => (
              <option key={term.key} value={term.key}>{getTermLabel(term.key)}</option>
            ))}
          </select>
        </label>
        <label>
          課程/節次
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="all">全部課程</option>
            {courseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}｜{course.classroom}{course.course_type === "research_training" || course.research_project_id ? "｜研究" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          搜尋
          <div className="search-box">
            <Search size={18} />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="學號、姓名、班級、LINE userId" />
          </div>
        </label>
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={loadRows}>
            <Search className={loading ? "spin" : undefined} size={18} />
            搜尋
          </button>
          <button className="ghost-button" type="button" onClick={() => downloadCheckinsCsv(filteredRows)}>
            <Download size={18} />
            匯出 CSV
          </button>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="records">
        {attendanceResults.map((item) => {
          const row = item.row;
          const studentNo = item.student?.student_no ?? row?.student_no ?? "未填學號";
          const studentName = item.student?.name ?? row?.student_name ?? "未填姓名";
          const lineUserId = row?.line_user_id ?? item.student?.line_user_id ?? "";
          const courseText = row ? `${row.courses?.name ?? "未指定課程"}｜${row.classroom}` : "尚未出席";

          return (
          <article className="record" key={item.key}>
            <div className="record-main">
              <div>
                <strong>{studentName}</strong>
                <span>{studentNo}｜{item.schoolName}｜{item.className}</span>
              </div>
              {lineUserId && (
                <div className="line-id-row">
                  <code>{lineUserId}</code>
                  <button className="tiny-button" type="button" onClick={() => copyLineUserId(lineUserId)}>
                    <Copy size={14} />
                    複製
                  </button>
                </div>
              )}
              <time>{item.checkedInAt ? new Date(item.checkedInAt).toLocaleString("zh-TW") : "尚未出席"}</time>
              <small>{courseText}</small>
            </div>
            <div className="record-actions">
              <span className={`badge ${item.status}`}>{attendanceStatusLabels[item.status]}</span>
              {row?.photo_url && (
                <button className="icon-button" type="button" onClick={() => setSelectedPhoto(row.photo_url)}>
                  <Eye size={18} />
                </button>
              )}
              {row && (
                <select value={row.status} onChange={(e) => updateStatus(row, e.target.value as CheckinStatus)}>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              )}
            </div>
          </article>
          );
        })}
        {!loading && attendanceResults.length === 0 && <p className="empty">目前沒有符合搜尋條件的學生或出席紀錄。</p>}
      </section>

      {selectedPhoto && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setSelectedPhoto(null)}>
          <div className="photo-modal" onClick={(event) => event.stopPropagation()}>
            <img src={selectedPhoto} alt="簽到照片" />
            <button className="primary-button" type="button" onClick={() => setSelectedPhoto(null)}>關閉</button>
          </div>
        </div>
      )}
    </main>
  );
}
