import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { type?: string; userId?: string; groupId?: string };
  message?: {
    type?: string;
    text?: string;
    mention?: { mentionees?: Array<{ type?: string; userId?: string; isSelf?: boolean; index?: number; length?: number }> };
  };
};

const ROLE_COMMANDS = [
  { tag: "@外籍學生", name: "印尼學生 B", icon: "foreign-student", sections: "1.3、1.4、1.7、1.9、2.1–2.6、2.8、5.3–5.5", coverage: "註冊、登入、七步申請、暫存、文件、外文提示、身分格式、權限碼、志願、送出、補件、面試、錄取、簽證、個資與截止時間", prompt: "你是實際使用網站的外籍學生。", intro: "我是印尼學生 B；網站完成後，我會用實際申請者流程驗證每一步是否可用。" },
  { tag: "@外國學校", name: "越南學校 C", icon: "foreign-school", sections: "1.2、1.9、3.1、5.7", coverage: "一般與會員差別、學生定義、可見個資、學校資料、報表、付款與續約", prompt: "你是實際合作的外國學校代表。", intro: "我是越南學校 C；網站完成後，我會以本校合作與學生銜接的真實情境驗證。" },
  { tag: "@外國代辦", name: "越南代辦 D", icon: "foreign-agency", sections: "1.2、1.9、4.1、4.2、5.1、5.7", coverage: "代辦帳號、權限碼、推薦學生、資料遮蔽、提醒、統計、停用、付款與續約", prompt: "你是實際使用系統的外國代辦。", intro: "我是越南代辦 D；網站完成後，我會以發權限碼、推薦學生與追蹤進度的真實流程驗證。" },
  { tag: "@台灣管理端", name: "台灣管理 E", icon: "taiwan-admin", sections: "1.1、1.2、1.5、1.7、1.8、1.9、1.11–1.15、2.1、2.8、5.1–5.10", coverage: "權限、案件狀態、審查、補件、面試、錄取、備取、通知書、操作紀錄、匯出、通知、會員、網域與交接", prompt: "你是實際處理案件的台灣管理者。", intro: "我是台灣管理 E；網站完成後，我會以管理、審查、面試與錄取的真實作業驗證。" },
  { tag: "@台灣學校", name: "台灣學校 F", icon: "taiwan-school", sections: "1.2、6.1、6.2", coverage: "學校建檔、方案開放與截止、方案修改通知、名額與每月報表", prompt: "你是實際合作的台灣學校窗口。", intro: "我是台灣學校 F；網站完成後，我會以學校資料、方案與學生銜接的真實需求驗證。" },
  { tag: "@台灣廠商", name: "台灣廠商 A", icon: "taiwan-employer", sections: "1.2、1.9、5.2、5.3、5.7、6.3–6.6", coverage: "廠商帳號、公司資料、職缺、候選人、個資遮蔽、面試、簽約、入離職、停用、付款與續約", prompt: "你是實際招聘與面試的台灣廠商。", intro: "我是台灣廠商 A；網站完成後，我會以刊登職缺、看候選人、面試與簽約的真實流程驗證。" },
];

function sendJson(response: any, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

async function readRawBody(request: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function verifySignature(rawBody: Buffer, signature: string | undefined, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function askAi(instruction: string, text: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const result = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      input: `${instruction}\n\n訊息：\n${text}`,
      max_output_tokens: 700,
    }),
  });
  const payload = await result.json();
  if (!result.ok) throw new Error(payload?.error?.message || "AI request failed");
  return (
    payload?.output_text ||
    payload?.output?.flatMap((item: any) => item?.content || []).map((item: any) => item?.text).filter(Boolean).join("\n") ||
    ""
  ).trim();
}

function getPlanReference() {
  try {
    // This file is freshly extracted from the user-supplied V2.5 (20261105) DOCX.
    // Do not fall back to an older plan: every development explanation and review
    // must have a source in this current document.
    return readFileSync(join(process.cwd(), "itvm-plan-current.txt"), "utf8");
  } catch {
    return "";
  }
}

