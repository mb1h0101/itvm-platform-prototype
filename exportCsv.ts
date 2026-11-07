import type { Checkin } from "./supabase";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCheckinsCsv(rows: Checkin[]) {
  const headers = [
    "登錄時間",
    "課程/節次",
    "教室",
    "學號",
    "姓名",
    "班級",
    "狀態",
    "備註",
    "照片",
    "LINE userId",
  ];

  const lines = rows.map((row) => [
    new Date(row.checked_in_at).toLocaleString("zh-TW"),
    row.courses?.name ?? "未指定課程",
    row.classroom,
    row.student_no,
    row.student_name,
    row.class_name ?? "",
    row.status,
    row.note ?? "",
    row.photo_url ?? row.photo_path,
    row.line_user_id,
  ]);

  const csv = [headers, ...lines]
    .map((line) => line.map(escapeCsv).join(","))
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `attendance-records-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
