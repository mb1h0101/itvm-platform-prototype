type StudentPrepRequest = {
  task?: "intro" | "translation" | "summary" | "questions" | "assistant";
  locale?: string;
  studentName?: string;
  country?: string;
  targetDepartment?: string;
  motivation?: string;
  chineseLevel?: string;
  nativeLanguage?: string;
  context?: string;
  question?: string;
};

const programmeSources = [
  { label: "招生資訊", url: "https://line-attendance-system-one.vercel.app/#admission" },
  { label: "中文條件", url: "https://line-attendance-system-one.vercel.app/#admission" },
  { label: "專班資源與在臺準備", url: "https://line-attendance-system-one.vercel.app/" },
];

const taskLabels = {
  intro: "中文自我介紹",
  translation: "雙語輔助稿",
  summary: "面試摘要",
  questions: "面試練習題",
};

function sendJson(response: any, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function buildPrompt(payload: StudentPrepRequest) {
  const task = payload.task ?? "intro";
  const label = taskLabels[task as keyof typeof taskLabels] ?? taskLabels.intro;
  const locale = payload.locale || "zh-TW";

  if (task === "assistant") {
    return [
      "你是『新型專班媒合平台』的網站小助理。只回答網站流程、申請文件、中文條件、在臺生活準備、學生／校方／企業／留學代辦角色功能。",
      `使用者問題：${payload.question || payload.context || "未提供問題"}`,
      "以繁體中文回答，150 字內。資訊不足時明確說明需向校方確認；不得編造錄取、簽證、獎學金、法規或金額承諾。",
      "結尾用一句話指出使用者下一步可在本站採取的行動。",
    ].join("\n");
  }
  return [
    `請產生「${label}」。`,
    `輸出語言/參考語言：${locale}`,
    "",
    "學生資料：",
    `姓名：${payload.studentName || "未填"}`,
    `國別：${payload.country || "未填"}`,
    `申請科系：${payload.targetDepartment || "未填"}`,
    `動機：${payload.motivation || "未填"}`,
    `中文程度：${payload.chineseLevel || "未填"}`,
    `母語/輔助語言：${payload.nativeLanguage || "未填"}`,
    payload.context ? `既有草稿/脈絡：\n${payload.context}` : "",
    "",
    "要求：",
    "- 使用繁體中文為主，除非任務是雙語稿。",
    "- 內容要適合台灣學校行政人員、代辦與國際學生使用。",
    "- 保持精簡、具體、可直接貼到 LINE 或後台紀錄。",
    "- 不要編造不存在的學校錄取、簽證或獎學金承諾。",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractText(payload: any) {
  return (
    payload?.output_text ||
    payload?.output?.flatMap((item: any) => item?.content ?? [])
      ?.map((content: any) => content?.text)
      ?.filter(Boolean)
      ?.join("\n") ||
    payload?.choices?.[0]?.message?.content ||
    ""
  ).trim();
}

export default async function handler(request: any, response: any) {
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(response, 503, { error: "OPENAI_API_KEY is not configured" });
    return;
  }

  const payload = typeof request.body === "string" ? JSON.parse(request.body || "{}") : (request.body ?? {});
  const model = process.env.OPENAI_MODEL || "gpt-5.2";

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: buildPrompt(payload),
      max_output_tokens: 900,
    }),
  });

  const data = await openaiResponse.json();
  if (!openaiResponse.ok) {
    sendJson(response, openaiResponse.status, { error: data?.error?.message || "OpenAI request failed" });
    return;
  }

  sendJson(response, 200, {
    text: extractText(data),
    sources: payload.task === "assistant" ? programmeSources : [],
  });
}
