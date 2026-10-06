import { GoogleGenAI } from '@google/genai';

/**
 * Single instance of the Google Gen AI client shared across the app.
 * It automatically uses the GEMINI_API_KEY environment variable.
 */

export const ai = new GoogleGenAI();
