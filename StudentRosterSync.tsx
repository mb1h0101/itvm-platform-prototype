import { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, FileSpreadsheet, RefreshCw, UploadCloud, UsersRound } from "lucide-react";
import { readSheet } from "read-excel-file/browser";
import { LineProfile, School, supabase, Teacher } from "../lib/supabase";
import { getNearbyAcademicTerms, getTermDateRange, getTermLabel, isPersistedSchoolId, mergeRequiredSchools } from "../lib/academic";

type Props = {
  profile: LineProfile;
  teacher: Teacher;
  isAdmin: boolean;
  onBack?: () => void;
  onCoursesChanged?: () => void;
};

type ParsedStudent = {
  line_user_id: string;
  student_no: string;
  name: string;
  class_name: string | null;
};

type RosterIssue = {
  rowNumber: number;
  reason: string;
};

type RosterParseResult = {
  rows: ParsedStudent[];
  issues: RosterIssue[];
  sourceName: string;
};

const sampleText = `學號,中文姓名,英文姓名,班級,LINE userId
4B4YV007,範氏香,PHAM THI HUONG,國際專班,
4B4YV008,郭慶玲,QUACH KHANH LINH,國際專班,Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`;

const headerCandidates = {
  student_no: ["學號", "學生學號", "student no", "student_no", "student id", "id", "學籍號"],
  name: ["中文姓名", "姓名", "學生姓名", "name", "student name", "chinese name"],
  class_name: ["班級", "班別", "系級", "科系", "department", "class", "class_name"],
  line_user_id: ["line userid", "line user id", "line_user_id", "line id", "lineuid", "line"],
};

function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeHeader(value: unknown) {
  return normalizeCell(value).toLowerCase().replace(/\s+/g, " ").replace(/[_-]/g, " ");
}

function splitTextRow(row: string) {
  return row.includes("\t") ? row.split("\t") : row.split(",");
}

function findColumnIndex(headers: unknown[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return headers.findIndex((header) => normalizedCandidates.includes(normalizeHeader(header)));
}

function findHeaderRow(matrix: unknown[][]) {
  return matrix.findIndex((row) => {
    const studentNoIndex = findColumnIndex(row, headerCandidates.student_no);
    const nameIndex = findColumnIndex(row, headerCandidates.name);
    return studentNoIndex >= 0 && nameIndex >= 0;
  });
}

function parseMatrix(matrix: unknown[][], schoolId: string | null, sourceName: string): RosterParseResult {
  const compactRows = matrix.filter((row) => row.some((cell) => normalizeCell(cell)));
  const headerRowIndex = findHeaderRow(compactRows);
  const headers = headerRowIndex >= 0 ? compactRows[headerRowIndex] : [];
  const dataRows = headerRowIndex >= 0 ? compactRows.slice(headerRowIndex + 1) : compactRows;

  const studentNoIndex = headerRowIndex >= 0 ? findColumnIndex(headers, headerCandidates.student_no) : 0;
  const nameIndex = headerRowIndex >= 0 ? findColumnIndex(headers, headerCandidates.name) : 1;
  const classNameIndex = headerRowIndex >= 0 ? findColumnIndex(headers, headerCandidates.class_name) : 2;
  const lineUserIdIndex = headerRowIndex >= 0 ? findColumnIndex(headers, headerCandidates.line_user_id) : 3;

  const issues: RosterIssue[] = [];
  const seenStudentNos = new Set<string>();
  const rows = dataRows
    .map((row, index) => {
      const rowNumber = index + 1 + (headerRowIndex >= 0 ? headerRowIndex + 1 : 0);
      const studentNo = normalizeCell(row[studentNoIndex]);
      const name = normalizeCell(row[nameIndex]);
      const className = classNameIndex >= 0 ? normalizeCell(row[classNameIndex]) : "";
      const lineUserId = lineUserIdIndex >= 0 ? normalizeCell(row[lineUserIdIndex]) : "";

      if (!studentNo || !name) {
        issues.push({ rowNumber, reason: "缺少學號或姓名，已略過" });
        return null;
      }

      if (seenStudentNos.has(studentNo)) {
        issues.push({ rowNumber, reason: `學號 ${studentNo} 重複，已略過後面的資料` });
        return null;
      }

      seenStudentNos.add(studentNo);

      return {
        student_no: studentNo,
        name,
        class_name: className || null,
        line_user_id: lineUserId || `pending:${schoolId ?? "global"}:${studentNo}`,
      };
    })
    .filter((row): row is ParsedStudent => Boolean(row));

  return { rows, issues, sourceName };
}

function parseDelimitedText(text: string, schoolId: string | null): RosterParseResult {
  const matrix = text
    .split(/\r?\n/)
    .map((row) => splitTextRow(row).map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));

  return parseMatrix(matrix, schoolId, "手動貼上資料");
}

