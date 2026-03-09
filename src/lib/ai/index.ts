import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

let _model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (!_model) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    _model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }
  return _model;
}

export async function generateContent(prompt: string): Promise<string> {
  const result = await getModel().generateContent(prompt);
  return result.response.text();
}

export async function generateElementText(
  topic: string,
  elementLabel: string,
  templateName: string
): Promise<string> {
  return generateContent(
    `You are writing text for a short-form video (Instagram Reel / TikTok).
Template: "${templateName}"
Element: "${elementLabel}"
Topic: "${topic}"

Generate a short, engaging text that fits this element's purpose in the video.
Keep it concise (under 15 words unless it's clearly a longer caption).
Return only the text, nothing else.`
  );
}
