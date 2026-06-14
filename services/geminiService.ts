/**
 * Original app services. All Gemini calls go through the server-side proxy
 * (/api/orig/*) — NO API key is shipped to the browser.
 */
import { AnalysisResult, Language, WritingResult, ChatMessage, StoryImage } from "../types";
import { blobToBase64 } from "../utils/audioUtils";

async function apiBuffer(path: string, body: unknown): Promise<Blob> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`${r.status} ${t.slice(0, 160)}`);
  }
  return r.blob();
}
async function apiJson<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`${r.status} ${t.slice(0, 160)}`);
  }
  return r.json() as Promise<T>;
}

/** Generate reference audio for the given text (server-side Gemini TTS). */
export const generateReferenceAudio = async (text: string, _language: Language): Promise<Blob> =>
  apiBuffer("/api/orig/reference", { text, lang: _language });

/** Generate a "Teacher Mode" cumulative shadowing drill (built server-side). */
export const generateTeacherAudio = async (text: string, _language: Language): Promise<Blob> =>
  apiBuffer("/api/orig/teacher", { text, lang: _language });

/** Analyze user pronunciation via the server proxy. */
export async function analyzePronunciation(
  userAudioBlob: Blob, referenceText: string, language: Language
): Promise<AnalysisResult> {
  try {
    const base64Audio = await blobToBase64(userAudioBlob);
    const mimeType = userAudioBlob.type || "audio/webm";
    return await apiJson<AnalysisResult>("/api/orig/analyze", {
      audioBase64: base64Audio, mimeType, text: referenceText, lang: language,
    });
  } catch (error) {
    console.error("Error analyzing audio:", error);
    return {
      score: 0,
      feedback: "Analysis timed out or failed. Please try recording a shorter clip.",
      wordsToImprove: [],
    };
  }
}

/** Generate a writing prompt or fill-in-the-blank exercise. */
export const generateWritingPrompt = async (
  storyContent: string, language: Language, mode: "fill-in-the-blank" | "full-story"
): Promise<{ prompt: string; solution?: string }> =>
  apiJson("/api/orig/writing-prompt", { storyContent, lang: language, mode });

/** Correct and improve a user's written story. */
export const correctAndImproveStory = async (
  userInput: string, language: Language, contextStory: string
): Promise<WritingResult> =>
  apiJson("/api/orig/correct", { userInput, lang: language, contextStory });

/** Generate an image for a story + vocabulary coordinates. */
export const generateStoryImage = async (
  storyContent: string, vocabulary: string[], language: Language
): Promise<Omit<StoryImage, "id">> => {
  const out = await apiJson<{ imageUrl: string; labels: { word: string; x: number; y: number }[] }>(
    "/api/orig/image", { storyContent, vocabulary, lang: language }
  );
  return { storyId: 0, imageUrl: out.imageUrl, labels: out.labels };
};

/**
 * Start a teacher chat. Returns an object with sendMessage({message}) that
 * routes through the stateless server proxy, maintaining history in-memory.
 */
export const startTeacherChat = (storyContent: string, language: Language) => {
  const systemInstruction = `You are a friendly ${language} teacher.
      The student just read this story: "${storyContent}".
      Engage them in a conversation about the story.
      Ask questions, encourage them to use the vocabulary, and gently correct their mistakes.
      Keep your responses relatively short (2-3 sentences).`;
  const history: ChatMessage[] = [];
  return {
    sendMessage: async ({ message }: { message: string }) => {
      const out = await apiJson<{ reply: string }>("/api/orig/chat", { systemInstruction, history, message });
      history.push({ role: "user", text: message });
      history.push({ role: "model", text: out.reply });
      return { text: out.reply };
    },
  };
};

/** Generate final feedback for a conversation. */
export const generateConversationFeedback = async (
  history: ChatMessage[], language: Language
): Promise<{ score: number; feedback: string }> => {
  try {
    return await apiJson("/api/orig/conv-feedback", { history, lang: language });
  } catch (error) {
    console.error("Error generating conversation feedback:", error);
    return { score: 0, feedback: "Could not generate feedback." };
  }
};
