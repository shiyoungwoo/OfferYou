// Quick Gemini API test — run with: node scripts/test-gemini.mjs
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY. Set it in the local shell or .env.local before running this script.");
  process.exit(1);
}

console.log("Using API Key:", `${apiKey.slice(0, 6)}...`);

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: { responseMimeType: "application/json" },
});

const result = await model.generateContent(
  `You are a recruiter. Analyze this JD vs resume.
JD: "Looking for an AI Product Manager with 3+ years experience in ML products."
Resume: "3 years banking experience. Built an AI resume tool called OfferYou."
Return JSON: { "fitScore": <0-100>, "strengths": ["..."], "gaps": ["..."] }`
);

console.log("Response:", result.response.text());
