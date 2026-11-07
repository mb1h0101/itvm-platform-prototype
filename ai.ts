type AiTask = "intro" | "translation" | "summary" | "questions";

type AiRequest = {
  task: AiTask;
  locale?: string;
  studentName: string;
  country: string;
  targetDepartment: string;
  motivation: string;
  chineseLevel: string;
  nativeLanguage?: string;
  context?: string;
};

type AiResponse = {
  text?: string;
  choices?: Array<{ message?: { content?: string }; text?: string }>;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

const aiEndpoint = import.meta.env.VITE_AI_API_ENDPOINT || "/api/student-prep";
const aiApiKey = import.meta.env.VITE_AI_API_KEY;

export const isExternalAiConfigured = Boolean(aiEndpoint);

function extractAiText(payload: AiResponse) {
  return (
    payload.text ||
    payload.choices?.[0]?.message?.content ||
    payload.choices?.[0]?.text ||
    payload.output?.[0]?.content?.[0]?.text ||
    ""
  ).trim();
}

export async function generateStudentAiText(request: AiRequest, fallback: () => string) {
  if (!aiEndpoint) return fallback();

  try {
    const response = await fetch(aiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(aiApiKey ? { Authorization: `Bearer ${aiApiKey}` } : {}),
      },
      body: JSON.stringify({
        ...request,
        system:
          "You help Taiwanese school administrators prepare concise, culturally respectful international student service material. Use Traditional Chinese unless a bilingual translation is requested.",
      }),
    });

    if (!response.ok) throw new Error(`AI endpoint returned ${response.status}`);
    const payload = (await response.json()) as AiResponse;
    return extractAiText(payload) || fallback();
  } catch (error) {
    console.warn("External AI failed, using local fallback.", error);
    return fallback();
  }
}
