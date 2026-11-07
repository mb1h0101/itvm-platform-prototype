import type { School } from "./supabase";

export const REQUIRED_SCHOOLS = [
  { code: "STUST", name: "南臺科技大學" },
  { code: "KSU", name: "崑山科技大學" },
  { code: "NKUST", name: "國立高雄科技大學" },
] as const;

export type AcademicSemester = "first" | "second";

export type AcademicTerm = {
  key: string;
  academicYear: number;
  semester: AcademicSemester;
  label: string;
};

export function mergeRequiredSchools(schools: School[]) {
  const schoolMap = new Map<string, School>();
  schools.forEach((school) => {
    schoolMap.set(school.code ?? school.name, school);
  });

  REQUIRED_SCHOOLS.forEach((school) => {
    if (!schoolMap.has(school.code)) {
      schoolMap.set(school.code, {
        id: `seed:${school.code}`,
        code: school.code,
        name: school.name,
        is_active: true,
      });
    }
  });

  return Array.from(schoolMap.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-TW"));
}

export function isPersistedSchoolId(schoolId: string | null | undefined) {
  return Boolean(schoolId && schoolId !== "all" && !schoolId.startsWith("seed:"));
}

export function getAcademicTerm(dateValue: string | null | undefined): AcademicTerm | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const month = date.getMonth() + 1;
  const baseYear = month >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  const academicYear = baseYear - 1911;
  const semester: AcademicSemester = month >= 8 || month === 1 ? "first" : "second";
  const label = `${academicYear} 學年度${semester === "first" ? "上學期" : "下學期"}`;

  return {
    key: `${academicYear}-${semester}`,
    academicYear,
    semester,
    label,
  };
}

export function getCurrentAcademicTerm() {
  return getAcademicTerm(new Date().toISOString());
}

export function getTermLabel(termKey: string) {
  const [year, semester] = termKey.split("-");
  if (!year || !semester) return termKey;
  return `${year} 學年度${semester === "first" ? "上學期" : "下學期"}`;
}

export function getTermDateRange(termKey: string) {
  const [yearText, semester] = termKey.split("-");
  const academicYear = Number(yearText);
  if (!Number.isFinite(academicYear)) return null;

  const baseYear = academicYear + 1911;
  if (semester === "first") {
    return {
      startsAt: new Date(Date.UTC(baseYear, 7, 1, 0, 0, 0)).toISOString(),
      endsAt: new Date(Date.UTC(baseYear + 1, 0, 31, 23, 59, 59)).toISOString(),
    };
  }

  if (semester === "second") {
    return {
      startsAt: new Date(Date.UTC(baseYear + 1, 1, 1, 0, 0, 0)).toISOString(),
      endsAt: new Date(Date.UTC(baseYear + 1, 6, 31, 23, 59, 59)).toISOString(),
    };
  }

  return null;
}

export function getNearbyAcademicTerms() {
  return [
    { key: "115-second", label: getTermLabel("115-second") },
    { key: "116-first", label: getTermLabel("116-first") },
  ];
}
