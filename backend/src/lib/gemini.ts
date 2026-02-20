import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

export const getGeminiModel = () => {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(API_KEY);
  }

  // TODO: Switch to the stable release once gemini-3-flash graduates from preview.
  return genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
};
