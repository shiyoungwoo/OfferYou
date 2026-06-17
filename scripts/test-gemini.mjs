// Quick Gemini API test — run with: node scripts/test-gemini.mjs
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY. Set it in the local shell or .env.local before running this script.");
  process.exit(1);
}

console.log("Using API Key:", `${apiKey.slice(0, 6)}...`);

const ai = new GoogleGenAI({ apiKey });

const response = await ai.models.generateContent({
  model: process.env.GEMINI_MODEL_SIMPLE ?? "gemini-2.5-flash",
  contents: `You are a recruiter. Analyze this JD vs resume.
JD: "Looking for an AI Product Manager with 3+ years experience in ML products."
Resume: "3 years banking experience. Built an AI resume tool called OfferYou."
Return JSON: { "fitScore": <0-100>, "strengths": ["..."], "gaps": ["..."] }`,
  config: {
    responseMimeType: "application/json",
  },
});

console.log("Response:", response.text);
