import { ArrowLeft, Camera, CheckCircle2, MapPin, RefreshCw, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { isDefaultCourse } from "../App";
import { Course, LineProfile, Student, supabase } from "../lib/supabase";

type Props = {
  profile: LineProfile;
  courses: Course[];
  onBack?: () => void;
};

export function StudentCheckin({ profile, courses, onBack }: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [studentNo, setStudentNo] = useState("");
  const [name, setName] = useState(profile.displayName);
  const [className, setClassName] = useState("");
  const [courseId, setCourseId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId) ?? courses[0],
    [courseId, courses],
  );
  const selectedCourseIsResearch = selectedCourse?.course_type === "research_training" || Boolean(selectedCourse?.research_project_id);

  useEffect(() => {
    async function loadStudent() {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("line_user_id", profile.userId)
        .maybeSingle();

      if (data) {
        setStudent(data);
        setStudentNo(data.student_no);
        setName(data.name);
        setClassName(data.class_name ?? "");
      }
    }

    void loadStudent();
  }, [profile.userId]);

  useEffect(() => {
    if (!courseId && courses[0]) setCourseId(courses[0].id);
  }, [courseId, courses]);

  function onPhotoChange(file: File | null) {
    setPhoto(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setMessage("這支手機不支援定位。");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMessage("已記錄簽到定位。");
      },
      () => setMessage("定位失敗，仍可送出出席紀錄。"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function upsertStudent(schoolId: string | null) {
    const payload = {
      school_id: schoolId ?? student?.school_id ?? null,
      line_user_id: profile.userId,
      student_no: studentNo.trim(),
      name: name.trim(),
      class_name: className.trim() || null,
    };

    if (student) {
      const { data, error } = await supabase
        .from("students")
        .update(payload)
        .eq("id", student.id)
        .select("*")
        .single();
      if (error) throw error;
      setStudent(data);
      return data as Student;
    }

    let pendingQuery = supabase
      .from("students")
      .select("*")
      .eq("student_no", payload.student_no)
      .like("line_user_id", "pending:%")
      .limit(1);

    pendingQuery = schoolId ? pendingQuery.eq("school_id", schoolId) : pendingQuery.is("school_id", null);

    const { data: pendingStudents } = await pendingQuery;
    const pendingStudent = pendingStudents?.[0];

    if (pendingStudent) {
      const { data, error } = await supabase
        .from("students")
        .update(payload)
        .eq("id", pendingStudent.id)
        .select("*")
        .single();
      if (error) throw error;
      setStudent(data);
      return data as Student;
    }

    const { data, error } = await supabase
      .from("students")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    setStudent(data);
    return data as Student;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!studentNo.trim() || !name.trim()) {
      setMessage("請填寫學號與姓名。");
      return;
    }

    if (!selectedCourse) {
      setMessage("尚未建立課程。");
      return;
    }

    if (!photo) {
      setMessage("請先拍攝簽到照片。");
      return;
    }

    setLoading(true);
    try {
      const schoolId = isDefaultCourse(selectedCourse) ? null : selectedCourse.school_id ?? null;
      const researchProjectId = isDefaultCourse(selectedCourse) ? null : selectedCourse.research_project_id ?? null;
      const savedStudent = await upsertStudent(schoolId);
      const ext = photo.name.split(".").pop() || "jpg";
      const storageCourseId = isDefaultCourse(selectedCourse) ? "default-course" : selectedCourse.id;
      const databaseCourseId = isDefaultCourse(selectedCourse) ? null : selectedCourse.id;
      const photoPath = `${storageCourseId}/${savedStudent.student_no}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("checkin-photos")
        .upload(photoPath, photo, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicPhoto } = supabase.storage
        .from("checkin-photos")
        .getPublicUrl(photoPath);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let duplicateQuery = supabase
        .from("checkins")
        .select("id")
        .eq("line_user_id", profile.userId)
        .gte("checked_in_at", todayStart.toISOString());

      duplicateQuery = databaseCourseId
        ? duplicateQuery.eq("course_id", databaseCourseId)
        : duplicateQuery.is("course_id", null);

      const { data: existingRows } = await duplicateQuery;
      const status = existingRows && existingRows.length > 0 ? "duplicate" : "present";

      const { error: checkinError } = await supabase.from("checkins").insert({
        school_id: schoolId,
        ...(researchProjectId ? { research_project_id: researchProjectId } : {}),
        course_id: databaseCourseId,
        student_id: savedStudent.id,
        line_user_id: profile.userId,
        student_no: savedStudent.student_no,
        student_name: savedStudent.name,
        class_name: savedStudent.class_name,
        classroom: selectedCourse.classroom,
        photo_path: photoPath,
        photo_url: publicPhoto.publicUrl,
        gps_lat: location?.lat ?? null,
        gps_lng: location?.lng ?? null,
        status,
      });
      if (checkinError) throw checkinError;

      setMessage(status === "duplicate" ? "已送出，但系統標記為重複簽到。" : "出席紀錄已送出。");
      onPhotoChange(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "送出失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

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
          <p className="eyebrow">LINE 出席</p>
          <h1>{onBack ? "協助學生點名" : "課程出席簽到"}</h1>
          <p className="subtle">
            {onBack ? "老師可協助學生完成點名，送出後系統會記錄 LINE 身分、時間、照片與定位。" : "到課後拍照送出，系統會記錄 LINE 身分、時間、照片與定位。"}
          </p>
        </div>
        <UserRound aria-hidden="true" />
      </section>

      <section className="panel identity-panel">
        <span>LINE userId</span>
        <code>{profile.userId}</code>
      </section>

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <label>
          學號
          <input value={studentNo} onChange={(e) => setStudentNo(e.target.value)} placeholder="例如 S113001" />
        </label>
        <label>
          姓名
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="請輸入姓名" />
        </label>
        <label>
          班級
          <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="例如 資工一甲、通識 A 班" />
        </label>
        <label>
          課程/節次
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}｜{course.classroom}{course.course_type === "research_training" || course.research_project_id ? "｜研究" : ""}
              </option>
            ))}
          </select>
        </label>
        {selectedCourseIsResearch && (
          <section className="sync-summary">
            <div>
              <span>研究訓練</span>
              <strong>{selectedCourse.name}</strong>
            </div>
            <div>
              <span>負責老師</span>
              <strong>{selectedCourse.classroom}</strong>
            </div>
          </section>
        )}

        <label className="photo-picker">
          <Camera aria-hidden="true" />
          <span>{photo ? "重新拍照" : "拍攝簽到照片"}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
          />
        </label>

        {previewUrl && <img className="photo-preview" src={previewUrl} alt="簽到照片預覽" />}

        <button className="ghost-button" type="button" onClick={requestLocation}>
          <MapPin size={18} />
          {location ? "定位已記錄" : "記錄簽到位置"}
        </button>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? <RefreshCw className="spin" size={18} /> : <CheckCircle2 size={18} />}
          送出出席紀錄
        </button>

        {message && <p className="message">{message}</p>}
      </form>
    </main>
  );
}
