import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { GoogleGenAI, Type } from "npm:@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { rows } = await req.json();
    
    if (!rows || !Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: "No rows provided or rows is not an array format." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY environment variable is not set." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const promptText = `
You are an expert data parser. Parse the following messy company contact rows from a Georgian Excel sheet.
For each row object:
1. Parse the "contact_cell" (კონტაქტი) and "accountant_cell" (ბუღალტერის საკონტაქტო) into clean Vendor Contacts array.
   Each contact MUST have:
   - "name": Clean Georgian name. Clean out parenthetical names or comments.
   - "phone": Structured phone numbers (e.g. 595xxxxxx or similar mobile/direct lines, containing only digits, or nicely structured space/dashes). Clean extraneous chars.
   - "position": One of "accountant", "director", "operator", "other". (e.g. ბუღალტერი -> accountant, დირექტორი -> director, ოპერატორი -> operator, otherwise other).
   - "note": Notes about this specific person (e.g. "former employee", "left company", "call here", etc.). Keep original context.
   - "is_default": Boolean. True for the FIRST contact or principal contact found, false for others.
2. Parse the comments and date-related logs from "comment_cell" (შენიშვნა/მთავარი კომენტარი), "last_pickup_cell" (ბოლო გატანა), "contact_time_cell" (მოკითხვის დრო), "may_comments_cell" (კომენტარი მაისი), and "april_comments_cell" (კომენტარი აპრილი) into clean Comments array of objects.
   Each comment MUST have:
   - "comment": The clean Georgian text comment.
   - "date": Date in "YYYY-MM-DD" format. (If from "კომენტარი მაისი" or "კომენტარი აპრილი", use 2026-05-15 or 2026-04-15 as approximations, or parse if there is an explicit date inside like "07.05ში").
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
    
    return new Response(JSON.stringify({ success: true, data: parsedData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error("Gemini batch parse exception:", e);
    return new Response(JSON.stringify({ error: e.message || "Failed to process text columns using Gemini API" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
