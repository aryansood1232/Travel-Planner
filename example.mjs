import { GoogleGenAI } from "@google/genai";

// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI({});
  const userPrompt = `
    Generate a detailed daily travel itinerary for a trip to  from  to 
    The user's interests include: || 'no specific interests'}.
    
    Include famous attractions and local hidden gems. Structure it day-by-day.
  `;

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: userPrompt,
  });
  console.log(response.text);
}

main();