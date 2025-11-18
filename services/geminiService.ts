import { GoogleGenAI } from "@google/genai";

// Initialize the client with the API key from the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateCatName = async (): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Generate a single, creative, playful, and unique name for a street cat in Istanbul. Return ONLY the name, no other text or punctuation.',
    });
    
    const text = response.text;
    if (!text) return "Whiskers";
    
    // Clean up any potential extra whitespace or quotes
    return text.trim().replace(/["']/g, "");
  } catch (error) {
    console.error("Failed to generate cat name:", error);
    return "Gemini"; // Fallback name
  }
};
