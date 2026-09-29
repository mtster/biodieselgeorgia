import express from "express";
import { GoogleGenAI, Type } from "@google/genai";

const router = express.Router();

// Dedicated endpoint for Excel batch row Gemini parsing
router.post("/api/import-excel", async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: "No rows provided or invalid format." });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not set." });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const promptText = `
You are an expert data parser. Parse the following messy company contact rows from a Georgian Excel sheet.
For each row object:
1. Parse the "contact_cell" (კონტაქტი) and "accountant_cell" (ბუღალტერის საკონტაქტო) into clean Vendor Contacts array.
   Each contact MUST have:
   - "name": Clean Georgian name. Clean out parenthetical names or comments.
   - "phone": Structured phone numbers (e.g. 595xxxxxx or similar mobile/direct lines, containing only digits, or nicely structured space/dashes). Clean extraneous chars.
   - "position": One of "accountant", "director", "operator", "other".
   - "note": Notes about this specific person.
   - "is_default": Boolean. True for the FIRST contact or principal contact found, false for others.
2. Parse the comments and date-related logs from "comment_cell", "last_pickup_cell", "contact_time_cell", "may_comments_cell", and "april_comments_cell" into clean Comments array of objects.
   Each comment MUST have:
   - "comment": The clean Georgian text comment.
   - "date": Date in "YYYY-MM-DD" format.
   - "user_name": "System Import"

Return a structured JSON array with one object for each input string matching the "row_id".

Input Rows:
${JSON.stringify(rows, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              row_id: { type: Type.STRING },
              contacts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    position: { type: Type.STRING },
                    note: { type: Type.STRING },
                    is_default: { type: Type.BOOLEAN }
                  },
                  required: ["name", "phone", "position", "is_default"]
                }
              },
              comments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    comment: { type: Type.STRING },
                    date: { type: Type.STRING },
                    user_name: { type: Type.STRING }
                  },
                  required: ["comment", "date", "user_name"]
                }
              }
            },
            required: ["row_id", "contacts", "comments"]
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || "[]");
    res.json({ success: true, data: parsedData });
  } catch (e: any) {
    console.error("Gemini batch parse server error:", e);
    res.status(500).json({ error: e.message || "Failed to process rows using Gemini" });
  }
});

export default router;