async function explainPlanForSom(question: string) {
  const plan = getPlanReference();
  if (!plan) {
    return "Tài liệu kế hoạch hiện chưa sẵn sàng trong trợ lý. Vui lòng hỏi trong nhóm trước khi thực hiện.";
  }
  return askAi(
    [
      "Bạn là trợ lý đọc tài liệu cho lập trình viên Som.",
      "Chỉ được dựa vào TÀI LIỆU KẾ HOẠCH bên dưới để trả lời câu hỏi.",
      "Trả lời bằng tiếng Việt, ngắn gọn, có thể nêu số mục/bảng nếu tìm thấy.",
      "Tài liệu này là tiêu chuẩn hoàn chỉnh. Hãy trả lời trực tiếp đúng theo nội dung tài liệu, không nói tài liệu thiếu hoặc chưa quy định.",
      "Không tự sắp xếp thứ tự ưu tiên, lộ trình phát triển hoặc kiến trúc nếu tài liệu không nêu rõ. Nếu người hỏi chưa nói đang làm trang/chức năng nào, hãy chỉ yêu cầu họ nêu trang hoặc chức năng đó.",
      "Chỉ dẫn phát triển đã được thầy xác định: trước tiên thiết kế phía học viên. Khi hỏi về việc bắt đầu hoặc thứ tự hiện tại, hãy nhắc đúng chỉ dẫn này; sau đó chỉ giải thích yêu cầu của phía học viên theo tài liệu.",
      "Không tự đề xuất quy tắc, giao diện hay chức năng mới. Không tiết lộ nội dung kiểm thử hoặc đánh giá nội bộ.",
      "\nTÀI LIỆU KẾ HOẠCH:\n" + plan,
    ].join("\n"),
    question,
  );
}

async function translateSomToChinese(text: string) {
  return askAi(
    "將 Som 的訊息忠實翻成繁體中文。只輸出譯文，不補充、不解釋、不改寫需求。",
    text,
  );
}

async function translateTeacherEnglishToVietnamese(text: string) {
  return askAi(
    "將唐老師的英文訊息忠實翻成自然、禮貌的越南文。只輸出譯文，不補充、不解釋、不改寫時間或安排。",
    text,
  );
}

function mentionedText(text: string, userId?: string) {
  if (!userId) return { type: "text", text };
  return {
    type: "textV2",
    text: "{recipient}\n" + text,
    substitution: {
      recipient: {
        type: "mention",
        mentionee: { type: "user", userId },
      },
    },
  };
}

function roleMessage(text: string, role: { name: string; icon: string }, mentionUserId?: string) {
  const roleIconBase = process.env.LINE_ROLE_ICON_BASE_URL?.replace(/\/$/, "");
  return {
    ...mentionedText(text, mentionUserId),
    sender: {
      name: role.name,
      ...(roleIconBase ? { iconUrl: `${roleIconBase}/${role.icon}.png` } : {}),
    },
  };
}

