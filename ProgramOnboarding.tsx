import {
  ArrowRight,
  Building2,
  BriefcaseBusiness,
  Bot,
  ChevronLeft,
  ChevronRight,
  Globe2,
  GraduationCap,
  Handshake,
  Languages,
  Loader2,
  Mail,
  Send,
  UserPlus,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { ProgramWorkflow } from "./ProgramWorkflow";
import "./ProgramOnboarding.css";
import "./ProgramOfficial.css";

export type AppLanguage = "zh-TW" | "en" | "id" | "vi";
export type PortalRole = "student" | "school" | "company" | "agency";
type Page =
  | "home"
  | "notices"
  | "notice"
  | "roles"
  | "account"
  | "student"
  | "student-progress"
  | "questionnaire"
  | "company"
  | "agency"
  | "school"
  | "matching"
  | "resources"
  | "a2";
type ContentKind = "news" | "announcement";
type AssistantAction =
  | "apply"
  | "admission"
  | "a2"
  | "student"
  | "school"
  | "company"
  | "agency"
  | "news"
  | "notices"
  | "resources"
  | null;
type ContentItem = {
  date: string;
  title: string;
  summary: string;
  body: string[];
  image?: string;
};
type Props = {
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  onComplete: (role: PortalRole) => void;
  authenticatedRole?: PortalRole | null;
  onOpenLegacyPrep?: () => void;
};

const languageLabels: Record<AppLanguage, string> = {
  "zh-TW": "繁體中文",
  en: "English",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
};
const ui: Record<AppLanguage, Record<string, string>> = {
  "zh-TW": {
    home: "首頁",
    notices: "最新公告",
    news: "最新新聞",
    admission: "招生資訊",
    resources: "專班資源",
    login: "登入系統",
    readNews: "閱讀新聞",
    allNotices: "全部公告",
    apply: "我要申請",
    studentPath: "學生申請",
    schoolPath: "協會管理",
    companyPath: "合作企業",
    agencyPath: "留學代辦",
    programEyebrow: "PROGRAMME",
    programTitle: "培養臺灣產業需要的國際人才",
    programHint:
      "兩年制 STEM 學士班結合中文學習、專業課程與企業實習，協助學生從校園走向職場。",
    programStudy: "專業學習",
    programStudyHint: "聚焦車輛保養修護、整車銷售與零組件材料等實務領域。",
    programSupport: "在臺支持",
    programSupportHint: "提供語言、生活與學習資源，協助國際學生適應在臺生活。",
    programCareer: "企業連結",
    programCareerHint: "透過企業合作、媒合與面試，讓學習與職涯發展接軌。",
    applicationEyebrow: "學生申請",
    applicationTitle: "準備你的申請資料",
    applicationHint:
      "登入後填寫申請資料與專業問卷；審核通過後，系統會通知你後續的媒合與面試安排。",
    applicationCard: "填寫學生申請",
    applicationCardHint:
      "填寫基本資料、語言能力、職涯意願、赴臺動機與可面試時間。",
    startApplication: "開始填寫",
    roleAccess: "登入與服務入口",
    requestedRole: "申請服務身分",
    requestedRoleHint: "此欄用於申請服務；登入後會依帳號核定身分顯示可用功能。",
    signIn: "登入",
    register: "註冊帳號",
    accountTitle: "系統登入／帳號申請",
    useGoogle: "使用 Google 繼續",
    useLine: "使用 LINE 繼續",
    processing: "處理中…",
    emailDivider: "或使用 Email",
    password: "密碼（至少 6 碼）",
    submitRegistration: "送出帳號申請",
    signInSystem: "登入系統",
    backHome: "返回網站首頁",
    footerProject: "專案連結",
    footerCampus: "校園與國際資源",
    footerGovernment: "政府／教育資源",
    footerContact: "聯絡與資訊",
  },
  en: {
    home: "Home",
    notices: "Notices",
    news: "News",
    admission: "Admission",
    resources: "Resources",
    login: "Sign in",
    readNews: "Read news",
    allNotices: "All notices",
    apply: "Apply now",
    studentPath: "Student application",
    schoolPath: "Association management",
    companyPath: "Partner companies",
    agencyPath: "Education agencies",
    programEyebrow: "PROGRAMME",
    programTitle: "Preparing international talent for Taiwan’s industries",
    programHint:
      "This two-year STEM bachelor’s programme combines Chinese learning, professional courses and industry internships to help students move from campus to career.",
    programStudy: "Professional learning",
    programStudyHint:
      "Practical study in vehicle maintenance, vehicle sales and parts materials.",
    programSupport: "Life in Taiwan",
    programSupportHint:
      "Language, living and study support for international students settling into Taiwan.",
    programCareer: "Industry connection",
    programCareerHint:
      "Industry partnerships, matching and interviews connect study with career opportunities.",
    applicationEyebrow: "STUDENT APPLICATION",
    applicationTitle: "Prepare your application",
    applicationHint:
      "Sign in to complete your application and professional questionnaire. We will notify you about matching and interviews after review.",
    applicationCard: "Complete student application",
    applicationCardHint:
      "Provide your profile, language ability, career interests, motivation for Taiwan and available interview times.",
    startApplication: "Start application",
    roleAccess: "SIGN-IN & SERVICES",
    requestedRole: "Service role",
    requestedRoleHint:
      "This is used for your service request. Available features are shown according to your approved account role after sign-in.",
    signIn: "Sign in",
    register: "Create account",
    accountTitle: "Sign in / create account",
    useGoogle: "Continue with Google",
    useLine: "Continue with LINE",
    processing: "Processing…",
    emailDivider: "or use email",
    password: "Password (at least 6 characters)",
    submitRegistration: "Submit account request",
    signInSystem: "Sign in",
    backHome: "Back to website",
    footerProject: "Project links",
    footerCampus: "Campus & international resources",
    footerGovernment: "Government / education",
    footerContact: "Contact & information",
  },
  id: {
    home: "Beranda",
    notices: "Pengumuman",
    news: "Berita",
    admission: "Pendaftaran",
    resources: "Sumber daya",
    login: "Masuk",
    readNews: "Baca berita",
    allNotices: "Semua pengumuman",
    apply: "Daftar sekarang",
    studentPath: "Pendaftaran mahasiswa",
    schoolPath: "Manajemen asosiasi",
    companyPath: "Mitra perusahaan",
    agencyPath: "Agen pendidikan",
    programEyebrow: "PROGRAM",
    programTitle: "Menyiapkan talenta internasional untuk industri Taiwan",
    programHint:
      "Program sarjana STEM dua tahun ini menggabungkan pembelajaran bahasa Mandarin, mata kuliah profesional, dan magang industri untuk menghubungkan kampus dengan karier.",
    programStudy: "Pembelajaran profesional",
    programStudyHint:
      "Pembelajaran praktik perawatan kendaraan, penjualan kendaraan, serta material suku cadang.",
    programSupport: "Dukungan di Taiwan",
    programSupportHint:
      "Dukungan bahasa, kehidupan, dan belajar bagi mahasiswa internasional di Taiwan.",
    programCareer: "Koneksi industri",
    programCareerHint:
      "Kemitraan industri, pencocokan, dan wawancara menghubungkan pembelajaran dengan karier.",
    applicationEyebrow: "PENDAFTARAN MAHASISWA",
    applicationTitle: "Siapkan pendaftaran Anda",
    applicationHint:
      "Masuk untuk mengisi data pendaftaran dan kuesioner keahlian. Setelah ditinjau, kami akan memberi tahu tahap pencocokan dan wawancara berikutnya.",
    applicationCard: "Isi pendaftaran mahasiswa",
    applicationCardHint:
      "Isi profil, kemampuan bahasa, minat karier, motivasi ke Taiwan, dan waktu wawancara yang tersedia.",
    startApplication: "Mulai mengisi",
    roleAccess: "MASUK & LAYANAN",
    requestedRole: "Peran layanan",
    requestedRoleHint:
      "Pilihan ini digunakan untuk permohonan layanan. Fitur tersedia mengikuti peran akun yang disetujui setelah masuk.",
    signIn: "Masuk",
    register: "Daftar akun",
    accountTitle: "Masuk / daftar akun",
    useGoogle: "Lanjutkan dengan Google",
    useLine: "Lanjutkan dengan LINE",
    processing: "Memproses…",
    emailDivider: "atau gunakan email",
    password: "Kata sandi (minimal 6 karakter)",
    submitRegistration: "Kirim permohonan akun",
    signInSystem: "Masuk sistem",
    backHome: "Kembali ke situs",
    footerProject: "Tautan proyek",
    footerCampus: "Sumber daya kampus & internasional",
    footerGovernment: "Pemerintah / pendidikan",
    footerContact: "Kontak & informasi",
  },
  vi: {
    home: "Trang chủ",
    notices: "Thông báo",
    news: "Tin tức",
    admission: "Tuyển sinh",
    resources: "Tài nguyên",
    login: "Đăng nhập",
    readNews: "Đọc tin",
    allNotices: "Tất cả thông báo",
    apply: "Đăng ký ngay",
    studentPath: "Hồ sơ sinh viên",
    schoolPath: "Quản lý hiệp hội",
    companyPath: "Doanh nghiệp đối tác",
    agencyPath: "Đơn vị tư vấn",
    programEyebrow: "CHƯƠNG TRÌNH",
    programTitle: "Đào tạo nhân lực quốc tế cho ngành công nghiệp Đài Loan",
    programHint:
      "Chương trình cử nhân STEM hai năm kết hợp học tiếng Trung, học phần chuyên môn và thực tập doanh nghiệp, giúp sinh viên đi từ giảng đường đến nghề nghiệp.",
    programStudy: "Học tập chuyên môn",
    programStudyHint:
      "Học thực hành về bảo dưỡng xe, bán xe và vật liệu phụ tùng.",
    programSupport: "Hỗ trợ tại Đài Loan",
    programSupportHint:
      "Hỗ trợ ngôn ngữ, đời sống và học tập cho sinh viên quốc tế tại Đài Loan.",
    programCareer: "Kết nối doanh nghiệp",
    programCareerHint:
      "Hợp tác doanh nghiệp, kết nối ứng viên và phỏng vấn gắn việc học với nghề nghiệp.",
    applicationEyebrow: "HỒ SƠ SINH VIÊN",
    applicationTitle: "Chuẩn bị hồ sơ của bạn",
    applicationHint:
      "Đăng nhập để hoàn thành hồ sơ và bảng khảo sát chuyên môn. Sau khi xét duyệt, hệ thống sẽ thông báo bước ghép nối và phỏng vấn.",
    applicationCard: "Điền hồ sơ sinh viên",
    applicationCardHint:
      "Điền hồ sơ, năng lực ngôn ngữ, định hướng nghề nghiệp, động lực đến Đài Loan và thời gian phỏng vấn.",
    startApplication: "Bắt đầu điền",
    roleAccess: "ĐĂNG NHẬP & DỊCH VỤ",
    requestedRole: "Vai trò dịch vụ",
    requestedRoleHint:
      "Lựa chọn này dùng cho yêu cầu dịch vụ. Chức năng sẽ hiển thị theo vai trò tài khoản đã được phê duyệt sau khi đăng nhập.",
    signIn: "Đăng nhập",
    register: "Tạo tài khoản",
    accountTitle: "Đăng nhập / tạo tài khoản",
    useGoogle: "Tiếp tục với Google",
    useLine: "Tiếp tục với LINE",
    processing: "Đang xử lý…",
    emailDivider: "hoặc dùng email",
    password: "Mật khẩu (ít nhất 6 ký tự)",
    submitRegistration: "Gửi yêu cầu tài khoản",
    signInSystem: "Đăng nhập hệ thống",
    backHome: "Quay lại website",
    footerProject: "Liên kết dự án",
    footerCampus: "Nguồn lực trường & quốc tế",
    footerGovernment: "Chính phủ / giáo dục",
    footerContact: "Liên hệ & thông tin",
  },
};
const news: ContentItem[] = [
  {
    date: "2026",
    title:
      "2026 Vietnam–Taiwan Automotive Talent & Industry Exchange",
    summary:
      "越南太原技術大學代表團與台灣車用電子協會交流，聚焦汽修人才培育與產業合作。",
    image: "/news/tnut-delegation-hero.png",
    body: [
      "Thai Nguyen University of Technology（TNUT）代表團與台灣車用電子協會進行汽修人才與產業交流。",
      "雙方針對國際人才培育、產業合作與後續交流機會進行討論，持續建立臺越人才橋接連結。",
    ],
  },
];
const announcements: ContentItem[] = [
  {
    date: "2026.10.06",
    title: "115 學年度新型專班招生資訊",
    summary: "招生資格、學制、申請流程與補助方案。",
    body: [
      "本專班為兩年制 STEM 學士班，預計於 2027 年 2 月入學。",
      "招生對象為英語、印尼語及越南語背景的國際學生；申請者須依規定完成資料與資格審查。",
      "申請流程：建立帳號、填寫申請資料、上傳規定文件、完成審查與面試通知。",
      "如需協助，請由服務入口選擇學生申請或留學代辦，再依身分登入系統處理。",
    ],
  },
  {
    date: "2026.10.06",
    title: "國際學生申請文件準備",
    summary: "中文 A2、基本資料與面試文件準備。",
    body: [
      "申請者請先完成基本資料、聯絡方式、申請動機及語言能力資料。",
      "請預先準備護照或身分證明、最高學歷文件、成績資料、語言能力與申請動機等資料。",
      "面試前將依個別狀態通知補件、面試時段與後續報到流程。",
      "送出前請逐項確認資料正確；系統將保留補件與審查進度通知。",
    ],
  },
  {
    date: "2026.10.06",
    title: "企業實習與生活津貼說明",
    summary: "合作企業、實習機會與職涯銜接方案。",
    body: [
      "合作企業提供每月最低 NT$10,000 生活津貼，最長可達兩年。",
      "實習期間薪資依規定每月基本薪資至少 NT$29,500，並安排職涯銜接。",
      "企業可由服務入口建立合作需求，填寫職缺、實習內容與面試可安排時段。",
    ],
  },
  {
    date: "2026.10.24",
    title: "線上問卷與佐證資料填寫說明",
    summary: "四類問卷均採登入後線上填寫，資料可作為審查與媒合依據。",
    body: [
      "學生登入後可選擇整合背景、車輛保養修護、整車銷售或零組件材料問卷。",
      "請依實際技能、實習或工作經驗填寫；送出後可由校方審查並進入媒合流程。",
    ],
  },
  {
    date: "2026.10.24",
    title: "廠商職缺登錄與線上媒合開放",
    summary: "合作企業可登入後建立需求、提供技能條件與可面試時段。",
    body: [
      "校方審查候選人問卷後，會依職缺專業類別推薦合適人選。",
      "媒合結果與面試排程將保留在廠商工作台，避免以公開頁面揭露個資。",
    ],
  },
];
const localizedNotices: Partial<Record<AppLanguage, ContentItem[]>> = {
  en: [
    { date: "2026.10.06", title: "2026–27 New-Type Programme Admission", summary: "Eligibility, programme structure, application steps and support." , body: ["This is a two-year STEM bachelor’s programme starting in February 2027.", "Create an account, complete your application and documents, then wait for review and interview updates."] },
    { date: "2026.10.06", title: "Preparing international student documents", summary: "Chinese A2, personal details and interview documents.", body: ["Prepare your identity document, highest education record, transcripts, language evidence and motivation statement."] },
    { date: "2026.10.06", title: "Industry internship and living allowance", summary: "Partner companies, internships and career pathways.", body: ["Partners provide internship opportunities and career support in accordance with programme rules."] },
    { date: "2026.10.24", title: "Online questionnaire and supporting documents", summary: "Complete the relevant online form after signing in.", body: ["Students submit application and skills information. Schools review it before matching."] },
    { date: "2026.10.24", title: "Company job registration and online matching", summary: "Partner companies can register roles, skills and interview availability.", body: ["The school reviews candidates and only shares matched candidates with the relevant company."] },
  ],
  id: [
    { date: "2026.10.06", title: "Informasi Penerimaan Program Baru Tahun 115", summary: "Syarat, sistem studi, proses pendaftaran, dan dukungan.", body: ["Program sarjana STEM ini berlangsung dua tahun dan diperkirakan mulai Februari 2027.", "Buat akun, isi pendaftaran dan dokumen, lalu tunggu hasil peninjauan serta wawancara."] },
    { date: "2026.10.06", title: "Persiapan dokumen mahasiswa internasional", summary: "Kemampuan Mandarin A2, data dasar, dan dokumen wawancara.", body: ["Siapkan dokumen identitas, ijazah, nilai, bukti bahasa, dan motivasi pendaftaran."] },
    { date: "2026.10.06", title: "Magang industri dan tunjangan hidup", summary: "Perusahaan mitra, kesempatan magang, dan jalur karier.", body: ["Perusahaan mitra menyediakan kesempatan magang dan dukungan karier sesuai ketentuan program."] },
    { date: "2026.10.24", title: "Kuesioner online dan dokumen pendukung", summary: "Isi formulir yang sesuai setelah masuk.", body: ["Mahasiswa mengirim data pendaftaran dan keterampilan. Kampus meninjau sebelum pencocokan."] },
    { date: "2026.10.24", title: "Pendaftaran lowongan perusahaan dan pencocokan online", summary: "Mitra dapat mengisi lowongan, keterampilan, dan waktu wawancara.", body: ["Kampus meninjau kandidat dan hanya membagikan kandidat yang telah dicocokkan kepada perusahaan terkait."] },
  ],
  vi: [
    { date: "2026.10.06", title: "Thông tin tuyển sinh Chương trình mới năm 115", summary: "Điều kiện, chương trình học, quy trình đăng ký và hỗ trợ.", body: ["Đây là chương trình cử nhân STEM hai năm, dự kiến nhập học tháng 2 năm 2027.", "Tạo tài khoản, hoàn thành hồ sơ và giấy tờ, sau đó chờ xét duyệt và thông báo phỏng vấn."] },
    { date: "2026.10.06", title: "Chuẩn bị hồ sơ sinh viên quốc tế", summary: "Năng lực tiếng Trung A2, thông tin cơ bản và hồ sơ phỏng vấn.", body: ["Chuẩn bị giấy tờ tùy thân, bằng cấp, bảng điểm, chứng chỉ ngoại ngữ và động lực đăng ký."] },
    { date: "2026.10.06", title: "Thực tập doanh nghiệp và hỗ trợ sinh hoạt", summary: "Doanh nghiệp đối tác, cơ hội thực tập và định hướng nghề nghiệp.", body: ["Doanh nghiệp đối tác cung cấp cơ hội thực tập và hỗ trợ nghề nghiệp theo quy định chương trình."] },
    { date: "2026.10.24", title: "Khảo sát trực tuyến và giấy tờ chứng minh", summary: "Điền biểu mẫu phù hợp sau khi đăng nhập.", body: ["Sinh viên nộp thông tin hồ sơ và kỹ năng; nhà trường xét duyệt trước khi ghép nối."] },
    { date: "2026.10.24", title: "Đăng ký vị trí doanh nghiệp và ghép nối trực tuyến", summary: "Đối tác có thể đăng ký vị trí, kỹ năng và thời gian phỏng vấn.", body: ["Nhà trường xét duyệt ứng viên và chỉ chia sẻ ứng viên đã được ghép nối với doanh nghiệp liên quan."] },
  ],
};
const heroSlides = [
  {
    eyebrow: "LATEST NEWS ・ 2026",
    title: "2026 Vietnam–Taiwan Academic & Industry Exchange",
    summary:
      "TNUT 代表團與台灣車用電子協會交流，推動汽修人才與國際產業合作。",
    action: "閱讀新聞",
    target: "news",
  },
  {
    eyebrow: "ADMISSION ・ 115",
    title: "115 學年度新型專班招生資訊",
    summary:
      "一次完成申請與問卷；經校方審核後，依專長進入企業媒合與線上面試流程。",
    action: "查看招生流程",
    target: "admission",
  },
];
const questionnaireSkills: Record<string, string[]> = {
  integrated: [
    "學習能力",
    "工作責任感",
    "團隊合作能力",
    "溝通能力",
    "工作紀律",
    "抗壓能力",
    "解決問題能力",
  ],
  maintenance: [
    "手工具辨識與使用",
    "工作場所安全",
    "車輛基本檢查",
    "更換機油及濾芯",
    "輪胎拆裝及胎壓檢查",
    "煞車系統基本保養",
    "萬用電表使用",
    "基礎故障診斷",
    "引擎與底盤保養",
    "冷氣與電系統檢查",
    "OBD 診斷儀操作",
    "保養工單與維修紀錄",
  ],
  sales: [
    "車型與產品知識",
    "客戶接待",
    "客戶需求分析",
    "產品介紹與試駕說明",
    "報價與議價",
    "合約與交車流程",
    "CRM 客戶管理",
    "售後關懷與客訴處理",
    "市場與競品分析",
    "F&I／保險與貸款說明",
    "二手車估價與收購流程",
    "數位行銷與銷售資料分析",
  ],
  parts: [
    "零件名稱與料號辨識",
    "車型與零件配適性",
    "原廠／副廠／OEM 零件辨識",
    "報價與訂單處理",
    "庫存盤點與管理",
    "ERP／POS／庫存系統",
    "到貨驗收與上架",
    "包裝與物流配送",
    "供應商詢價與採購",
    "進出口與國際貿易文件",
    "定價、毛利與成本概念",
    "電商平台與客戶資料管理",
  ],
  electrics: [
    "車用電系統安全",
    "電動車高壓安全觀念",
    "萬用電表與基本量測",
    "12V 電瓶檢查與保養",
    "充電系統與充電規範",
    "車載感測器基本認識",
    "故障碼讀取與初步判讀",
    "線路圖與接頭辨識",
    "電動車保養流程",
    "工作紀錄與安全通報",
  ],
};
const roles: Array<{
  role: PortalRole;
  icon: typeof GraduationCap;
  title: Record<AppLanguage, string>;
}> = [
  {
    role: "student",
    icon: GraduationCap,
    title: {
      "zh-TW": "學生申請",
      en: "Student application",
      id: "Pendaftaran mahasiswa",
      vi: "Nộp hồ sơ sinh viên",
    },
  },
  {
    role: "school",
    icon: Building2,
    title: {
      "zh-TW": "協會管理",
      en: "Association management",
      id: "Manajemen asosiasi",
      vi: "Quản lý hiệp hội",
    },
  },
  {
    role: "company",
    icon: BriefcaseBusiness,
    title: {
      "zh-TW": "廠商合作",
      en: "Company partnership",
      id: "Kerja sama perusahaan",
      vi: "Hợp tác doanh nghiệp",
    },
  },
  {
    role: "agency",
    icon: Handshake,
    title: {
      "zh-TW": "留學代辦",
      en: "Agency portal",
      id: "Portal agen",
      vi: "Cổng đại diện",
    },
  },
];
const serviceDescriptions: Record<AppLanguage, Record<PortalRole, string>> = {
  "zh-TW": {
    student: "建立申請資料、填寫專業問卷，並查看審查、媒合與面試通知。",
    school: "由協會審查申請資料、管理流程、推薦候選人並安排線上面試。",
    company: "建立職缺與技能需求、查看推薦候選人並安排面試時段。",
    agency: "協助學生建立帳號、追蹤文件進度與跨國申請聯繫。",
  },
  en: {
    student:
      "Create an application, complete a professional questionnaire and view review, matching and interview updates.",
    school:
      "Review applications, manage the programme, recommend candidates and arrange interviews.",
    company:
      "Create job requirements, view recommended candidates and arrange interview times.",
    agency:
      "Help students create accounts, track documents and coordinate cross-border applications.",
  },
  id: {
    student:
      "Buat pendaftaran, isi kuesioner keahlian, dan lihat pembaruan peninjauan, pencocokan, serta wawancara.",
    school:
      "Tinjau pendaftaran, kelola program, rekomendasikan kandidat, dan atur wawancara.",
    company:
      "Buat kebutuhan lowongan, lihat kandidat rekomendasi, dan atur jadwal wawancara.",
    agency:
      "Bantu mahasiswa membuat akun, melacak dokumen, dan mengoordinasikan pendaftaran lintas negara.",
  },
  vi: {
    student:
      "Tạo hồ sơ, điền khảo sát chuyên môn và xem cập nhật xét duyệt, ghép nối và phỏng vấn.",
    school:
      "Xét duyệt hồ sơ, quản lý chương trình, đề xuất ứng viên và sắp xếp phỏng vấn.",
    company:
      "Tạo nhu cầu tuyển dụng, xem ứng viên được đề xuất và sắp xếp lịch phỏng vấn.",
    agency:
      "Hỗ trợ sinh viên tạo tài khoản, theo dõi hồ sơ và điều phối đăng ký xuyên quốc gia.",
  },
};

const formCopy: Record<AppLanguage, Record<string, string>> = {
  "zh-TW": {
    studentTitle: "選擇申請與專業問卷", studentHint: "請依你的背景與職涯方向選擇問卷。每一份問卷都會儲存在你的帳號中，供校方審核與企業媒合使用。",
    integrated: "整合背景調查", integratedHint: "基本資料、語言能力、職涯方向與面試時間。", maintenance: "車輛保養修護", maintenanceHint: "工具操作、維修技能、安全與保養經驗。", sales: "整車銷售", salesHint: "產品知識、客戶接待、銷售與售後服務。", parts: "零組件材料", partsHint: "零件辨識、庫存物流、採購與供應鏈操作。", electrics: "電動車與車輛電子", electricsHint: "電系安全、充電、基礎診斷與電動車保養。",
    formHint: "請在線上填寫。送出後資料將用於校方審查、企業媒合與面試安排。", basic: "基本資料", nameEn: "英文姓名", nameZh: "中文姓名", phone: "電話／Zalo／WhatsApp", nationality: "國籍", education: "最高學歷", graduation: "畢業年份", residence: "目前居住地", schoolMajor: "畢業學校與科系", languageCareer: "語言、技能與職涯", chinese: "中文能力", english: "英文能力", experience: "工作經驗（年）", training: "是否願意接受 3–6 個月中文培訓", first: "第一志願", second: "第二志願", employer: "曾任職公司／實習單位", salary: "薪資與福利期待", strength: "最擅長技術／實習或工作經驗", interview: "可面試時段", evidence: "證照、作品或履歷連結（可填多項）", skills: "專業技能自評", skillHint: "請依目前實際操作或實習／工作經驗，逐項選擇程度。", consent: "我同意資料提供合作企業進行人才媒合。", declaration: "我確認以上資料皆為真實。", submit: "送出線上問卷", select: "請選擇", back: "返回網站首頁",
  },
  en: {
    studentTitle: "Choose an application and skills questionnaire", studentHint: "Choose the questionnaire that matches your background and career direction. Each submission is saved to your account for school review and company matching.",
    integrated: "Integrated background survey", integratedHint: "Profile, language ability, career direction and interview availability.", maintenance: "Vehicle maintenance", maintenanceHint: "Tool use, repair skills, safety and maintenance experience.", sales: "Vehicle sales", salesHint: "Product knowledge, customer service, sales and after-sales support.", parts: "Parts and materials", partsHint: "Parts identification, inventory, logistics, purchasing and supply-chain work.", electrics: "Electric vehicles and automotive electronics", electricsHint: "Electrical safety, charging, basic diagnostics and EV maintenance.",
    formHint: "Complete this form online. Your information will be used for school review, company matching and interview arrangements.", basic: "Basic information", nameEn: "English name", nameZh: "Chinese name", phone: "Phone / Zalo / WhatsApp", nationality: "Nationality", education: "Highest education", graduation: "Graduation year", residence: "Current residence", schoolMajor: "School and major", languageCareer: "Language, skills and career", chinese: "Chinese ability", english: "English ability", experience: "Work experience (years)", training: "Willing to take 3–6 months of Chinese training", first: "First preference", second: "Second preference", employer: "Previous employer / internship", salary: "Salary and benefits expectation", strength: "Strongest skills / internship or work experience", interview: "Interview availability", evidence: "Certificate, portfolio or CV links (multiple allowed)", skills: "Skills self-assessment", skillHint: "Choose a level for each item according to your actual practice, internship or work experience.", consent: "I agree that my information may be shared with partner companies for matching.", declaration: "I confirm that the information above is true.", submit: "Submit questionnaire", select: "Please select", back: "Back to website",
  },
  id: {
    studentTitle: "Pilih pendaftaran dan kuesioner keahlian", studentHint: "Pilih kuesioner sesuai latar belakang dan arah karier Anda. Setiap kiriman tersimpan di akun Anda untuk ditinjau kampus dan dicocokkan dengan perusahaan.",
    integrated: "Survei latar belakang terpadu", integratedHint: "Profil, kemampuan bahasa, arah karier, dan waktu wawancara.", maintenance: "Perawatan kendaraan", maintenanceHint: "Penggunaan alat, keterampilan perbaikan, keselamatan, dan pengalaman perawatan.", sales: "Penjualan kendaraan", salesHint: "Pengetahuan produk, layanan pelanggan, penjualan, dan purnajual.", parts: "Suku cadang dan material", partsHint: "Pengenalan suku cadang, stok, logistik, pembelian, dan rantai pasok.", electrics: "Kendaraan listrik dan elektronika otomotif", electricsHint: "Keselamatan kelistrikan, pengisian daya, diagnosis dasar, dan perawatan kendaraan listrik.",
    formHint: "Isi formulir ini secara online. Data akan digunakan untuk peninjauan kampus, pencocokan perusahaan, dan pengaturan wawancara.", basic: "Data dasar", nameEn: "Nama bahasa Inggris", nameZh: "Nama bahasa Mandarin", phone: "Telepon / Zalo / WhatsApp", nationality: "Kewarganegaraan", education: "Pendidikan tertinggi", graduation: "Tahun kelulusan", residence: "Tempat tinggal saat ini", schoolMajor: "Sekolah dan jurusan", languageCareer: "Bahasa, keterampilan, dan karier", chinese: "Kemampuan Mandarin", english: "Kemampuan bahasa Inggris", experience: "Pengalaman kerja (tahun)", training: "Bersedia mengikuti pelatihan Mandarin 3–6 bulan", first: "Pilihan pertama", second: "Pilihan kedua", employer: "Perusahaan / tempat magang sebelumnya", salary: "Harapan gaji dan tunjangan", strength: "Keterampilan terbaik / pengalaman magang atau kerja", interview: "Waktu wawancara", evidence: "Tautan sertifikat, portofolio, atau CV (boleh lebih dari satu)", skills: "Penilaian mandiri keterampilan", skillHint: "Pilih tingkat setiap butir sesuai pengalaman praktik, magang, atau kerja Anda.", consent: "Saya setuju informasi saya dibagikan kepada perusahaan mitra untuk pencocokan.", declaration: "Saya menyatakan data di atas benar.", submit: "Kirim kuesioner", select: "Pilih", back: "Kembali ke situs",
  },
  vi: {
    studentTitle: "Chọn hồ sơ và bảng khảo sát kỹ năng", studentHint: "Chọn bảng khảo sát phù hợp với nền tảng và định hướng nghề nghiệp của bạn. Mỗi bài nộp được lưu trong tài khoản để nhà trường xét duyệt và ghép nối doanh nghiệp.",
    integrated: "Khảo sát nền tảng tổng hợp", integratedHint: "Hồ sơ, năng lực ngôn ngữ, định hướng nghề nghiệp và thời gian phỏng vấn.", maintenance: "Bảo dưỡng xe", maintenanceHint: "Sử dụng dụng cụ, kỹ năng sửa chữa, an toàn và kinh nghiệm bảo dưỡng.", sales: "Kinh doanh xe", salesHint: "Kiến thức sản phẩm, tiếp đón khách hàng, bán hàng và hậu mãi.", parts: "Linh kiện và vật liệu", partsHint: "Nhận diện linh kiện, tồn kho, logistics, mua hàng và chuỗi cung ứng.", electrics: "Xe điện và điện tử ô tô", electricsHint: "An toàn điện, sạc, chẩn đoán cơ bản và bảo dưỡng xe điện.",
    formHint: "Điền biểu mẫu trực tuyến. Thông tin sẽ được dùng để nhà trường xét duyệt, ghép nối doanh nghiệp và sắp xếp phỏng vấn.", basic: "Thông tin cơ bản", nameEn: "Họ tên tiếng Anh", nameZh: "Họ tên tiếng Trung", phone: "Điện thoại / Zalo / WhatsApp", nationality: "Quốc tịch", education: "Trình độ học vấn cao nhất", graduation: "Năm tốt nghiệp", residence: "Nơi ở hiện tại", schoolMajor: "Trường và chuyên ngành", languageCareer: "Ngôn ngữ, kỹ năng và nghề nghiệp", chinese: "Năng lực tiếng Trung", english: "Năng lực tiếng Anh", experience: "Kinh nghiệm làm việc (năm)", training: "Sẵn sàng học tiếng Trung 3–6 tháng", first: "Nguyện vọng 1", second: "Nguyện vọng 2", employer: "Công ty / nơi thực tập trước đây", salary: "Kỳ vọng lương và phúc lợi", strength: "Kỹ năng nổi bật / kinh nghiệm thực tập hoặc làm việc", interview: "Thời gian có thể phỏng vấn", evidence: "Liên kết chứng chỉ, hồ sơ năng lực hoặc CV (có thể nhiều liên kết)", skills: "Tự đánh giá kỹ năng", skillHint: "Chọn mức độ cho từng mục theo kinh nghiệm thực hành, thực tập hoặc làm việc thực tế.", consent: "Tôi đồng ý chia sẻ thông tin với doanh nghiệp đối tác để ghép nối.", declaration: "Tôi xác nhận thông tin trên là đúng sự thật.", submit: "Gửi bảng khảo sát", select: "Vui lòng chọn", back: "Quay lại website",
  },
};

const homeCopy: Record<AppLanguage, Record<string, string>> = {
  "zh-TW": { heroSummary: "TNUT 代表團與台灣車用電子協會交流，推動汽修人才與國際產業合作。", admissionLabel: "人才培育資訊", start: "預計開班", degree: "汽修人才專班", a2: "語言門檻", tocfl: "補助續領條件", programme: "專班資源", company: "合作廠商專區", partner: "我要提供合作連結" },
  en: { heroSummary: "TNUT representatives exchanged with the Taiwan Automotive Electronics Association on automotive talent and international industry cooperation.", admissionLabel: "Talent programme", start: "Expected intake", degree: "Automotive talent programme", a2: "Language requirement", tocfl: "Scholarship continuation", programme: "Programme resources", company: "Partner companies", partner: "Provide a partnership link" },
  id: { heroSummary: "Delegasi TNUT berdiskusi dengan Taiwan Automotive Electronics Association tentang talenta otomotif dan kerja sama industri internasional.", admissionLabel: "Program talenta", start: "Perkiraan pembukaan", degree: "Program talenta otomotif", a2: "Syarat bahasa", tocfl: "Syarat kelanjutan bantuan", programme: "Sumber daya program", company: "Area mitra perusahaan", partner: "Berikan tautan kerja sama" },
  vi: { heroSummary: "Đoàn TNUT trao đổi với Hiệp hội Điện tử Ô tô Đài Loan về nhân lực ô tô và hợp tác công nghiệp quốc tế.", admissionLabel: "Chương trình nhân lực", start: "Dự kiến mở lớp", degree: "Chương trình nhân lực ô tô", a2: "Điều kiện ngôn ngữ", tocfl: "Điều kiện tiếp tục hỗ trợ", programme: "Tài nguyên chương trình", company: "Khu vực doanh nghiệp đối tác", partner: "Cung cấp liên kết hợp tác" },
};

export function ProgramOnboarding({
  language,
  onLanguageChange,
  onComplete,
  authenticatedRole = null,
  onOpenLegacyPrep,
}: Props) {
  const [page, setPage] = useState<Page>("home");
  const restoringHistory = useRef(false);
  const [contentKind, setContentKind] = useState<ContentKind>("news");
  const [questionnaireType, setQuestionnaireType] = useState("integrated");
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPointerX, setHeroPointerX] = useState<number | null>(null);
  const [heroPaused, setHeroPaused] = useState(false);
  const [noticeIndex, setNoticeIndex] = useState(0);
  const [role, setRole] = useState<PortalRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountMode, setAccountMode] = useState<"register" | "signin">(
    "register",
  );
  const [busy, setBusy] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "line" | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [matchingJobs, setMatchingJobs] = useState<
    Array<{
      id: string;
      position_title: string;
      status: string;
      headcount: number;
      specialisation: string;
    }>
  >([]);
  const [matchingError, setMatchingError] = useState("");
  const [schoolSubmissions, setSchoolSubmissions] = useState<
    Array<{
      id: string;
      applicant_name_en: string | null;
      applicant_name_zh: string | null;
      questionnaire_type: string;
      status: string;
      career_preference: string | null;
    }>
  >([]);
  const [schoolJobs, setSchoolJobs] = useState<
    Array<{
      id: string;
      company_name: string;
      position_title: string;
      specialisation: string;
      status: string;
    }>
  >([]);
  const [schoolMatches, setSchoolMatches] = useState<
    Array<{
      id: string;
      status: string;
      questionnaire_submission_id: string;
      job_requirement_id: string;
      program_questionnaire_submissions: Array<{
        applicant_name_zh: string | null;
        applicant_name_en: string | null;
      }>;
      program_job_requirements: Array<{
        company_name: string;
        position_title: string;
      }>;
    }>
  >([]);
  const [studentSubmissions, setStudentSubmissions] = useState<Array<{
    id: string;
    questionnaire_type: string;
    status: string;
    submitted_at: string | null;
  }>>([]);
  const [studentInterviews, setStudentInterviews] = useState<Array<{
    id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    meeting_url: string | null;
  }>>([]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantArrived, setAssistantArrived] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: "assistant" | "user"; text: string; sources?: Array<{ label: string; url: string }> }>>([]);
  const [assistantText, setAssistantText] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantReply, setAssistantReply] = useState(
    "你好，我可以協助你確認申請資格、準備資料、了解中文條件與在臺生活資訊。",
  );
  const [assistantAction, setAssistantAction] =
    useState<AssistantAction>("admission");
  const [assistantActionLabel, setAssistantActionLabel] =
    useState("查看招生資訊");
  const selectedRole = roles.find((item) => item.role === role);
  const googleEnabled = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === "true";
  const t = ui[language];
  const q = formCopy[language];
  const h = homeCopy[language];
  const w = {
    "zh-TW": { back: "返回網站首頁", agencyTag: "代辦資料", agencyTitle: "留學代辦資料", agencyHint: "填寫機構服務資訊與學生支持需求。資料送出後，由校方審核並安排推薦學生的後續追蹤。", agencyLegend: "機構與聯絡資料", organisation: "機構名稱", contact: "聯絡人", email: "聯絡 Email", phone: "電話／WhatsApp／Zalo", country: "主要服務國家／地區", service: "代辦服務與學生招募說明", support: "推薦學生目前需要的協助", submitAgency: "送出代辦資料", companyTag: "廠商工作台", companyTitle: "廠商職缺與線上媒合", companyHint: "線上建立職缺需求；送出後由校方審核，並在媒合工作台安排候選人與面試。", companyLegend: "合作企業與職缺", companyName: "公司名稱", headcount: "需求人數", speciality: "專業類別", position: "職缺名稱", jobDescription: "工作內容、必要技能與待遇", availability: "可安排的線上面試時段", submitJob: "送出職缺需求", matching: "進入媒合與面試工作台", schoolTag: "校方工作台", schoolTitle: "校方審核與媒合工作台", schoolHint: "在同一個帳號中檢視學生申請與企業職缺，將候選人列入媒合名單；後續可建立面試時段。", pending: "待處理資料", schoolAccess: "僅授權的校方管理帳號可查看此頁；資料不會公開於網站。" },
    en: { back: "Back to website", agencyTag: "AGENCY PROFILE", agencyTitle: "Education agency profile", agencyHint: "Provide your organisation’s services and student-support needs. The school reviews the submission before coordinating follow-up for referred students.", agencyLegend: "Organisation and contact details", organisation: "Organisation name", contact: "Contact person", email: "Contact email", phone: "Phone / WhatsApp / Zalo", country: "Main service country / region", service: "Agency services and student recruitment", support: "Support currently needed by referred students", submitAgency: "Submit agency profile", companyTag: "COMPANY WORKSPACE", companyTitle: "Company jobs and online matching", companyHint: "Create a job requirement online. After school review, use the matching workspace to coordinate candidates and interviews.", companyLegend: "Partner company and role", companyName: "Company name", headcount: "Number of openings", speciality: "Specialisation", position: "Position title", jobDescription: "Job duties, required skills and compensation", availability: "Available online interview times", submitJob: "Submit job requirement", matching: "Open matching and interview workspace", schoolTag: "SCHOOL WORKSPACE", schoolTitle: "School review and matching workspace", schoolHint: "Review student applications and company openings in one account, shortlist candidates, then create interview times.", pending: "Items to review", schoolAccess: "Only authorised school administrators can view this workspace; information is never public." },
    id: { back: "Kembali ke situs", agencyTag: "PROFIL AGEN", agencyTitle: "Data agen pendidikan", agencyHint: "Isi layanan organisasi dan kebutuhan dukungan mahasiswa. Kampus meninjau data sebelum menindaklanjuti mahasiswa yang direkomendasikan.", agencyLegend: "Data organisasi dan kontak", organisation: "Nama organisasi", contact: "Narahubung", email: "Email narahubung", phone: "Telepon / WhatsApp / Zalo", country: "Negara / wilayah layanan utama", service: "Layanan agen dan penjelasan rekrutmen mahasiswa", support: "Dukungan yang saat ini diperlukan mahasiswa rujukan", submitAgency: "Kirim data agen", companyTag: "RUANG KERJA PERUSAHAAN", companyTitle: "Lowongan perusahaan dan pencocokan online", companyHint: "Buat kebutuhan lowongan secara online. Setelah ditinjau kampus, gunakan ruang pencocokan untuk mengatur kandidat dan wawancara.", companyLegend: "Perusahaan mitra dan lowongan", companyName: "Nama perusahaan", headcount: "Jumlah kebutuhan", speciality: "Bidang keahlian", position: "Nama posisi", jobDescription: "Tugas, keterampilan wajib, dan kompensasi", availability: "Waktu wawancara online yang tersedia", submitJob: "Kirim kebutuhan lowongan", matching: "Buka ruang pencocokan dan wawancara", schoolTag: "RUANG KERJA KAMPUS", schoolTitle: "Ruang kerja peninjauan dan pencocokan kampus", schoolHint: "Tinjau pendaftaran mahasiswa dan lowongan perusahaan dalam satu akun, pilih kandidat, lalu buat jadwal wawancara.", pending: "Data untuk ditinjau", schoolAccess: "Hanya administrator kampus yang berwenang dapat melihat halaman ini; data tidak dipublikasikan." },
    vi: { back: "Quay lại website", agencyTag: "HỒ SƠ ĐƠN VỊ TƯ VẤN", agencyTitle: "Thông tin đơn vị tư vấn du học", agencyHint: "Điền thông tin dịch vụ và nhu cầu hỗ trợ sinh viên. Nhà trường sẽ xét duyệt trước khi theo dõi sinh viên được giới thiệu.", agencyLegend: "Thông tin đơn vị và liên hệ", organisation: "Tên đơn vị", contact: "Người liên hệ", email: "Email liên hệ", phone: "Điện thoại / WhatsApp / Zalo", country: "Quốc gia / khu vực phục vụ chính", service: "Dịch vụ tư vấn và mô tả tuyển sinh", support: "Hỗ trợ hiện cần cho sinh viên được giới thiệu", submitAgency: "Gửi thông tin đơn vị", companyTag: "KHÔNG GIAN DOANH NGHIỆP", companyTitle: "Vị trí doanh nghiệp và ghép nối trực tuyến", companyHint: "Tạo nhu cầu tuyển dụng trực tuyến. Sau khi nhà trường xét duyệt, dùng không gian ghép nối để sắp xếp ứng viên và phỏng vấn.", companyLegend: "Doanh nghiệp đối tác và vị trí", companyName: "Tên công ty", headcount: "Số lượng cần tuyển", speciality: "Lĩnh vực chuyên môn", position: "Tên vị trí", jobDescription: "Nội dung công việc, kỹ năng bắt buộc và đãi ngộ", availability: "Thời gian phỏng vấn trực tuyến có thể sắp xếp", submitJob: "Gửi nhu cầu tuyển dụng", matching: "Mở không gian ghép nối và phỏng vấn", schoolTag: "KHÔNG GIAN NHÀ TRƯỜNG", schoolTitle: "Không gian xét duyệt và ghép nối của nhà trường", schoolHint: "Xem hồ sơ sinh viên và vị trí doanh nghiệp trong một tài khoản, chọn ứng viên rồi tạo lịch phỏng vấn.", pending: "Dữ liệu cần xử lý", schoolAccess: "Chỉ quản trị viên nhà trường được cấp quyền mới xem được trang này; dữ liệu không công khai." },
  }[language];
  const documentCopy = {
    "zh-TW": { title: "身分與學歷文件", hint: "請上傳清楚可辨識的檔案。文件儲存在受保護的申請資料庫，不會公開於網站；只有你與授權校方審核人員可查看。", identity: "身分證或護照", education: "最高學歷證明", transcript: "成績單、履歷或作品集（選填）" },
    en: { title: "Identity and education documents", hint: "Upload clear, readable files. Documents are stored in a protected application record and are not public; only you and authorised school reviewers can access them.", identity: "National ID or passport", education: "Highest education certificate", transcript: "Transcript, CV or portfolio (optional)" },
    id: { title: "Dokumen identitas dan pendidikan", hint: "Unggah file yang jelas dan dapat dibaca. Dokumen disimpan dalam data aplikasi yang terlindungi dan tidak dipublikasikan; hanya Anda dan peninjau kampus berwenang yang dapat mengaksesnya.", identity: "KTP atau paspor", education: "Bukti pendidikan tertinggi", transcript: "Transkrip, CV, atau portofolio (opsional)" },
    vi: { title: "Giấy tờ định danh và học vấn", hint: "Tải lên tệp rõ ràng, có thể đọc được. Tài liệu được lưu trong hồ sơ ứng tuyển được bảo vệ và không công khai; chỉ bạn và người xét duyệt được ủy quyền của nhà trường mới có thể xem.", identity: "CCCD hoặc hộ chiếu", education: "Bằng cấp cao nhất", transcript: "Bảng điểm, CV hoặc hồ sơ năng lực (không bắt buộc)" },
  }[language];
  const assistantLabel =
    language === "en"
      ? "Need help?"
      : language === "id"
        ? "Butuh bantuan?"
        : language === "vi"
          ? "Cần hỗ trợ?"
          : "需要協助？";
  const assistantArrivalGuide =
    page === "student" || page === "questionnaire" || page === "student-progress"
      ? "這裡可以填申請、上傳文件、查看面試與報到進度；點我可直接問下一步。"
      : page === "school"
        ? "這裡可以審核申請、安排面試、發出錄取與追蹤來臺報到。"
        : page === "company" || page === "matching"
          ? "這裡可以建立企業資料與職缺，並查看校方推薦的候選人與面試。"
          : page === "agency"
            ? "這裡可以建立推薦學生、追蹤申請與面試進度，並聯繫校方。"
            : "你可先看公告與招生資訊；需要申請、校方、企業或代辦入口，直接點我。";
  const displayedAnnouncements = localizedNotices[language] ?? announcements;
  const activeItems = contentKind === "news" ? news : displayedAnnouncements;
  const currentNotice = activeItems[noticeIndex] ?? activeItems[0];
  useEffect(() => {
    const restorePage = (event: PopStateEvent) => {
      const nextPage = event.state?.programPortalPage as Page | undefined;
      if (!nextPage) return;
      restoringHistory.current = true;
      setPage(nextPage);
    };
    window.history.replaceState({ programPortalPage: "home" }, "");
    window.addEventListener("popstate", restorePage);
    return () => window.removeEventListener("popstate", restorePage);
  }, []);
  useEffect(() => {
    const arrivalTimer = window.setTimeout(() => setAssistantArrived(true), 700);
    return () => window.clearTimeout(arrivalTimer);
  }, []);
  useEffect(() => {
    if (restoringHistory.current) {
      restoringHistory.current = false;
      return;
    }
    if (page !== "home")
      window.history.pushState({ programPortalPage: page }, "");
  }, [page]);
  useEffect(() => {
    if (page !== "home" || heroPaused) return;
    const timer = window.setInterval(
      () => setHeroIndex((index) => (index + 1) % heroSlides.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [page, heroPaused]);
  useEffect(() => {
    if (!authenticatedRole) return;
    setRole(authenticatedRole);
    setMessage("");
    if (authenticatedRole === "student") {
      setPage("student");
      return;
    }
    if (authenticatedRole === "company") {
      setPage("company");
      return;
    }
    if (authenticatedRole === "school") {
      void openSchoolWorkspace();
      return;
    }
    if (authenticatedRole === "agency") {
      setPage("agency");
      return;
    }
    setPage("resources");
  }, [authenticatedRole]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error_description") || params.get("error");
    if (!oauthError) return;
    setRole("student");
    setAccountMode("signin");
    setMessage("登入未完成，請再試一次或改用其他登入方式。");
    setPage("account");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);
  const openNotice = (index: number, kind: ContentKind = contentKind) => {
    setContentKind(kind);
    setNoticeIndex(index);
    setPage("notice");
  };
  const startRole = (
    nextRole?: PortalRole,
    mode: "register" | "signin" = "signin",
  ) => {
    if (!nextRole) {
      setRole(null);
      setMessage("");
      setPage("roles");
      return;
    }
    // Email confirmation returns to a fresh auth callback. Persist the role
    // before registration/login so that callback cannot fall back to a role
    // selected by a previously used account in the same browser.
    window.localStorage.setItem("program-pending-role", nextRole);
    setRole(nextRole);
    setAccountMode(mode);
    setMessage("");
    setPage("account");
  };
  const scrollTo = (id: string) =>
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  const clearOauthState = () => {
    setBusy(false);
    setOauthProvider(null);
  };
  const authenticateOAuth = async (provider: "google" | "line") => {
    const selectedRole = role ?? "student";
    window.localStorage.setItem("program-pending-role", selectedRole);
    if (provider === "google" && !googleEnabled) {
      setMessage(
        "Google 登入尚未由系統管理者啟用，請先使用 Email 註冊或登入。",
      );
      return;
    }
    setBusy(true);
    setOauthProvider(provider);
    setMessage("");
    try {
      const redirectTo =
        window.location.hostname === "localhost"
          ? "https://line-attendance-system-one.vercel.app"
          : window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: (provider === "line" ? "custom:line-oauth2" : "google") as never,
        options: { redirectTo },
      });
      if (error) {
        setMessage(error.message);
        clearOauthState();
        return;
      }
      // A provider normally redirects this page. If it was cancelled in a
      // popup or blocked by the browser, never leave the account screen locked.
      window.setTimeout(() => {
        clearOauthState();
        setMessage("登入流程未完成；你可以再次選擇登入方式。");
      }, 15000);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "登入流程無法啟動，請再試一次。",
      );
      clearOauthState();
    }
  };
  const authenticateEmail = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result =
      accountMode === "register"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { requested_role: role, preferred_language: language },
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setMessage(result.error.message);
      setBusy(false);
      return;
    }
    if (accountMode === "register" && !result.data.session) {
      setMessage("驗證信已寄出，請完成 Email 驗證後回來登入。");
      setBusy(false);
      return;
    }
    setBusy(false);
    onComplete(role ?? "student");
    if (role === "school") {
      return;
    }
    if (role === "company") {
      return;
    }
  };
  const goHomeAnd = (id: string) => {
    setPage("home");
    window.setTimeout(() => scrollTo(id), 0);
  };
  const runAssistantAction = (action: AssistantAction) => {
    if (!action) return;
    if (action === "apply") return startRole();
    if (action === "student") return startRole("student", "signin");
    if (action === "school") return startRole("school", "signin");
    if (action === "company") return startRole("company", "signin");
    if (action === "agency") return startRole("agency", "signin");
    if (action === "admission") return goHomeAnd("admission");
    if (action === "a2") return setPage("a2");
    if (action === "resources") return setPage("resources");
    if (action === "news") {
      setContentKind("news");
      return setPage("notices");
    }
    if (action === "notices") {
      setContentKind("announcement");
      return setPage("notices");
    }
  };
  const answerAssistant = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || assistantBusy) return;
    setAssistantBusy(true);
    let reply =
      "我可以協助申請資格、中文條件、文件準備、臺灣生活費，以及登入後的角色功能。";
    let action: AssistantAction = "admission";
    let actionLabel = "查看招生資訊";
    if (/生活|住宿|花費|預算|費用/.test(text)) {
      reply =
        "在臺生活可先以每月 NT$12,000–20,000 規劃：住宿約 NT$4,000–8,000、餐費約 NT$5,000–8,000；實際金額會依住宿和生活方式調整。";
      action = "resources";
      actionLabel = "查看資源與資訊";
    } else if (/中文|a2|tocfl|語言/.test(text.toLowerCase())) {
      reply = "入學中文條件為 A2；補助續領與後續學習條件請依招生資訊確認。";
      action = "a2";
      actionLabel = "查看中文條件";
    } else if (/文件|資料|證明|履歷|護照/.test(text)) {
      reply =
        "申請前先備妥個人基本資料、聯絡方式、語言能力與相關佐證；登入後可依表單逐步填寫。";
      action = "apply";
      actionLabel = "開始申請";
    } else if (/申請|報名|學生|問卷/.test(text)) {
      reply =
        "申請從建立帳號開始。登入後即可填寫申請資料與專業問卷，送出後再由校方審查。";
      action = "apply";
      actionLabel = "開始申請";
    } else if (/老師|教師|校方|審核/.test(text)) {
      reply = "校方與教師登入後可查看授權範圍內的申請、媒合與面試安排。";
      action = "school";
      actionLabel = "校方／教師登入";
    } else if (/廠商|企業|職缺|合作/.test(text)) {
      reply = "合作企業登入後可建立職缺需求、查看推薦候選人並安排面試時段。";
      action = "company";
      actionLabel = "企業登入";
    } else if (/代辦/.test(text)) {
      reply = "留學代辦可協助學生建立帳號、追蹤文件與進行跨國申請聯繫。";
      action = "agency";
      actionLabel = "代辦登入";
    } else if (/新聞/.test(text)) {
      reply = "這裡是平台的最新新聞與交流消息。";
      action = "news";
      actionLabel = "查看最新新聞";
    } else if (/公告/.test(text)) {
      reply = "這裡可查看招生、文件與流程相關的最新公告。";
      action = "notices";
      actionLabel = "查看全部公告";
    }
    setAssistantMessages((messages) => [...messages, { role: "user", text }]);
    try {
      const response = await fetch("/api/student-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "assistant", question: text, locale: language }),
      });
      if (response.ok) {
        const result = await response.json() as { text?: string; sources?: Array<{ label: string; url: string }> };
        reply = result.text?.trim() || reply;
        setAssistantMessages((messages) => [...messages, { role: "assistant", text: reply, sources: result.sources }]);
      } else {
        setAssistantMessages((messages) => [...messages, { role: "assistant", text: reply }]);
      }
    } catch {
      setAssistantMessages((messages) => [...messages, { role: "assistant", text: reply }]);
    } finally {
      setAssistantBusy(false);
    }
    setAssistantReply(reply);
    setAssistantAction(action);
    setAssistantActionLabel(actionLabel);
    setAssistantText("");
  };
  const changeHero = (direction: number) =>
    setHeroIndex(
      (index) => (index + direction + heroSlides.length) % heroSlides.length,
    );
  const openQuestionnaire = async (type: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setRole("student");
      setAccountMode("signin");
      setMessage(
        "請先登入或註冊帳號，登入後才可填寫與查看你的問卷、媒合及面試進度。",
      );
      setPage("account");
      return;
    }
    setQuestionnaireType(type);
    setMessage("");
    setPage("questionnaire");
  };
  const uploadApplicantDocument = async (
    userId: string,
    file: File | null,
    kind: string,
  ) => {
    if (!file || !file.name) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${kind}-${safeName}`;
    const { error } = await supabase.storage
      .from("program-application-documents")
      .upload(path, file, { upsert: false });
    if (error) throw error;
    return { kind, name: file.name, path, type: file.type || "application/octet-stream" };
  };
  const openCompanyWorkspace = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      startRole("company", "signin");
      setMessage("請先登入或註冊廠商帳號，登入後才可建立職缺並查看媒合結果。");
      return;
    }
    setPage("company");
  };
  const openStudentProgress = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      startRole("student", "signin");
      setMessage("請先登入，才能查看你的申請、媒合與面試通知。");
      return;
    }
    setBusy(true);
    setMatchingError("");
    const { data: submissions, error: submissionError } = await supabase
      .from("program_questionnaire_submissions")
      .select("id,questionnaire_type,status,submitted_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const submissionIds = (submissions ?? []).map((item) => item.id);
    let interviewData: Array<{ id: string; starts_at: string; ends_at: string; status: string; meeting_url: string | null }> = [];
    let interviewError: { message: string } | null = null;
    if (submissionIds.length) {
      const { data: matches, error: matchError } = await supabase
        .from("program_match_recommendations")
        .select("id")
        .in("questionnaire_submission_id", submissionIds);
      if (matchError) interviewError = matchError;
      const matchIds = (matches ?? []).map((item) => item.id);
      if (matchIds.length) {
        const { data, error } = await supabase
          .from("program_interview_slots")
          .select("id,starts_at,ends_at,status,meeting_url")
          .in("match_recommendation_id", matchIds)
          .order("starts_at", { ascending: true });
        interviewData = data ?? [];
        if (error) interviewError = error;
      }
    }
    setStudentSubmissions(submissions ?? []);
    setStudentInterviews(interviewData);
    setMatchingError(submissionError?.message ?? interviewError?.message ?? "");
    setBusy(false);
    setPage("student-progress");
  };
  const openAgencyWorkspace = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      startRole("agency", "signin");
      setMessage("請先登入或註冊代辦帳號，才能填寫代辦資料並追蹤推薦學生。");
      return;
    }
    setPage("agency");
  };
  const openSchoolWorkspace = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      startRole("school", "signin");
      setMessage(
        "請使用校方管理帳號登入後，才能審核申請、媒合候選人與安排面試。",
      );
      return;
    }
    setBusy(true);
    const [submissionsResult, jobsResult, matchesResult] = await Promise.all([
      supabase
        .from("program_questionnaire_submissions")
        .select(
          "id,applicant_name_en,applicant_name_zh,questionnaire_type,status,career_preference",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("program_job_requirements")
        .select("id,company_name,position_title,specialisation,status")
        .order("created_at", { ascending: false }),
      supabase
        .from("program_match_recommendations")
        .select(
          "id,status,questionnaire_submission_id,job_requirement_id,program_questionnaire_submissions(applicant_name_zh,applicant_name_en),program_job_requirements(company_name,position_title)",
        )
        .order("created_at", { ascending: false }),
    ]);
    setSchoolSubmissions(submissionsResult.data ?? []);
    setSchoolJobs(jobsResult.data ?? []);
    setSchoolMatches((matchesResult.data ?? []) as typeof schoolMatches);
    setMatchingError(
      submissionsResult.error?.message ??
        jobsResult.error?.message ??
        matchesResult.error?.message ??
        "",
    );
    setBusy(false);
    setPage("school");
  };
  const createMatch = async (submissionId: string, jobId: string) => {
    setBusy(true);
    const { error } = await supabase
      .from("program_match_recommendations")
      .upsert(
        {
          questionnaire_submission_id: submissionId,
          job_requirement_id: jobId,
          status: "shortlisted",
        },
        { onConflict: "job_requirement_id,questionnaire_submission_id" },
      );
    setBusy(false);
    setMessage(
      error ? error.message : "候選人已列入媒合名單，廠商工作台可查看並回覆。",
    );
    if (!error) await openSchoolWorkspace();
  };
  const createInterviewSlot = async (
    event: FormEvent<HTMLFormElement>,
    matchId: string,
  ) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = String(form.get("starts_at") || "");
    const endsAt = String(form.get("ends_at") || "");
    if (!startsAt || !endsAt) return;
    setBusy(true);
    const { error } = await supabase.from("program_interview_slots").insert({
      match_recommendation_id: matchId,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      meeting_url: form.get("meeting_url") || null,
      status: "proposed",
    });
    setBusy(false);
    setMessage(
      error ? error.message : "面試時段已提出，候選人與廠商可在工作台查看。 ",
    );
  };
  const openMatchingWorkspace = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      startRole("company", "signin");
      setMessage(
        "請先登入廠商帳號。登入後可查看自己的職缺、媒合候選人及面試排程。",
      );
      return;
    }
    setBusy(true);
    setMatchingError("");
    const { data, error } = await supabase
      .from("program_job_requirements")
      .select("id,position_title,status,headcount,specialisation")
      .order("created_at", { ascending: false });
    setMatchingJobs(data ?? []);
    setMatchingError(error?.message ?? "");
    setBusy(false);
    setPage("matching");
  };
  const submitCompanyRequirement = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      setMessage("請先登入或建立廠商帳號，才能送出職缺需求。");
      return;
    }
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("program_job_requirements").insert({
      user_id: user.id,
      company_name: form.get("company_name"),
      contact_name: form.get("contact_name"),
      contact_email: form.get("contact_email"),
      specialisation: form.get("specialisation"),
      position_title: form.get("position_title"),
      headcount: Number(form.get("headcount") || 1),
      job_description: form.get("job_description"),
      interview_availability: form.get("interview_availability"),
      status: "open",
    });
    setBusy(false);
    setMessage(
      error
        ? error.message
        : "職缺需求已送出，校方審核後會進入候選人媒合工作台。",
    );
  };
  const submitAgencyProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      setMessage("請先登入或建立代辦帳號，才能儲存資料。");
      return;
    }
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("program_agency_submissions").upsert({
      user_id: user.id,
      organisation_name: form.get("organisation_name"),
      contact_name: form.get("contact_name"),
      contact_email: form.get("contact_email"),
      contact_phone: form.get("contact_phone"),
      service_country: form.get("service_country"),
      service_description: form.get("service_description"),
      student_support_needs: form.get("student_support_needs"),
      status: "submitted",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setBusy(false);
    setMessage(error ? error.message : "代辦資料已送出；校方完成審核後可進一步安排推薦學生與申請追蹤。");
  };
  const submitQuestionnaire = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      setMessage("請先登入或建立帳號，才能儲存線上問卷。");
      return;
    }
    const form = new FormData(event.currentTarget);
    const skillProfile = Object.fromEntries(
      Array.from(form.entries()).filter(([key]) => key.startsWith("skill_")),
    );
    try {
      const documents = (
        await Promise.all([
          uploadApplicantDocument(user.id, form.get("identity_document") as File | null, "identity"),
          uploadApplicantDocument(user.id, form.get("education_document") as File | null, "education"),
          uploadApplicantDocument(user.id, form.get("transcript_or_cv") as File | null, "transcript-cv"),
        ])
      ).filter(Boolean);
    const { error } = await supabase
      .from("program_questionnaire_submissions")
      .insert({
        user_id: user.id,
        questionnaire_type: questionnaireType,
        status: "submitted",
        applicant_name_en: form.get("name_en"),
        applicant_name_zh: form.get("name_zh"),
        email: form.get("email"),
        phone: form.get("phone"),
        nationality: form.get("nationality"),
        residence_country: form.get("residence_country"),
        education_level: form.get("education"),
        school_and_major: form.get("school_major"),
        graduation_year: Number(form.get("graduation_year") || 0) || null,
        chinese_level: form.get("chinese"),
        english_level: form.get("english"),
        career_preference: form.get("preference"),
        second_preference: form.get("second_preference"),
        work_experience_years: Number(form.get("experience") || 0),
        skill_profile: skillProfile,
        supporting_links: {
          links: form.get("supporting_links"),
          past_company: form.get("past_company"),
          salary_expectation: form.get("salary_expectation"),
          training: form.get("training"),
          documents,
        },
        motivation: form.get("motivation"),
        interview_availability: form.get("interview"),
        consent_shared: form.get("consent") === "on",
        declaration_confirmed: form.get("declaration") === "on",
        submitted_at: new Date().toISOString(),
      });
    setBusy(false);
    setMessage(
      error ? error.message : "問卷已送出，後續可由系統查看媒合與面試通知。",
    );
    } catch (uploadError) {
      setMessage(
        uploadError instanceof Error
          ? `文件上傳或送件失敗：${uploadError.message}`
          : "文件上傳或送件失敗，請稍後再試。",
      );
    }
  };
  const header = (
    <>
      <div className="site-topline">
        <span>台灣車用電子協會</span>
        <span>汽修專業人才橋接平台</span>
      </div>
      <header className="site-header">
        <button
          className="site-brand"
          type="button"
          onClick={() => {
            setContentKind("news");
            setNoticeIndex(0);
            setPage("home");
          }}
        >
          <span className="site-brand-title">台灣車用電子協會</span>
          <small>汽修專業人才橋接</small>
        </button>
        <nav>
          {page !== "home" && (
            <button
              className="site-back"
              type="button"
              onClick={() => window.history.back()}
            >
              ← 上一頁
            </button>
          )}
          <button type="button" onClick={() => setPage("home")}>
            {t.home}
          </button>
          <button
            type="button"
            onClick={() => {
              setContentKind("announcement");
              setNoticeIndex(0);
              setPage("notices");
            }}
          >
            {t.notices}
          </button>
          <button
            type="button"
            onClick={() => {
              setContentKind("news");
              setNoticeIndex(0);
              setPage("notices");
            }}
          >
            {t.news}
          </button>
          <button type="button" onClick={() => goHomeAnd("admission")}>
            {t.admission}
          </button>
          <button type="button" onClick={() => setPage("resources")}>
            {t.resources}
          </button>
          <div className="public-language-switch" aria-label="切換語言">
            {(Object.keys(languageLabels) as AppLanguage[]).map((item) => (
              <button
                key={item}
                className={language === item ? "active" : ""}
                type="button"
                onClick={() => onLanguageChange(item)}
              >
                {item === "zh-TW" ? "中" : item.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            className="site-login"
            type="button"
            onClick={() => startRole()}
          >
            {t.login}
          </button>
        </nav>
      </header>
      <div className={`site-assistant ${assistantOpen ? "open" : ""} ${assistantArrived ? "arrived" : ""}`}>
        {assistantOpen && (
          <div className="assistant-panel" role="dialog" aria-label="新型專班小助理">
            <header className="assistant-panel-header">
              <img src="/program-helper-front-v2.png" alt="" />
              <div><strong>新型專班小助理</strong><span className="assistant-scope">告訴我你想做什麼，我帶你到正確入口。</span></div>
              <button type="button" className="assistant-close" onClick={() => setAssistantOpen(false)} aria-label="關閉對話">×</button>
            </header>
            <div className="assistant-thread" aria-live="polite">
              <p className="assistant-message">你好！先告訴我你的身分，或直接問我申請、文件、中文條件與在臺生活。</p>
              {assistantMessages.map((item, index) => <div key={`${item.role}-${index}`} className={`assistant-message ${item.role}`}><p>{item.text}</p>{item.sources?.length ? <div className="assistant-sources">{item.sources.map((source) => <a key={source.url} href={source.url}>{source.label}</a>)}</div> : null}</div>)}
            </div>
            {assistantAction && (
              <button
                className="assistant-recommendation"
                type="button"
                onClick={() => runAssistantAction(assistantAction)}
              >
                {assistantActionLabel} <ArrowRight size={16} />
              </button>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                answerAssistant(assistantText);
              }}
            >
              <input
                value={assistantText}
                onChange={(event) => setAssistantText(event.target.value)}
                placeholder="例如：我要填問卷"
              />
              <button aria-label="送出" type="submit" disabled={assistantBusy}>
                {assistantBusy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
              </button>
            </form>
            <div className="assistant-actions">
              <button type="button" onClick={() => answerAssistant("我是學生")}>我是學生</button>
              <button type="button" onClick={() => answerAssistant("我是校方")}>我是校方／老師</button>
              <button type="button" onClick={() => answerAssistant("我是廠商")}>我是合作廠商</button>
              <button type="button" onClick={() => answerAssistant("我是代辦")}>我是留學代辦</button>
              <button
                type="button"
                onClick={() => answerAssistant("需要準備哪些文件")}
              >
                準備哪些文件？
              </button>
              <button
                type="button"
                onClick={() => answerAssistant("中文 A2 條件")}
              >
                中文條件
              </button>
              <button
                type="button"
                onClick={() => answerAssistant("臺灣生活花費")}
              >
                臺灣生活花費
              </button>
            </div>
          </div>
        )}
        {!assistantOpen && (
          <div className="assistant-arrival-message" role="status">
            <strong>{language === "zh-TW" ? "你好，我是小助理。" : assistantLabel}</strong>
            <span>{language === "zh-TW" ? assistantArrivalGuide : "Tell me what you need and I will guide you."}</span>
          </div>
        )}
        <button
          className="assistant-toggle"
          type="button"
          onClick={() => setAssistantOpen(!assistantOpen)}
          aria-label="開啟新型專班小助理"
        >
          <span className="assistant-avatar" aria-hidden="true">
            <img className="assistant-avatar-front" src="/program-helper-front-v2.png" alt="" />
            <img className="assistant-avatar-turn" src="/program-helper-turn-v2.png" alt="" />
          </span>
          <span>{language === "zh-TW" ? "點我，陪你找內容" : assistantLabel}</span>
        </button>
      </div>
      <aside className="role-rail" aria-label="角色入口">
        {roles.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.role}
              type="button"
              aria-label={item.title[language]}
              data-label={item.title[language]}
              onClick={() => startRole(item.role, "signin")}
            >
              <Icon aria-hidden="true" />
              <span>{item.title[language]}</span>
            </button>
          );
        })}
      </aside>
    </>
  );

  if (page === "home")
    return (
      <main className="public-site">
        {header}
        <section
          className="public-hero public-carousel"
          id="top"
          onPointerEnter={() => setHeroPaused(true)}
          onPointerLeave={() => setHeroPaused(false)}
          onFocusCapture={() => setHeroPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setHeroPaused(false);
            }
          }}
          onPointerDown={(event) => setHeroPointerX(event.clientX)}
          onPointerUp={(event) => {
            if (heroPointerX === null) return;
            const distance = event.clientX - heroPointerX;
            if (Math.abs(distance) > 45) changeHero(distance > 0 ? -1 : 1);
            setHeroPointerX(null);
          }}
        >
          <button
            className="carousel-side previous"
            type="button"
            aria-label="上一張主視覺"
            onClick={() => changeHero(-1)}
          >
            <ChevronLeft />
          </button>
          <div className="hero-viewport">
            <div className="hero-track">
              {heroSlides.map(
                (slide, index) =>
                  index === heroIndex && (
                    <div className="hero-copy" key={slide.title}>
                      <img
                        className="hero-news-image"
                        src="/news/tnut-delegation-hero.png"
                        alt="TNUT 代表團交流活動"
                      />
                      <div className="hero-news-copy">
                        <span className="hero-chip">{slide.eyebrow}</span>
                        <h1>
                          {language === "id"
                            ? "Pertukaran Akademik dan Industri Vietnam–Taiwan"
                            : language === "vi"
                              ? "Giao lưu Học thuật và Công nghiệp Việt Nam–Đài Loan"
                              : slide.title}
                        </h1>
                        <p>{slide.target === "news" ? h.heroSummary : language === "zh-TW" ? slide.summary : t.applicationHint}</p>
                        <button
                          className="hero-link"
                          type="button"
                          onClick={() => {
                            if (slide.target === "news") {
                              setContentKind("news");
                              setNoticeIndex(0);
                              setPage("notices");
                              return;
                            }
                            scrollTo(slide.target);
                          }}
                        >
                          {slide.target === "news" ? t.readNews : t.admission}{" "}
                          <ArrowRight />
                        </button>
                      </div>
                    </div>
                  ),
              )}
            </div>
            <div className="carousel-dots">
              {heroSlides.map((item, index) => (
                <button
                  key={item.title}
                  className={index === heroIndex ? "active" : ""}
                  type="button"
                  aria-label={`第 ${index + 1} 張主視覺`}
                  onClick={() => setHeroIndex(index)}
                />
              ))}
            </div>
          </div>
          <aside className="hero-announcement">
            <img
              src="/news/tnut-delegation-hero.png"
              alt="TNUT 代表團交流活動"
            />
            <span>{language === "zh-TW" ? "115 新型專班" : "115 New-Type Programme"}</span>
            <strong>{language === "zh-TW" ? "115 學年度新型專班" : "International New-Type Programme"}</strong>
            <small>International New-Type Program</small>
            <button type="button" onClick={() => scrollTo("admission")}>
              {h.admissionLabel} <ArrowRight size={17} />
            </button>
          </aside>
          <button
            className="carousel-side next"
            type="button"
            aria-label="下一張主視覺"
            onClick={() => changeHero(1)}
          >
            <ChevronRight />
          </button>
        </section>
        <section className="notice-strip" id="news">
          <strong>{t.news}</strong>
          <button
            type="button"
            onClick={() => openNotice(noticeIndex % news.length, "news")}
          >
            {news[noticeIndex % news.length].title} <ArrowRight size={16} />
          </button>
        </section>
        <section className="homepage-panels">
          <section id="announcements">
            <div className="section-heading">
              <div>
                <h2>{t.notices}</h2>
              </div>
              <div className="notice-controls" aria-label="切換公告">
                <button
                  type="button"
                  aria-label="上一則公告"
                  onClick={() =>
                    setNoticeIndex(
                      (index) =>
                        (index - 1 + displayedAnnouncements.length) %
                        displayedAnnouncements.length,
                    )
                  }
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  aria-label="下一則公告"
                  onClick={() =>
                    setNoticeIndex(
                      (index) => (index + 1) % displayedAnnouncements.length,
                    )
                  }
                >
                  <ChevronRight />
                </button>
                <button
                  className="all-notices"
                  type="button"
                  onClick={() => {
                    setContentKind("announcement");
                    setPage("notices");
                  }}
                >
                  {t.allNotices}
                </button>
              </div>
            </div>
            <div className="notice-grid">
              {[displayedAnnouncements[noticeIndex % displayedAnnouncements.length]].map(
                (item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() =>
                      openNotice(
                        noticeIndex % displayedAnnouncements.length,
                        "announcement",
                      )
                    }
                  >
                    <time>{item.date}</time>
                    <strong>{item.title}</strong>
                    <span>{item.summary}</span>
                  </button>
                ),
              )}
            </div>
          </section>
        </section>
        <section className="admission-band" id="admission">
          <div>
            <span>ADMISSION</span>
            <h2>{t.admission}</h2>
          </div>
          <dl>
            <button type="button" onClick={() => setPage("resources")}>
              <dt>{language === "zh-TW" ? "2027 年 2 月" : "February 2027"}</dt>
              <dd>{h.start}</dd>
            </button>
            <button type="button" onClick={() => openNotice(0, "announcement")}>
              <dt>{language === "zh-TW" ? "2 年制學士班" : "2-year bachelor’s"}</dt>
              <dd>{h.degree}</dd>
            </button>
            <button type="button" onClick={() => setPage("a2")}>
              <dt>{language === "zh-TW" ? "中文 A2" : "Chinese A2"}</dt>
              <dd>{h.a2}</dd>
            </button>
            <button type="button" onClick={() => setPage("resources")}>
              <dt>TOCFL B1</dt>
              <dd>{h.tocfl}</dd>
            </button>
          </dl>
          <button type="button" onClick={() => startRole()}>
            {t.apply} <ArrowRight />
          </button>
        </section>
        <section
          className="programme-introduction"
          aria-labelledby="programme-introduction-title"
        >
          <div className="programme-introduction-heading">
            <span>PROGRAMME</span>
            <h2 id="programme-introduction-title">{t.programTitle}</h2>
          </div>
          <div className="programme-introduction-grid">
            <article>
              <strong>{t.programStudy}</strong>
              <p>{t.programStudyHint}</p>
            </article>
            <article>
              <strong>{t.programSupport}</strong>
              <p>{t.programSupportHint}</p>
            </article>
            <article>
              <strong>{t.programCareer}</strong>
              <p>{t.programCareerHint}</p>
            </article>
          </div>
        </section>
        <section className="programme-journey" aria-labelledby="programme-journey-title">
          <div className="programme-journey-heading">
            <span>APPLICATION JOURNEY</span>
            <h2 id="programme-journey-title">{language === "zh-TW" ? "從申請到抵臺，清楚知道下一步" : "A clear path from application to arrival"}</h2>
            <p>{language === "zh-TW" ? "先瀏覽完整流程；需要填寫、上傳或查看個人資料時，再登入你的帳號。" : "Browse the full journey first. Sign in only when you need to submit or view private information."}</p>
          </div>
          <ol>
            {[
              { number: "01", title: "準備資料", detail: "個人資料、學歷文件與專業技能", onClick: () => startRole("student", "signin") },
              { number: "02", title: "選擇方案", detail: "確認學校、系所與第一、第二志願", onClick: () => startRole("student", "signin") },
              { number: "03", title: "送出申請", detail: "確認資料後送交校方審查", onClick: () => startRole("student", "signin") },
              { number: "04", title: "審查與面試", detail: "查看補件、面試與錄取通知", onClick: () => openStudentProgress() },
              { number: "05", title: "準備赴臺", detail: "確認簽證、住宿、接機與行前事項", onClick: () => setPage("resources") },
              { number: "06", title: "報到入學", detail: "完成抵臺報到與個人資料確認", onClick: () => openStudentProgress() },
            ].map(({ number, title, detail, onClick }) => (
              <li key={number}>
                <span>{number}</span><strong>{title}</strong><p>{detail}</p><button type="button" onClick={onClick}>查看這一步 <ArrowRight size={15} /></button>
              </li>
            ))}
          </ol>
        </section>
        <section className="welcome-paths" aria-labelledby="role-entry-title">
          <h2 id="role-entry-title">{language === "zh-TW" ? "服務入口" : "Service access"}</h2>
          <div>
            {roles.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => startRole(item.role, "signin")}
                >
                  <Icon aria-hidden="true" />
                  <strong>{item.title[language]}</strong>
                  <ArrowRight aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>
        <footer className="site-footer">
          <section>
            <strong>{t.footerProject}</strong>
            <span>台灣車用電子協會</span>
            <button type="button" onClick={() => setPage("resources")}>
              {h.programme}
            </button>
            <button type="button" onClick={() => openCompanyWorkspace()}>
              {h.company}
            </button>
          </section>
          <section>
            <strong>{t.footerCampus}</strong>
            <span>國際學生服務資源</span>
            <a href="https://ucan.moe.edu.tw/" target="_blank" rel="noreferrer">
              UCAN 職能診斷平台
            </a>
          </section>
          <section>
            <strong>{t.footerGovernment}</strong>
            <a
              href="https://www.tainan.gov.tw/"
              target="_blank"
              rel="noreferrer"
            >
              臺南市政府
            </a>
            <a href="https://www.edu.tw/" target="_blank" rel="noreferrer">
              教育部
            </a>
          </section>
          <section>
            <strong>{t.footerContact}</strong>
            <span>115 新型專班媒合平台</span>
            <button type="button" onClick={() => setPage("resources")}>
              {h.partner}
            </button>
          </section>
        </footer>
      </main>
    );
  if (page === "student")
    return (
      <main className="public-site questionnaire-page">
        {header}
        <section className="online-form-shell">
          <button className="notice-back" type="button" onClick={() => setPage("home")}>
            ← {q.back}
          </button>
          <span>STUDENT APPLICATION</span>
          <h1>{q.studentTitle}</h1>
          <p>{q.studentHint}</p>
          <div className="questionnaire-choice-grid">
            <button type="button" onClick={() => openQuestionnaire("integrated")}>
              <strong>{q.integrated}</strong><span>{q.integratedHint}</span>
            </button>
            <button type="button" onClick={() => openQuestionnaire("maintenance")}>
              <strong>{q.maintenance}</strong><span>{q.maintenanceHint}</span>
            </button>
            <button type="button" onClick={() => openQuestionnaire("sales")}>
              <strong>{q.sales}</strong><span>{q.salesHint}</span>
            </button>
            <button type="button" onClick={() => openQuestionnaire("parts")}>
              <strong>{q.parts}</strong><span>{q.partsHint}</span>
            </button>
            <button type="button" onClick={() => openQuestionnaire("electrics")}>
              <strong>{q.electrics}</strong><span>{q.electricsHint}</span>
            </button>
          </div>
          {onOpenLegacyPrep && (
            <button className="hero-link workspace-link" type="button" onClick={onOpenLegacyPrep}>
              {language === "zh-TW" ? "前往既有中文自介與面試準備工具" : language === "id" ? "Buka alat persiapan perkenalan Mandarin dan wawancara" : language === "vi" ? "Mở công cụ chuẩn bị giới thiệu tiếng Trung và phỏng vấn" : "Open the existing Chinese introduction and interview preparation tool"} <ArrowRight />
            </button>
          )}
          <button className="hero-link workspace-link" type="button" onClick={openStudentProgress}>
            查看我的申請、媒合與面試進度 <ArrowRight />
          </button>
          <ProgramWorkflow role="student" />
        </section>
      </main>
    );
  if (page === "student-progress")
    return (
      <main className="public-site questionnaire-page">
        {header}
        <section className="online-form-shell">
          <button className="notice-back" type="button" onClick={() => setPage("student")}>
            ← 返回申請與專業問卷
          </button>
          <span>MY APPLICATION</span>
          <h1>我的申請、媒合與面試進度</h1>
          <p>這裡只顯示你自己的送件與校方排定的面試。面試連結只會在確認後提供給相關申請者。</p>
          {matchingError && <p className="account-message">{matchingError}</p>}
          <section className="workspace-list application-progress-list">
            <h2>申請問卷</h2>
            {studentSubmissions.length ? studentSubmissions.map((submission) => (
              <article key={submission.id}>
                <strong>{submission.questionnaire_type}</strong>
                <span>狀態：{submission.status}／送出：{submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : "草稿"}</span>
              </article>
            )) : <p>尚未送出申請問卷。</p>}
          </section>
          <section className="workspace-list application-progress-list">
            <h2>媒合後的面試安排</h2>
            {studentInterviews.length ? studentInterviews.map((slot) => (
              <article key={slot.id}>
                <strong>{new Date(slot.starts_at).toLocaleString()} ～ {new Date(slot.ends_at).toLocaleTimeString()}</strong>
                <span>狀態：{slot.status}</span>
                {slot.meeting_url && <a href={slot.meeting_url} target="_blank" rel="noreferrer">開啟面試連結</a>}
              </article>
            )) : <p>目前尚無面試安排；校方完成媒合並排定時段後會顯示在這裡。</p>}
          </section>
        </section>
      </main>
    );
  if (page === "questionnaire")
    return (
      <main className="public-site questionnaire-page">
        {header}
        <section className="online-form-shell">
          <button
            className="notice-back"
            type="button"
            onClick={() => setPage("home")}
          >
            ← {q.back}
          </button>
          <span>ONLINE QUESTIONNAIRE</span>
          <h1>
            {questionnaireType === "maintenance"
              ? q.maintenance
              : questionnaireType === "sales"
                ? q.sales
                : questionnaireType === "parts"
                  ? q.parts
                  : questionnaireType === "electrics"
                    ? q.electrics
                  : q.integrated}
          </h1>
          <p>{q.formHint}</p>
          <form className="online-questionnaire" onSubmit={submitQuestionnaire}>
            <fieldset>
              <legend>{q.basic}</legend>
              <label>
                {q.nameEn}
                <input required name="name_en" />
              </label>
              <label>
                {q.nameZh}
                <input name="name_zh" />
              </label>
              <label>
                Email
                <input required type="email" name="email" />
              </label>
              <label>
                {q.phone}
                <input required name="phone" />
              </label>
              <label>
                {q.nationality}
                <select required name="nationality">
                  <option value="">{q.select}</option>
                  <option>越南</option>
                  <option>印尼</option>
                  <option>其他</option>
                </select>
              </label>
              <label>
                {q.education}
                <select required name="education">
                  <option value="">{q.select}</option>
                  <option>高專／專科</option>
                  <option>大學</option>
                </select>
              </label>
              <label>
                {q.graduation}
                <input
                  required
                  name="graduation_year"
                  type="number"
                  min="2000"
                  max="2100"
                />
              </label>
              <label>
                {q.residence}
                <input required name="residence_country" />
              </label>
              <label className="wide">
                {q.schoolMajor}
                <input required name="school_major" />
              </label>
            </fieldset>
            <fieldset className="document-fieldset">
              <legend>{documentCopy.title}</legend>
              <p>{documentCopy.hint}</p>
              <label>
                {documentCopy.identity}
                <input required name="identity_document" type="file" accept=".pdf,image/jpeg,image/png" />
              </label>
              <label>
                {documentCopy.education}
                <input required name="education_document" type="file" accept=".pdf,image/jpeg,image/png" />
              </label>
              <label>
                {documentCopy.transcript}
                <input name="transcript_or_cv" type="file" accept=".pdf,image/jpeg,image/png" />
              </label>
            </fieldset>
            <fieldset>
              <legend>{q.languageCareer}</legend>
              <label>
                {q.chinese}
                <select required name="chinese">
                  <option value="">{q.select}</option>
                  <option>完全不會</option>
                  <option>初級／TOCFL A1-A2</option>
                  <option>中級以上／TOCFL B1+</option>
                </select>
              </label>
              <label>
                {q.experience}
                <input name="experience" type="number" min="0" step="0.5" />
              </label>
              <label>
                {q.english}
                <select required name="english">
                  <option value="">{q.select}</option>
                  <option>基礎</option>
                  <option>可工作溝通</option>
                  <option>熟練</option>
                </select>
              </label>
              <label>
                {q.training}
                <select required name="training">
                  <option value="">{q.select}</option>
                  <option>願意</option>
                  <option>需進一步討論</option>
                </select>
              </label>
              <label className="wide">
                {q.first}
                <select required name="preference">
                  <option value="">{q.select}</option>
                  <option>車輛保養修護</option>
                  <option>整車銷售</option>
                  <option>零組件材料整備與販售</option>
                </select>
              </label>
              <label className="wide">
                {q.second}
                <select name="second_preference">
                  <option value="">尚未決定</option>
                  <option>車輛保養修護</option>
                  <option>整車銷售</option>
                  <option>零組件材料整備與販售</option>
                </select>
              </label>
              <label>
                {q.employer}
                <input name="past_company" />
              </label>
              <label>
                {q.salary}
                <input name="salary_expectation" />
              </label>
              <label className="wide">
                {q.strength}
                <textarea required name="motivation" rows={5} />
              </label>
              <label className="wide">
                {q.interview}
                <select required name="interview">
                  <option value="">{q.select}</option>
                  <option>可隨時配合線上面試</option>
                  <option>需提前 3-5 天通知</option>
                </select>
              </label>
              <label className="wide">
                {q.evidence}
                <textarea name="supporting_links" rows={3} />
              </label>
            </fieldset>
            <fieldset className="skill-fieldset">
              <legend>{q.skills}</legend>
              <p>{q.skillHint}</p>
              <div className="skill-matrix">
                {questionnaireSkills[questionnaireType].map((skill, index) => (
                  <div key={skill} className="skill-row">
                    <strong>
                      {index + 1}. {skill}
                    </strong>
                    {["無", "基礎", "普通", "熟練"].map((level) => (
                      <label key={level}>
                        <input
                          required
                          type="radio"
                          name={`skill_${index + 1}`}
                          value={level}
                        />
                        {level}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </fieldset>
            <label className="check">
              <input required type="checkbox" name="consent" />
              {q.consent}
            </label>
            <label className="check">
              <input required type="checkbox" name="declaration" />
              {q.declaration}
            </label>
            <button className="form-submit" disabled={busy} type="submit">
              {busy ? <Loader2 className="spin" /> : <UserPlus />}{q.submit}
            </button>
            {message && <p className="account-message">{message}</p>}
          </form>
          <ProgramWorkflow role="agency" />
        </section>
      </main>
    );
  if (page === "agency")
    return (
      <main className="public-site questionnaire-page">
        {header}
        <section className="online-form-shell">
          <button className="notice-back" type="button" onClick={() => setPage("home")}>
            ← {w.back}
          </button>
          <span>{w.agencyTag}</span>
          <h1>{w.agencyTitle}</h1>
          <p>{w.agencyHint}</p>
          <form className="online-questionnaire" onSubmit={submitAgencyProfile}>
            <fieldset>
              <legend>{w.agencyLegend}</legend>
              <label>{w.organisation}<input required name="organisation_name" /></label>
              <label>{w.contact}<input required name="contact_name" /></label>
              <label>{w.email}<input required type="email" name="contact_email" /></label>
              <label>{w.phone}<input required name="contact_phone" /></label>
              <label className="wide">{w.country}<input required name="service_country" /></label>
              <label className="wide">{w.service}<textarea required name="service_description" rows={5} /></label>
              <label className="wide">{w.support}<textarea required name="student_support_needs" rows={4} /></label>
            </fieldset>
            <button className="form-submit" disabled={busy} type="submit">
              {busy ? <Loader2 className="spin" /> : <Handshake />}{w.submitAgency}
            </button>
            {message && <p className="account-message">{message}</p>}
          </form>
        </section>
      </main>
    );  if (page === "school")
    return (
      <main className="public-site questionnaire-page">
        {header}
        <section className="online-form-shell">
          <button
            className="notice-back"
            type="button"
            onClick={() => setPage("home")}
          >
            ← {w.back}
          </button>
          <span>{w.schoolTag}</span>
          <h1>{w.schoolTitle}</h1>
          <p>{w.schoolHint}</p>
          {matchingError && <p className="account-message">{matchingError}</p>}
          <div className="workspace-status">
            <strong>
              {w.pending}: {schoolSubmissions.length} {language === "zh-TW" ? "份學生申請" : language === "id" ? "pendaftaran mahasiswa" : language === "vi" ? "hồ sơ sinh viên" : "student applications"}, {schoolJobs.length} {language === "zh-TW" ? "個企業職缺" : language === "id" ? "lowongan perusahaan" : language === "vi" ? "vị trí doanh nghiệp" : "company openings"}
            </strong>
            <span>{w.schoolAccess}</span>
          </div>
          <div className="workspace-list">
            {schoolSubmissions.map((submission) => (
              <article key={submission.id}>
                <strong>
                  {submission.applicant_name_zh ||
                    submission.applicant_name_en ||
                    "未具名申請者"}
                </strong>
                <span>
                  {submission.questionnaire_type}／
                  {submission.career_preference || "未填職涯偏好"}／目前：
                  {submission.status}
                </span>
                <select
                  aria-label="選擇媒合職缺"
                  defaultValue=""
                  onChange={(event) =>
                    event.target.value &&
                    createMatch(submission.id, event.target.value)
                  }
                >
                  <option value="">列入媒合職缺…</option>
                  {schoolJobs
                    .filter((job) => job.status === "open")
                    .map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.company_name}｜{job.position_title}
                      </option>
                    ))}
                </select>
              </article>
            ))}
          </div>
          {!schoolSubmissions.length && !busy && (
            <p className="workspace-link">目前尚無可審核的送件資料。</p>
          )}
          <section
            className="interview-scheduler"
            aria-labelledby="interview-scheduler-title"
          >
            <h2 id="interview-scheduler-title">已媒合候選人與面試安排</h2>
            {!schoolMatches.length && (
              <p>尚未建立媒合；請先在申請資料旁選擇職缺。</p>
            )}
            {schoolMatches.map((match) => (
              <form
                key={match.id}
                className="interview-slot-form"
                onSubmit={(event) => createInterviewSlot(event, match.id)}
              >
                <strong>
                  {match.program_questionnaire_submissions[0]
                    ?.applicant_name_zh ||
                    match.program_questionnaire_submissions[0]
                      ?.applicant_name_en ||
                    "候選人"}
                </strong>
                <span>
                  {match.program_job_requirements[0]?.company_name || "企業"}｜
                  {match.program_job_requirements[0]?.position_title || "職缺"}
                  ｜{match.status}
                </span>
                <label>
                  開始時間
                  <input required name="starts_at" type="datetime-local" />
                </label>
                <label>
                  結束時間
                  <input required name="ends_at" type="datetime-local" />
                </label>
                <label>
                  視訊連結（選填）
                  <input
                    name="meeting_url"
                    type="url"
                    placeholder="https://meet.google.com/..."
                  />
                </label>
                <button className="form-submit" disabled={busy} type="submit">
                  提出面試時段
                </button>
              </form>
            ))}
          </section>
          <ProgramWorkflow role="school" />
          {message && <p className="account-message">{message}</p>}
        </section>
      </main>
    );
  if (page === "company")
    return (
      <main className="public-site questionnaire-page">
        {header}
        <section className="online-form-shell">
          <button
            className="notice-back"
            type="button"
            onClick={() => setPage("home")}
          >
            ← 返回網站首頁
          </button>
          <span>{w.companyTag}</span>
          <h1>{w.companyTitle}</h1>
          <p>{w.companyHint}</p>
          <form
            className="online-questionnaire"
            onSubmit={submitCompanyRequirement}
          >
            <fieldset>
              <legend>{w.companyLegend}</legend>
              <label>
                {w.companyName}
                <input required name="company_name" />
              </label>
              <label>
                {w.contact}
                <input required name="contact_name" />
              </label>
              <label>
                {w.email}
                <input required type="email" name="contact_email" />
              </label>
              <label>
                {w.headcount}
                <input required type="number" min="1" name="headcount" />
              </label>
              <label>
                {w.speciality}
                <select required name="specialisation">
                  <option value="">{q.select}</option>
                  <option value="maintenance">{q.maintenance}</option>
                  <option value="sales">{q.sales}</option>
                  <option value="parts">{q.parts}</option>
                  <option value="electrics">{q.electrics}</option>
                </select>
              </label>
              <label>
                {w.position}
                <input required name="position_title" />
              </label>
              <label className="wide">
                {w.jobDescription}
                <textarea required name="job_description" rows={6} />
              </label>
              <label className="wide">
                {w.availability}
                <textarea required name="interview_availability" rows={3} />
              </label>
            </fieldset>
            <button className="form-submit" disabled={busy} type="submit">
              {busy ? <Loader2 className="spin" /> : <BriefcaseBusiness />}
              {w.submitJob}
            </button>
            {message && <p className="account-message">{message}</p>}
          </form>
          <button
            className="hero-link workspace-link"
            type="button"
            onClick={openMatchingWorkspace}
          >
            {w.matching} <ArrowRight />
          </button>
          <ProgramWorkflow role="company" />
        </section>
      </main>
    );
  if (page === "matching")
    return (
      <main className="public-site questionnaire-page">
        {header}
        <section className="online-form-shell">
          <button
            className="notice-back"
            type="button"
            onClick={() => setPage("company")}
          >
            ← 返回廠商工作台
          </button>
          <span>MATCHING WORKSPACE</span>
          <h1>媒合與面試排程</h1>
          <p>
            這裡會列出校方審核後可推薦的候選人、廠商職缺與可安排面試時段。請先建立職缺需求；候選人送出對應問卷後，校方將媒合並通知雙方。
          </p>
          {matchingError && <p className="account-message">{matchingError}</p>}
          <div className="workspace-status">
            <strong>職缺清單</strong>
            <span>
              候選人僅會在校方完成審核並媒合至你的職缺後顯示，以保護個資。
            </span>
          </div>
          <div className="workspace-list">
            {matchingJobs.length ? (
              matchingJobs.map((job) => (
                <article key={job.id}>
                  <strong>{job.position_title}</strong>
                  <span>
                    {job.specialisation} · {job.headcount} 人 · {job.status}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMessage(
                        "候選人尚待校方媒合；媒合後可在此確認或安排線上面試。",
                      )
                    }
                  >
                    查看媒合狀態
                  </button>
                </article>
              ))
            ) : (
              <p>尚未建立職缺。請返回廠商工作台新增職缺需求。</p>
            )}
          </div>
        </section>
      </main>
    );
  if (page === "resources")
    return (
      <main className="public-site questionnaire-page">
        {header}
        <section className="online-form-shell">
          <button
            className="notice-back"
            type="button"
            onClick={() => setPage("home")}
          >
            ← 回首頁
          </button>
          <span>PROGRAM RESOURCES</span>
          <h1>專班資源與宣導專區</h1>
          <p>提供申請、問卷、企業合作及國際學生支援的單一入口。</p>
          <div className="resource-grid">
            <button type="button" onClick={() => goHomeAnd("admission")}>
              招生與資格
              <br />
              <small>入學時間、語言條件、申請流程</small>
            </button>
            <button
              type="button"
              onClick={() => openQuestionnaire("integrated")}
            >
              線上問卷
              <br />
              <small>登入後填寫與追蹤狀態</small>
            </button>
            <button type="button" onClick={openCompanyWorkspace}>
              企業合作
              <br />
              <small>職缺、媒合與面試排程</small>
            </button>
            <button
              type="button"
              onClick={() => {
                setContentKind("news");
                setPage("notices");
              }}
            >
              最新新聞
              <br />
              <small>國際交流與活動消息</small>
            </button>
          </div>
        </section>
      </main>
    );
  if (page === "a2")
    return (
      <main className="public-site questionnaire-page">
        {header}
        <section className="online-form-shell">
          <button
            className="notice-back"
            type="button"
            onClick={() => setPage("home")}
          >
            ← 回首頁
          </button>
          <span>LANGUAGE REQUIREMENT</span>
          <h1>中文 A2 入學資格</h1>
          <p>
            這是申請流程中的語言資格頁，不是公告介紹。你可在此確認資格並在登入後上傳佐證資料。
          </p>
          <div className="workspace-status">
            <strong>入學資格</strong>
            <span>
              申請者須符合中文能力 A2 以上，或依校方通知完成指定中文培訓與評量。
            </span>
          </div>
          <div className="resource-grid">
            <button type="button" onClick={() => startRole()}>
              登入後上傳證明
              <br />
              <small>TOCFL、中文課程或校方指定文件</small>
            </button>
            <button
              type="button"
              onClick={() => openQuestionnaire("integrated")}
            >
              填寫申請資料
              <br />
              <small>建立個人檔案與聯絡方式</small>
            </button>
          </div>
        </section>
      </main>
    );
  if (page === "notices")
    return (
      <main className="public-site notice-page">
        {header}
        <section className="notice-page-content">
          <div className="section-heading">
            <div>
              <span>{contentKind === "news" ? "NEWS" : "NOTICE"}</span>
              <h1>{contentKind === "news" ? "最新新聞" : "最新公告"}</h1>
            </div>
            <button type="button" onClick={() => setPage("home")}>
              回首頁
            </button>
          </div>
          <div className="notice-list">
            {activeItems.map((item, index) => (
              <article key={item.title}>
                {item.image && (
                  <img src={item.image} alt="TNUT 代表團交流活動" />
                )}
                <time>{item.date}</time>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.summary}</p>
                </div>
                <button type="button" onClick={() => openNotice(index)}>
                  查看內容 <ArrowRight />
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  if (page === "notice")
    return (
      <main className="public-site notice-page">
        {header}
        <article className="notice-detail">
          <button
            className="notice-back"
            type="button"
            onClick={() => setPage("notices")}
          >
            ← 回{contentKind === "news" ? "新聞" : "公告"}列表
          </button>
          <time>{currentNotice.date}</time>
          <h1>{currentNotice.title}</h1>
          {currentNotice.image && (
            <img
              className="notice-detail-media"
              src={currentNotice.image}
              alt="TNUT 代表團交流活動"
            />
          )}
          {currentNotice.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <div className="detail-actions">
            <button type="button" onClick={() => setPage("notices")}>
              查看全部{contentKind === "news" ? "新聞" : "公告"}
            </button>
            <button type="button" onClick={() => setPage("home")}>
              回首頁
            </button>
            <button
              className="site-login"
              type="button"
              onClick={() => startRole()}
            >
              我要申請 <ArrowRight />
            </button>
          </div>
        </article>
      </main>
    );
  return (
    <main className="public-site onboarding-shell">
      {header}
      <button
        className="flow-home"
        type="button"
        onClick={() => setPage("home")}
      >
        ← 回首頁
      </button>
      <section className="onboarding-console">
        <aside className="program-visual">
          <div className="program-visual-top">
            <Globe2 size={18} /> 115 新型專班
          </div>
          <div className="program-visual-main">
            <span>SMART ENERGY</span>
            <h1>
              115 學年度
              <br />
              新型專班
            </h1>
            <strong>
              2027
              <br />
              02
            </strong>
          </div>
          <div className="program-visual-footer">
            <span>STEM PROGRAM</span>
            <span>EN ・ ID ・ VI</span>
          </div>
        </aside>
        <section className="onboarding-stage">
          {page === "roles" && (
            <>
              <div className="operating-label">
                <span>01</span>
                <strong>選擇角色</strong>
              </div>
              <div className="coach-mark">
                <i />
                請點選你的角色
              </div>
              <div className="onboarding-role-list">
                {roles.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.role}
                      onClick={() => {
                        setRole(item.role);
                        setAccountMode("signin");
                        setMessage("");
                        setPage("account");
                      }}
                    >
                      <span className="role-index">0{index + 1}</span>
                      <span className="role-icon">
                        <Icon />
                      </span>
                      <strong>{item.title[language]}</strong>
                      <ArrowRight />
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {page === "account" && (
            <>
              <header className="account-header">
                <div className="operating-label">
                  <span>02</span>
                  <strong>{t.accountTitle}</strong>
                </div>
              </header>
              <div className="account-panel">
                <p className="account-role-introduction">
                  {serviceDescriptions[language][role ?? "student"]}
                </p>
                <div className="account-mode-tabs">
                  <button
                    type="button"
                    className={accountMode === "signin" ? "active" : ""}
                    onClick={() => setAccountMode("signin")}
                  >
                    {t.signIn}
                  </button>
                  <button
                    type="button"
                    className={accountMode === "register" ? "active" : ""}
                    onClick={() => setAccountMode("register")}
                  >
                    {t.register}
                  </button>
                </div>
                <button
                  className="google-signin"
                  type="button"
                  disabled={busy || !googleEnabled}
                  onClick={() => authenticateOAuth("google")}
                >
                  <span>Google</span>
                  {googleEnabled
                    ? oauthProvider === "google"
                      ? t.processing
                      : t.useGoogle
                    : "Google 登入尚未啟用"}
                </button>
                <button
                  className="line-signin"
                  type="button"
                  disabled={busy}
                  onClick={() => authenticateOAuth("line")}
                >
                  {oauthProvider === "line" ? t.processing : t.useLine}
                </button>
                <div className="account-divider">{t.emailDivider}</div>
                <form onSubmit={authenticateEmail}>
                  {accountMode === "register" && (
                    <label className="account-role-field">
                      {t.requestedRole}
                      <select
                        value={role ?? "student"}
                        onChange={(event) =>
                          setRole(event.target.value as PortalRole)
                        }
                      >
                        {roles.map((item) => (
                          <option key={item.role} value={item.role}>
                            {item.title[language]}
                          </option>
                        ))}
                      </select>
                      <small>{t.requestedRoleHint}</small>
                    </label>
                  )}
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email"
                  />
                  <input
                    required
                    minLength={6}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t.password}
                  />
                  <button
                    className="onboarding-next"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? (
                      <Loader2 className="spin" />
                    ) : accountMode === "register" ? (
                      <UserPlus />
                    ) : (
                      <Mail />
                    )}
                    {accountMode === "register"
                      ? t.submitRegistration
                      : t.signInSystem}
                  </button>
                </form>
                {message && <p className="account-message">{message}</p>}
              </div>
              <button
                className="onboarding-back"
                type="button"
                onClick={() => setPage("home")}
              >
                {t.backHome}
              </button>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