function isTextRoster(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".tsv") || file.type === "text/csv" || file.type === "text/tab-separated-values";
}

function getRosterCourseLabel(sourceName: string) {
  const trimmed = sourceName.trim();
  if (!trimmed || trimmed === "手動貼上資料") return "手動匯入名單";
  return trimmed.replace(/\.(xlsx|csv|tsv)$/i, "").trim() || trimmed;
}

function saveRosterImportFallback(record: Record<string, unknown>) {
  try {
    const key = "line-attendance-roster-imports";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const nextRecords = Array.isArray(existing) ? existing : [];
    nextRecords.unshift({ ...record, local_saved_at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(nextRecords.slice(0, 50)));
  } catch {
    // Local backup is best-effort only; it should never block roster import.
  }
}

export function StudentRosterSync({ profile, teacher, isAdmin, onBack, onCoursesChanged }: Props) {
  const [text, setText] = useState(sampleText);
  const [parseResult, setParseResult] = useState<RosterParseResult>(() =>
    parseDelimitedText(sampleText, teacher.school_id ?? null),
  );
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(teacher.school_id ?? "seed:STUST");
  const [selectedTermKey, setSelectedTermKey] = useState("115-second");
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [message, setMessage] = useState("");

  const pendingCount = useMemo(
    () => parseResult.rows.filter((row) => row.line_user_id.startsWith("pending:")).length,
    [parseResult.rows],
  );
  const supplementCount = useMemo(
    () => parseResult.rows.filter((row) => !row.class_name || row.line_user_id.startsWith("pending:")).length,
    [parseResult.rows],
  );
  const fallbackCourseLabel = useMemo(() => getRosterCourseLabel(parseResult.sourceName), [parseResult.sourceName]);
  const selectedSchool = schools.find((school) => school.id === selectedSchoolId) ?? null;
  const activeSchoolId = isPersistedSchoolId(selectedSchoolId) ? selectedSchoolId : null;
  const termRange = getTermDateRange(selectedTermKey);

  async function loadSchools() {
    const { data } = await supabase.from("schools").select("*").eq("is_active", true).order("name", { ascending: true });
    const nextSchools = mergeRequiredSchools((data ?? []) as School[]);
    setSchools(nextSchools);
    if (teacher.school_id) {
      setSelectedSchoolId(teacher.school_id);
      setParseResult(parseDelimitedText(text, teacher.school_id));
      return;
    }
    const stust = nextSchools.find((school) => school.code === "STUST");
    if (stust) {
      setSelectedSchoolId(stust.id);
      setParseResult(parseDelimitedText(text, isPersistedSchoolId(stust.id) ? stust.id : null));
    }
  }

  function handleTextChange(value: string) {
    setText(value);
    setParseResult(parseDelimitedText(value, activeSchoolId));
    setMessage("");
  }

  async function parseRosterFile(file: File) {
    setFileLoading(true);
    setMessage("");

    try {
      if (isTextRoster(file)) {
        const content = await file.text();
        const nextResult = parseDelimitedText(content, activeSchoolId);
        setParseResult({ ...nextResult, sourceName: file.name });
        setText(content);
        return;
      }

      const matrix = await readSheet(file);
      const nextResult = parseMatrix(matrix, activeSchoolId, file.name);
      setParseResult(nextResult);
      setText(matrix.map((row) => row.map(normalizeCell).join(",")).join("\n"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "檔案讀取失敗，請確認格式是否為 .xlsx、CSV 或 TSV");
    } finally {
      setFileLoading(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await parseRosterFile(file);
    } finally {
      event.target.value = "";
    }
  }

  function getTransferFile(files: FileList | null) {
    return files && files.length > 0 ? files[0] : null;
  }

  async function handlePaste(event: ClipboardEvent<HTMLFormElement>) {
    const file = getTransferFile(event.clipboardData.files);
    if (!file) return;

    event.preventDefault();
    await parseRosterFile(file);
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDraggingFile(false);

    const file = getTransferFile(event.dataTransfer.files);
    if (!file) return;

    await parseRosterFile(file);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!isAdmin) {
      setMessage("你目前沒有教務匯入權限，請使用管理員或教務處帳號。");
      return;
    }

    if (parseResult.rows.length === 0) {
      setMessage("沒有可匯入的學生資料，請確認檔案至少包含學號與姓名。");
      return;
    }

    if (!activeSchoolId || !selectedSchool) {
      setMessage("請先選擇要匯入到哪一間學校，不能用未指定學校匯入。");
      return;
    }

    const rowsForImport = parseResult.rows.map((row) => ({
      school_id: activeSchoolId,
      line_user_id: row.line_user_id,
      student_no: row.student_no,
      name: row.name,
      class_name: row.class_name?.trim() || fallbackCourseLabel,
    }));

    setLoading(true);
    let importedCount = 0;

    for (const row of rowsForImport) {
      let lookupQuery = supabase
        .from("students")
        .select("*")
        .eq("student_no", row.student_no)
        .eq("school_id", activeSchoolId);
      const { data: existingStudent, error: lookupError } = await lookupQuery.limit(1);

      if (lookupError) {
        setLoading(false);
        setMessage(lookupError.message);
        return;
      }

      const firstExistingStudent = existingStudent?.[0];

      if (firstExistingStudent) {
        const nextLineUserId =
          row.line_user_id.startsWith("pending:") && !String(firstExistingStudent.line_user_id ?? "").startsWith("pending:")
            ? firstExistingStudent.line_user_id
            : row.line_user_id;
        const { error: updateError } = await supabase
          .from("students")
          .update({
            line_user_id: nextLineUserId,
            school_id: activeSchoolId,
            student_no: row.student_no,
            name: row.name,
            class_name: row.class_name,
          })
          .eq("id", firstExistingStudent.id);

        if (updateError) {
          setLoading(false);
          setMessage(updateError.message);
          return;
        }
      } else {
        const { error: insertError } = await supabase.from("students").insert(row);

        if (insertError) {
          setLoading(false);
          setMessage(insertError.message);
          return;
        }
      }

      importedCount += 1;
    }

    const classNames = Array.from(new Set(rowsForImport.map((row) => row.class_name?.trim()).filter((value): value is string => Boolean(value))));
    let createdCourseCount = 0;
    let courseWarning = "";

    if (classNames.length > 0) {
      let existingCourseQuery = supabase
        .from("courses")
        .select("name, classroom")
        .in("classroom", classNames);
      if (activeSchoolId) existingCourseQuery = existingCourseQuery.eq("school_id", activeSchoolId);
      const { data: existingCourses, error: courseLookupError } = await existingCourseQuery;

      if (courseLookupError) {
        courseWarning = `課程清單暫時無法檢查：${courseLookupError.message}`;
      } else {
        const existingKeys = new Set((existingCourses ?? []).map((course) => `${course.name}::${course.classroom}`));
        const coursesToCreate = classNames
          .map((className) => ({
            name: `${className} 點名課程`,
            school_id: activeSchoolId,
            classroom: className,
            teacher_id: teacher.id === "00000000-0000-0000-0000-000000000000" ? null : teacher.id,
            starts_at: termRange?.startsAt ?? null,
            ends_at: termRange?.endsAt ?? null,
            late_after_minutes: 10,
            is_active: true,
          }))
          .filter((course) => !existingKeys.has(`${course.name}::${course.classroom}`));

        if (coursesToCreate.length > 0) {
          const { error: courseInsertError } = await supabase.from("courses").insert(coursesToCreate);
          if (courseInsertError) {
            courseWarning = `課程尚未自動建立：${courseInsertError.message}`;
          } else {
            createdCourseCount = coursesToCreate.length;
            onCoursesChanged?.();
          }
        }
      }
    }

    const submittedAt = new Date().toISOString();
    const importRecord = {
      school_id: activeSchoolId,
      teacher_id: teacher.id === "00000000-0000-0000-0000-000000000000" ? null : teacher.id,
      teacher_name: teacher.name || profile.displayName,
      teacher_line_user_id: teacher.line_user_id || profile.userId,
      source_name: parseResult.sourceName,
      course_source_name: fallbackCourseLabel,
      total_rows: parseResult.rows.length,
      imported_rows: importedCount,
      skipped_rows: parseResult.issues.length,
      pending_line_rows: pendingCount,
      missing_data_rows: supplementCount,
      submitted_at: submittedAt,
    };
    const { error: logError } = await supabase.from("roster_imports").insert(importRecord);
    if (logError) saveRosterImportFallback(importRecord);

    setLoading(false);
    const submittedAtText = new Date(submittedAt).toLocaleString("zh-TW");
    const logText = logError
      ? `已先在本機暫存送出紀錄：${teacher.name || profile.displayName}，${submittedAtText}。`
      : `已記錄由 ${teacher.name || profile.displayName} 於 ${submittedAtText} 送出。`;
    const courseText = courseWarning ? `${courseWarning}。` : `自動新增 ${createdCourseCount} 門課程。`;
    const schoolText = `${selectedSchool.name}｜`;
    const termText = `${getTermLabel(selectedTermKey)}｜`;
    setMessage(`已匯入 ${importedCount} 筆學生名單；${schoolText}${termText}${courseText}其中 ${supplementCount} 筆資料可之後再補。沒有班級的資料已用「${fallbackCourseLabel}」作為課程來源。${logText}`);
  }

  useEffect(() => {
    void loadSchools();
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

      {!isAdmin && (
        <section className="panel form-panel">
          <p className="message">你目前沒有教務匯入權限，請使用管理員或教務處帳號。</p>
        </section>
      )}
      {isAdmin && (
        <>
          <section className="panel hero-panel">
            <div>
              <p className="eyebrow">教務處名單匯入</p>
              <h1>老師自行導入學生清單</h1>
            </div>
            <UsersRound aria-hidden="true" />
          </section>

          <form className="panel form-panel" onSubmit={handleSubmit} onPaste={handlePaste}>
            <label
              className={`file-drop${isDraggingFile ? " dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={handleDrop}
            >
              <input accept=".xlsx,.csv,.tsv,text/csv,text/tab-separated-values" type="file" onChange={handleFileChange} />
              {fileLoading ? <RefreshCw className="spin" size={22} /> : <UploadCloud size={22} />}
              <span>{fileLoading ? "正在讀取名單..." : "選擇 Excel / CSV 名單檔"}</span>
              <small>手機請點這裡選檔；電腦也可拖曳檔案或貼上剪貼簿裡的檔案。沒有 LINE userId 也可以先匯入。</small>
            </label>

            <label>
              匯入學校（必選）
              <select
                value={selectedSchoolId}
                onChange={(event) => {
                  const nextSchoolId = event.target.value;
                  setSelectedSchoolId(nextSchoolId);
                  setParseResult(parseDelimitedText(text, isPersistedSchoolId(nextSchoolId) ? nextSchoolId : null));
                }}
                disabled={Boolean(teacher.school_id)}
              >
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              匯入學期（必選）
              <select value={selectedTermKey} onChange={(event) => setSelectedTermKey(event.target.value)}>
                {getNearbyAcademicTerms().map((term) => (
                  <option key={term.key} value={term.key}>
                    {term.label}
                  </option>
                ))}
              </select>
            </label>

            <section className="sync-summary">
              <div>
                <span>將匯入學校</span>
                <strong>{selectedSchool?.name ?? "尚未選擇"}</strong>
              </div>
              <div>
                <span>將匯入學期</span>
                <strong>{getTermLabel(selectedTermKey)}</strong>
              </div>
              <div>
                <span>資料狀態</span>
                <strong>{activeSchoolId ? "可送出" : "請先選學校"}</strong>
              </div>
            </section>

            <label>
              貼上表格文字或修正資料
              <textarea
                value={text}
                onChange={(event) => handleTextChange(event.target.value)}
                spellCheck={false}
                placeholder="學號,中文姓名,英文姓名,班級,LINE userId"
              />
            </label>

            <section className="sync-summary">
              <div>
                <span>可匯入</span>
                <strong>{parseResult.rows.length}</strong>
              </div>
              <div>
                <span>尚未綁定 LINE</span>
                <strong>{pendingCount}</strong>
              </div>
              <div>
                <span>可之後補</span>
                <strong>{supplementCount}</strong>
              </div>
            </section>

            <section className="roster-preview">
              <div className="preview-header">
                <div>
                  <span>來源</span>
                  <strong>{parseResult.sourceName}</strong>
                </div>
                <FileSpreadsheet aria-hidden="true" />
              </div>
              {parseResult.rows.length > 0 ? (
                <div className="preview-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>學號</th>
                        <th>姓名</th>
                        <th>班級</th>
                        <th>LINE 狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.rows.slice(0, 8).map((row) => (
                        <tr key={row.line_user_id}>
                          <td>{row.student_no}</td>
                          <td>{row.name}</td>
                          <td>{row.class_name ?? `未填，將使用 ${fallbackCourseLabel}`}</td>
                          <td>{row.line_user_id.startsWith("pending:") ? "待綁定" : "已提供"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parseResult.rows.length > 8 && <small>只預覽前 8 筆，送出時會匯入全部 {parseResult.rows.length} 筆。</small>}
                </div>
              ) : (
                <p className="empty">尚未讀到可匯入資料。</p>
              )}
            </section>

            {parseResult.issues.length > 0 && (
              <section className="issue-list">
                <div>
                  <AlertTriangle size={18} />
                  <strong>需要確認的列</strong>
                </div>
                {parseResult.issues.slice(0, 5).map((issue) => (
                  <p key={`${issue.rowNumber}-${issue.reason}`}>第 {issue.rowNumber} 列：{issue.reason}</p>
                ))}
              </section>
            )}

            <button className="primary-button" type="submit" disabled={loading || fileLoading}>
              {loading ? <RefreshCw className="spin" size={18} /> : <UsersRound size={18} />}
              確認匯入學生名單
            </button>

            {message && <p className="message">{message}</p>}
          </form>
        </>
      )}
    </main>
  );
}