async function lineRequest(path: string, payload: unknown) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  const result = await fetch(`https://api.line.me/v2/bot/message/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!result.ok) throw new Error(`LINE ${path} failed: ${await result.text()}`);
}

async function reply(replyToken: string, text: string, role?: { name: string; icon: string }, mentionUserId?: string) {
  const message = role
    ? roleMessage(text, role, mentionUserId)
    : mentionedText(text, mentionUserId);
  await lineRequest("reply", { replyToken, messages: [message] });
}

async function replyModeMenu(replyToken: string, _mentionUserId?: string) {
  await lineRequest("reply", {
    replyToken,
    messages: [{
      type: "flex",
      altText: "ITVM V2.5 規劃書與網站開發協作入口",
      contents: {
        type: "bubble",
        hero: {
          type: "image",
          url: "https://line-attendance-system-one.vercel.app/line-group-helper-wallpaper-v2.png",
          size: "full",
          aspectRatio: "16:9",
          aspectMode: "cover",
          action: { type: "uri", label: "閱讀 ITVM V2.5 規劃書", uri: "https://line-attendance-system-one.vercel.app/itvm-plan-reader.html?v=20261105-v25" },
        },
        header: { type: "box", layout: "vertical", backgroundColor: "#0F766E", paddingAll: "16px", contents: [
          { type: "text", text: "ITVM V2.5｜網站開發協作", color: "#FFFFFF", weight: "bold", size: "lg" },
          { type: "text", text: "Trợ lý phát triển website · cập nhật 2026/11/05", color: "#CCFBF1", size: "sm", margin: "sm", wrap: true },
        ] },
        body: { type: "box", layout: "vertical", spacing: "md", contents: [
          { type: "button", style: "primary", color: "#2563EB", action: { type: "message", label: "🛠 Hỗ trợ phát triển", text: "@AI小助手 開發協作" } },
          { type: "text", text: "Som: hãy nêu trang hoặc chức năng đang làm. Trợ lý sẽ giải thích bằng tiếng Việt các yêu cầu, dữ liệu và bảng liên quan trong tài liệu kế hoạch.", wrap: true, size: "xs", color: "#475569" },
          { type: "button", style: "secondary", action: { type: "uri", label: "📚 規劃書 / Tài liệu", uri: "https://line-attendance-system-one.vercel.app/itvm-plan-reader.html?v=20261105-v25" } },
          { type: "text", text: "全群：閱讀最新原文、版本與更新日期\nCả nhóm: đọc bản gốc mới nhất, phiên bản và ngày cập nhật", wrap: true, size: "xs", color: "#475569" },
          { type: "button", style: "primary", color: "#7C3AED", action: { type: "message", label: "🔍 成果審核", text: "@AI小助手 成果審核：" } },
          { type: "text", text: "你與唐老師：提供網址、畫面或操作結果，依規劃書核對網站開發成果。", wrap: true, size: "xs", color: "#475569" },
        ] },
      },
    }],
  });
}

async function reviewPlanInChinese(question: string) {
  const plan = getPlanReference();
  if (!plan) return "目前未載入規劃書。";
  return askAi(
    [
      "你是供林韋成與唐老師使用的 LINE 規劃書審查助手。",
      "只依下方規劃書，以繁體中文回答；指出可對應的章節或表名。",
      "不得自行新增規則、不得洩漏驗收題目、答案或測試步驟。",
      "若尚無網站成果，明確說明目前只能核對規劃書，不能聲稱已驗證。",
      "\n規劃書：\n" + plan,
    ].join("\n"),
    question || "請說明目前可供審查的規劃書功能範圍。",
  );
}

async function introduceRoles(event: LineEvent) {
  const replyToken = event.replyToken;
  if (!replyToken) return;
  const messages = ROLE_COMMANDS.map((role) => roleMessage(role.intro, role));
  await lineRequest("reply", { replyToken, messages: messages.slice(0, 5) });
  if (event.source?.type === "group" && event.source.groupId) {
    await lineRequest("push", { to: event.source.groupId, messages: messages.slice(5) });
  }
}

function rolesForGuidance(text: string) {
  if (/(廠商|職缺|面試|簽約|入職|離職)/.test(text)) return ROLE_COMMANDS.filter((role) => ["台灣廠商", "台灣管理端"].includes(role.name));
  if (/(代辦|權限碼|推薦)/.test(text)) return ROLE_COMMANDS.filter((role) => ["外國代辦", "台灣管理端"].includes(role.name));
  if (/(學校|方案|名額|課程)/.test(text)) return ROLE_COMMANDS.filter((role) => ["台灣學校", "外國學校"].includes(role.name));
  return ROLE_COMMANDS.filter((role) => ["外籍學生", "台灣管理端"].includes(role.name));
}

async function respondToGuidance(event: LineEvent, guidance: string) {
  const replyToken = event.replyToken;
  const plan = getPlanReference();
  if (!replyToken || !plan) return;
  const messages = await Promise.all(rolesForGuidance(guidance).map(async (role) => {
    const opinion = await askAi(
      [
        role.prompt,
        "你正在看到群組中的指導訊息。請以真實使用者身分，主動但克制地提出對此指導的實務意見或需要留意的使用情境。",
        "只能根據下方規劃書；不新增功能或規則。若引用規定，指出章節或表名。",
        "不得透露任何驗收題、答案、測試步驟或保密情境。以繁體中文、第一人稱、80字內。",
        "\n規劃書：\n" + plan,
      ].join("\n"),
      guidance,
    );
    return roleMessage(opinion || "我會依這項指導，在實際操作時確認流程是否順暢。", role);
  }));
  await lineRequest("reply", { replyToken, messages });
}

async function handleText(event: LineEvent) {
  const text = event.message?.text?.trim();
  const replyToken = event.replyToken;
  if (!text || !replyToken) return;

  const somUserId = process.env.LINE_SOM_USER_ID;
  const tangTeacherUserId = process.env.LINE_TANG_TEACHER_USER_ID;
  const isSom = Boolean(somUserId && event.source?.userId === somUserId);
  const isTangTeacher = Boolean(tangTeacherUserId && event.source?.userId === tangTeacherUserId);

  const botMention = event.message?.mention?.mentionees?.find((item) => item.type === "user" && item.isSelf);
  // LINE's group picker does not expose an Official Account as a mention target.
  // Keep a deliberately narrow text command as the control surface for this bot.
  const botWasMentioned = Boolean(botMention) || text.trimStart().startsWith("@AI小助手");

  if (botWasMentioned && text.includes("大家來自我介紹")) {
    await reply(replyToken, "六位虛擬評審已待命；後續只會依群組中的指導，以真實使用者立場提出意見或進行驗證。", undefined, event.source?.type === "group" ? event.source?.userId : undefined);
    return;
  }

  const commandText = text.trimStart().replace(/^@AI小助手\s*/i, "").trim();
  if (botWasMentioned && (!commandText || commandText === "模式" || commandText === "小助手")) {
    await replyModeMenu(replyToken, event.source?.type === "group" ? event.source?.userId : undefined);
    return;
  }
  if (botWasMentioned && /^開發協作/.test(commandText)) {
    const question = commandText.replace(/^開發協作\s*[:：]?/, "").trim();
    const response = question
      ? await explainPlanForSom(question)
      : [
          "Theo hướng dẫn của thầy, trước tiên hãy thiết kế phần dành cho học viên.",
          "",
          "Hãy gửi theo mẫu này:",
          "@AI小助手 開發協作：Tôi đang làm [tên trang hoặc chức năng]. Vui lòng giải thích yêu cầu, dữ liệu cần có và bảng liên quan trong tài liệu kế hoạch.",
          "",
          "Ví dụ:",
          "@AI小助手 開發協作：Tôi đang làm trang đăng nhập và đăng ký học viên. Vui lòng giải thích yêu cầu, dữ liệu cần có và bảng liên quan.",
        ].join("\n");
    await reply(replyToken, response, undefined, event.source?.type === "group" ? event.source?.userId : undefined);
    return;
  }
  if (botWasMentioned && /^審查/.test(commandText)) {
    const question = commandText.replace(/^審查\s*[:：]?/, "").trim();
    const response = await reviewPlanInChinese(question);
    await reply(replyToken, response, undefined, event.source?.type === "group" ? event.source?.userId : undefined);
    return;
  }
  if (botWasMentioned && /^(?:閱讀規劃書|規劃書閱讀)/.test(commandText)) {
    await reply(replyToken,
      "📚 最新規劃書閱讀頁（V2.5）：\nhttps://line-attendance-system-one.vercel.app/itvm-plan-reader.html?v=20261105-v25\n\n目前版本與更新日期會顯示在閱讀頁上。Som 若看不懂中文，請回到「Hỗ trợ phát triển」並用越南文說明正在製作的頁面或功能，小助手會依最新規劃書說明。\n\nBản gốc tiếng Trung, phiên bản và ngày cập nhật được hiển thị trên trang đọc. Nếu Som chưa hiểu tiếng Trung, hãy quay lại “Hỗ trợ phát triển” và nêu trang/chức năng đang làm bằng tiếng Việt.",
      undefined, event.source?.type === "group" ? event.source?.userId : undefined);
    return;
  }
  if (botWasMentioned && /^成果審核/.test(commandText)) {
    const evidence = commandText.replace(/^成果審核\s*[:：]?/, "").trim();
    const response = await reviewPlanInChinese(evidence
      ? `以下是網站成果或操作證據，請只依規劃書比對可觀察到的內容：\n${evidence}`
      : "請先提供可開啟網址、畫面截圖或操作結果，才能依規劃書進行成果審核。");
    await reply(replyToken, response, undefined, event.source?.type === "group" ? event.source?.userId : undefined);
    return;
  }
  if (botWasMentioned && /^翻譯成越南文\s*[:：]/.test(commandText)) {
    const sourceText = commandText.replace(/^翻譯成越南文\s*[:：]/, "").trim();
    const translation = sourceText ? await translateTeacherEnglishToVietnamese(sourceText) : "Vui lòng cung cấp nội dung tiếng Anh cần dịch.";
    await reply(replyToken, translation, undefined, event.source?.type === "group" ? event.source?.userId : undefined);
    return;
  }
  if (botWasMentioned && /^(?:我是\s*Som|toi\s+la\s+Som|tôi\s+là\s+Som)$/i.test(commandText)) {
    if (event.source?.userId) console.info("LINE_SOM_BIND_CANDIDATE", event.source.userId);
    await reply(
      replyToken,
      "Đã nhận yêu cầu xác nhận Som. Sau khi quản trị viên hoàn tất thiết lập, các tin nhắn của bạn sẽ được dịch sang tiếng Trung.",
      undefined,
      event.source?.type === "group" ? event.source?.userId : undefined,
    );
    return;
  }

  if (botWasMentioned && /^(?:@AI小助手\s*)?(?:規劃書|ke hoach|kế hoạch)\s*[:：]?/i.test(text.trimStart())) {
    const question = text
      .trimStart()
      .replace(/^@AI小助手\s*/i, "")
      .replace(/^(?:規劃書|ke hoach|kế hoạch)\s*[:：]?/i, "")
      .trim();
    const response = await explainPlanForSom(question || "Hãy giải thích cách bắt đầu phần giao diện đăng nhập phía học viên.");
    await reply(replyToken, response || "Vui lòng nêu rõ phần, bảng hoặc trường dữ liệu bạn muốn tra cứu trong tài liệu kế hoạch.", undefined, event.source?.type === "group" ? event.source?.userId : undefined);
    return;
  }

  if (botWasMentioned) {
    const source = botMention
      ? `${text.slice(0, botMention.index ?? 0)}${text.slice((botMention.index ?? 0) + (botMention.length ?? 0))}`.trim()
      : text.trimStart().replace(/^@AI小助手\s*/, "").trim();
    const status = source.includes("狀態")
      ? "目前待命。你可標註六個角色進行網站驗收，或提供成果網址、畫面與操作結果讓角色回覆。"
      : "標註已收到。翻譯由群組成員自行處理；需要驗收時，請標註對應角色並附上網址、畫面或操作結果。";
    await reply(replyToken, status, undefined, event.source?.type === "group" ? event.source?.userId : undefined);
    return;
  }

  const directorIds = new Set(
    [process.env.LINE_DEVELOPER_USER_ID, ...(process.env.LINE_REVIEW_DIRECTOR_USER_IDS || "").split(",")]
      .map((id) => id?.trim())
      .filter(Boolean),
  );
  const isGuidance = /(請|先|要|需|建議|應|老師|指導|網站|開發|規劃|文件|登入|資料|驗收)/.test(text);
  const isGroupGuidance = event.source?.type === "group" && /^(?:請|老師)/.test(text.trim());
  if (isGuidance && (isGroupGuidance || (event.source?.userId && directorIds.has(event.source.userId)))) {
    await respondToGuidance(event, text);
    return;
  }

  // 唐老師中文維持原文不回覆；群組內純英文通知自動提供越南文，無須下翻譯指令。
  // 完成唐老師身分綁定後會以 LINE_TANG_TEACHER_USER_ID 精準限制；目前只處理純英文，避免碰中文與越南文。
  const isEnglishOnly = /[A-Za-z]{3,}/.test(text) && !/[\u4e00-\u9fff\u00C0-\u024F]/.test(text);
  if ((isTangTeacher || event.source?.type === "group") && isEnglishOnly) {
    const translation = await translateTeacherEnglishToVietnamese(text);
    if (translation) await reply(replyToken, translation, undefined, event.source?.type === "group" ? event.source?.userId : undefined);
    return;
  }

  if (isSom) {
    const translation = await translateSomToChinese(text);
    if (translation) {
      await reply(replyToken, `Som 的中文翻譯：\n${translation}`, undefined, event.source?.type === "group" ? event.source?.userId : undefined);
    }
    return;
  }

  const role = ROLE_COMMANDS.find((item) => text.includes(item.tag));
  if (!role) return;
  const request = text.replace(role.tag, "").trim();
  const response = await askAi(
    [
      role.prompt,
      `你的內部驗證範圍是：${role.coverage}。`,
      "你必須站在真實使用者立場，操作網站提供的網址、畫面或操作結果，不是只做需求審閱。",
      "內部建立驗證項目前，先將每一項的正確答案定位到規劃書的章節與表名；找不到直接依據的項目不得成為考題。",
      "僅在被標註後回覆。以繁體中文、第一人稱、150字內回報已觀察到的實際行為是否符合規劃書。",
      "題目、答案、測試步驟與保密測試情境一律不公開；只能公開不符結果及其規劃書章節／表名。",
      "沒有網址、畫面或操作結果時，僅要求提供可供實測的材料；不要假裝已操作，也不要自行新增功能或規則。",
      "不要主動聊天、不要翻譯、不要假裝已操作未提供的網站。",
      "\n規劃書：\n" + getPlanReference(),
    ].join("\n"),
    request,
  );
  await reply(replyToken, response || "請提供測試網址、畫面或操作結果。", role, event.source?.type === "group" ? event.source?.userId : undefined);
}

export const config = { api: { bodyParser: false } };

export default async function handler(request: any, response: any) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed" });
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return sendJson(response, 503, { error: "LINE_CHANNEL_SECRET is not configured" });

  const rawBody = await readRawBody(request);
  if (!verifySignature(rawBody, request.headers["x-line-signature"], secret)) {
    return sendJson(response, 401, { error: "Invalid LINE signature" });
  }

  const body = JSON.parse(rawBody.toString("utf8"));
  for (const event of body.events || []) {
    if (event.type === "message" && event.message?.type === "text") {
      try {
        await handleText(event);
      } catch (error) {
        console.error("LINE group handler failed", error);
      }
    }
  }
  sendJson(response, 200, { ok: true });
}
