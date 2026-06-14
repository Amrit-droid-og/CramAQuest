import { GoogleGenAI } from '@google/genai';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import scrapedQuestions from '../data/scraped_questions.json';


// Synchronous string hashing for caching text/base64 keys
function getStringHash(str) {
  let hash = 0;
  if (!str || str.length === 0) return '0';
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Global cache handler
async function getOrGenerateCachedQuest(cacheKey, generateFn) {
  try {
    const cacheRef = doc(db, 'cached_questions', cacheKey);
    const snap = await getDoc(cacheRef);

    if (snap.exists()) {
      const cachedData = snap.data();
      const currentUses = (cachedData.useCount || 0) + 1;

      console.log(`[Cache Hit] Key: ${cacheKey}, Uses: ${currentUses}/${cachedData.maxUses}`);

      if (currentUses >= (cachedData.maxUses || 150)) {
        // Delete cache document asynchronously to save AI quota for subsequent requests
        deleteDoc(cacheRef).catch(err => console.error("Error deleting old cache:", err));
      } else {
        // Increment usage count
        updateDoc(cacheRef, { useCount: currentUses }).catch(err => console.error("Error updating cache useCount:", err));
      }

      return cachedData.data;
    }
  } catch (cacheErr) {
    console.warn("[Cache Error] Failed to read from cache:", cacheErr);
  }

  // Generate new questions
  const generatedData = await generateFn();

  // If it's a fallback/mock, don't cache it!
  if (generatedData && generatedData.isFallback) {
    return generatedData;
  }

  try {
    const cacheRef = doc(db, 'cached_questions', cacheKey);
    const maxUses = Math.floor(Math.random() * 101) + 100; // Random threshold between 100 and 200
    await setDoc(cacheRef, {
      data: generatedData,
      useCount: 1,
      maxUses: maxUses,
      createdAt: new Date().toISOString()
    });
    console.log(`[Cache Write] Key: ${cacheKey}, Max Uses: ${maxUses}`);
  } catch (cacheWriteErr) {
    console.warn("[Cache Error] Failed to write to cache:", cacheWriteErr);
  }

  return generatedData;
}

// Support loading from Vite environment variables (VITE_GEMINI_API_KEY) with a fallback key.
// Can specify multiple keys separated by commas for quota limit.
let GEMINI_API_KEYS = (import.meta.env.VITE_GEMINI_API_KEY || "")
  .split(',')
  .map(k => k.trim())
  .filter(k => k && k !== "YOUR_GEMINI_API_KEY_HERE");

if (GEMINI_API_KEYS.length === 0) {
  // Use the fallback key from environment variables if configured
  const fallbackKey = import.meta.env.VITE_GEMINI_FALLBACK_API_KEY || "";
  if (fallbackKey && fallbackKey !== "YOUR_GEMINI_FALLBACK_API_KEY_HERE") {
    GEMINI_API_KEYS = [fallbackKey];
  }
}

// Extract prompt text and media file from structured Gemini contents
function extractPromptAndMedia(contents) {
  let prompt = "";
  let media = null; // { base64Data, mimeType }

  if (typeof contents === 'string') {
    prompt = contents;
  } else if (Array.isArray(contents)) {
    for (const item of contents) {
      if (typeof item === 'string') {
        prompt = item;
      } else if (item && item.inlineData) {
        media = {
          base64Data: item.inlineData.data,
          mimeType: item.inlineData.mimeType
        };
      }
    }
  }
  return { prompt, media };
}


// Lenient JSON repair helper to fix truncated/cut-off responses
function repairTruncatedJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    // Continue to repair
  }

  console.warn("[JSON Repair] Attempting to repair truncated/cut-off JSON response...");
  let cleaned = text.trim();
  
  // Backtrack to find a point where we can truncate and successfully close brackets/braces
  for (let len = cleaned.length; len > 0; len--) {
    let candidate = cleaned.substring(0, len);
    
    // Check what structures are open at this length
    let stack = [];
    let inString = false;
    let escape = false;
    let broken = false;
    
    for (let i = 0; i < len; i++) {
      const char = candidate[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{' || char === '[') {
          stack.push(char);
        } else if (char === '}') {
          if (stack[stack.length - 1] === '{') {
            stack.pop();
          } else {
            broken = true;
            break;
          }
        } else if (char === ']') {
          if (stack[stack.length - 1] === '[') {
            stack.pop();
          } else {
            broken = true;
            break;
          }
        }
      }
    }
    
    if (broken) continue;
    
    // Close the open brackets
    let suffix = "";
    if (inString) {
      suffix += '"';
    }
    for (let i = stack.length - 1; i >= 0; i--) {
      suffix += stack[i] === '{' ? '}' : ']';
    }
    
    try {
      const parsed = JSON.parse(candidate + suffix);
      console.log(`[JSON Repair] Successfully repaired JSON at length ${len}/${cleaned.length}!`);
      return parsed;
    } catch (err) {
      // Continue backtracking
    }
  }
  
  throw new Error("Could not repair truncated JSON.");
}

// Robust JSON extraction and parsing helper
function extractAndParseJSON(text) {
  if (!text) {
    throw new Error("Empty text received, cannot parse JSON.");
  }
  
  const trimmed = text.trim();
  
  // 1. Direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // 2. Try regex extraction of standard markdown codeblock
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const match = trimmed.match(codeBlockRegex);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch (innerE) {
        // Continue to brace finder
      }
    }
    
    // 3. Try to extract JSON structure between first '{' and last '}' or '[' and ']'
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    
    let candidates = [];
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      candidates.push(trimmed.substring(firstBrace, lastBrace + 1));
    }
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      candidates.push(trimmed.substring(firstBracket, lastBracket + 1));
    }
    
    for (const cand of candidates) {
      try {
        return JSON.parse(cand);
      } catch (innerE) {
        // Continue
      }
    }
    
    // 4. Try lenient repair of truncated/cut-off JSON
    try {
      const repaired = repairTruncatedJSON(trimmed);
      if (repaired) {
        // Validation: Ensure we parsed something useful containing questions
        if (repaired.questions && Array.isArray(repaired.questions) && repaired.questions.length > 0) {
          return repaired;
        }
        if (Array.isArray(repaired) && repaired.length > 0) {
          return repaired;
        }
        for (const key of Object.keys(repaired)) {
          if (Array.isArray(repaired[key]) && repaired[key].length > 0) {
            return repaired;
          }
        }
      }
    } catch (repairErr) {
      // Continue to final error
    }
    
    throw new Error(`Failed to extract valid JSON from LLM response. Original response snippet: ${trimmed.substring(0, 150)}...`);
  }
}

// Fallback generator using Pico Apps' WebSocket Streaming API
async function generateWithPicoWebSocket(contents) {
  const { prompt, media } = extractPromptAndMedia(contents);

  if (media) {
    throw new Error("Pico WebSocket fallback does not support media files.");
  }

  return new Promise((resolve, reject) => {
    try {
      console.log("Attempting Pico WebSocket generation...");
      const ws = new WebSocket("wss://backend.buildpicoapps.com/ask_ai_streaming_v2");
      let accumulatedText = "";
      
      // Safety timeout of 25 seconds
      const timeoutId = setTimeout(() => {
        ws.close();
        reject(new Error("Pico WebSocket generation timed out."));
      }, 25000);

      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({
          appId: "clearly-recently",
          prompt: prompt
        }));
      });

      ws.addEventListener("message", (event) => {
        accumulatedText += event.data;
      });

      ws.addEventListener("close", (event) => {
        clearTimeout(timeoutId);
        if (event.code === 1000) {
          console.log("Success with Pico WebSocket API");
          resolve(accumulatedText);
        } else {
          reject(new Error(`Pico WebSocket closed with error code ${event.code}: ${event.reason}`));
        }
      });

      ws.addEventListener("error", (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Fallback generator using Pico Apps' Aero HTTP LLM API
async function generateWithPicoHttp(contents) {
  const { prompt, media } = extractPromptAndMedia(contents);

  if (media) {
    throw new Error("Pico HTTP fallback does not support media files.");
  }

  console.log("Attempting Pico HTTP generation...");
  const url = import.meta.env.VITE_PICO_HTTP_API_URL || "";
  if (!url || url === "YOUR_PICO_HTTP_API_URL_HERE") {
    throw new Error("Pico HTTP fallback URL is not configured in environment variables.");
  }
  
  // Instruct the API to output strict JSON to match our parser expectations
  const prependedPrompt = "Follow instructions precisely! Respond normally and output ONLY valid JSON matching the schema. Avoid additional explanations. " + prompt;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prependedPrompt })
  });

  if (!response.ok) {
    throw new Error(`Pico HTTP API error (${response.status})`);
  }

  const data = await response.json();
  if (data.status === 'success' && data.text) {
    console.log("Success with Pico HTTP API");
    return data.text;
  }
  throw new Error(data.message || "Invalid response format from Pico HTTP API.");
}

// Dynamically load PDF.js and extract text from base64 PDF data for fallback compatibility
async function extractTextFromPdfBase64(base64Data) {
  if (typeof window === 'undefined') {
    throw new Error("PDF text extraction is only supported in browser environment.");
  }
  
  // Dynamically inject PDF.js script if not present
  if (!window.pdfjsLib) {
    console.log("Loading PDF.js dynamically from CDN...");
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.min.js';
    document.head.appendChild(script);
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load PDF.js script from CDN."));
    });
  }

  const pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

  // Convert base64 to ArrayBuffer
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const pdf = await pdfjsLib.getDocument({ data: bytes.buffer }).promise;
  let extractedText = '';

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    extractedText += `${pageText} `;
  }

  return extractedText.trim();
}

// Robust content generator with model fallbacks, multi-key cycling, and API fallbacks
async function generateContentWithFallback(contents) {
  throw new Error("AI generation is disabled. Only local extracted questions database is allowed.");
  let lastError;
  const { prompt, media } = extractPromptAndMedia(contents);

  // 1. Try Gemini with Key Rotation
  const DISABLE_GEMINI_FOR_TESTING = false;
  if (!DISABLE_GEMINI_FOR_TESTING) {
    for (let keyIndex = 0; keyIndex < GEMINI_API_KEYS.length; keyIndex++) {
      const key = GEMINI_API_KEYS[keyIndex];
      const aiClient = new GoogleGenAI({ apiKey: key });
      
      const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      
      for (const model of models) {
        let retries = 2;
        let delay = 1000;

        while (retries > 0) {
          try {
            console.log(`Attempting Gemini: Model=${model}, KeyIndex=${keyIndex + 1}/${GEMINI_API_KEYS.length}...`);
            const response = await aiClient.models.generateContent({
              model: model,
              contents: contents,
              config: {
                responseMimeType: 'application/json',
              }
            });
            
            if (response && response.text) {
              console.log(`Success with Gemini: Model=${model}, KeyIndex=${keyIndex + 1}`);
              return response.text;
            }
            throw new Error(`Gemini model ${model} returned empty response.`);
          } catch (error) {
            lastError = error;
            const errStr = error.toString();
            console.warn(`Gemini error (Model=${model}, KeyIndex=${keyIndex}):`, errStr);
            
            // Check for transient server errors, rate limits, or quota limits
            const isTransient = errStr.includes("503") || errStr.includes("429") || errStr.includes("UNAVAILABLE") || errStr.includes("overload") || errStr.includes("Quota") || errStr.includes("quota");
            
            if (isTransient && retries > 1) {
              console.warn(`Transient/Quota error. Retrying in ${delay}ms...`);
              retries--;
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
            } else {
              // Error not transient or retries exhausted, swap model/key
              break;
            }
          }
        }
      }
    }
  }

  // Prep fallback contents (if PDF or text file, try to extract text client-side for compatibility with text-only fallbacks)
  let fallbackContents = contents;
  if (media) {
    console.log("Fallback media detected in pipeline:", { mimeType: media.mimeType, base64Length: media.base64Data?.length });
    const isPdf = media.mimeType && media.mimeType.toLowerCase().includes('pdf');
    const isText = media.mimeType && (
      media.mimeType.toLowerCase().startsWith('text/') || 
      media.mimeType.toLowerCase().includes('json') ||
      media.mimeType.toLowerCase().includes('javascript')
    );
    
    if (isPdf) {
      try {
        console.log("PDF file detected and Gemini failed. Extracting text client-side for fallback compatibility...");
        const extractedText = await extractTextFromPdfBase64(media.base64Data);
        if (extractedText) {
          fallbackContents = `${prompt}\n\nSTUDY MATERIAL EXTRACTED FROM UPLOADED PDF:\n${extractedText}`;
          console.log("Successfully extracted text from PDF for fallback routing.");
        }
      } catch (pdfErr) {
        console.warn("Could not extract text from PDF client-side:", pdfErr);
      }
    } else if (isText) {
      try {
        console.log("Text/Markdown file detected and Gemini failed. Decoding content for fallback compatibility...");
        let decodedText = "";
        try {
          decodedText = decodeURIComponent(escape(atob(media.base64Data)));
        } catch (e) {
          decodedText = atob(media.base64Data);
        }
        if (decodedText) {
          fallbackContents = `${prompt}\n\nSTUDY MATERIAL EXTRACTED FROM UPLOADED FILE:\n${decodedText}`;
          console.log("Successfully decoded text file for fallback routing.");
        }
      } catch (decodeErr) {
        console.warn("Could not decode text file base64:", decodeErr);
      }
    } else {
      console.warn(`Uploaded file of type ${media.mimeType} is not supported for text extraction fallback.`);
    }
  }

  // 2. Fallback to Pico WebSocket API (Keyless free fallback)
  try {
    const text = await generateWithPicoWebSocket(fallbackContents);
    if (text) return text;
  } catch (picoWsError) {
    console.warn("Pico WebSocket fallback failed, trying next fallback...", picoWsError);
    lastError = picoWsError;
  }

  // 3. Fallback to Pico HTTP API (Keyless free fallback)
  try {
    const text = await generateWithPicoHttp(fallbackContents);
    if (text) return text;
  } catch (picoHttpError) {
    console.warn("Pico HTTP fallback failed, trying next fallback...", picoHttpError);
    lastError = picoHttpError;
  }

  throw lastError || new Error("All AI models and fallback API providers failed.");
}

const MOCK_FALLBACK_QUEST = {
  questTitle: "Failsafe Quest: General Science & Logic",
  questions: [
    {
      id: "q1",
      questionText: "What is the primary function of the mitochondria in a cell?",
      options: [
        { id: "a", text: "Synthesizing proteins" },
        { id: "b", text: "Producing energy (ATP)" },
        { id: "c", text: "Storing genetic code" },
        { id: "d", text: "Filtering cellular waste" }
      ],
      correctOptionId: "b",
      xpValue: 20,
      learningContext: "Mitochondria are the powerhouses of the cell, converting nutrients into ATP energy."
    },
    {
      id: "q2",
      questionText: "Which chemical element has the symbol 'O' on the periodic table?",
      options: [
        { id: "a", text: "Osmium" },
        { id: "b", text: "Oxygen" },
        { id: "c", text: "Ozone" },
        { id: "d", text: "Gold" }
      ],
      correctOptionId: "b",
      xpValue: 20,
      learningContext: "Oxygen is represented by the symbol O and is essential for aerobic respiration."
    },
    {
      id: "q3",
      questionText: "What is the speed of light in a vacuum?",
      options: [
        { id: "a", text: "Approx. 300,000 km/s" },
        { id: "b", text: "Approx. 150,000 km/s" },
        { id: "c", text: "Approx. 1,000 km/s" },
        { id: "d", text: "Approx. 300 km/h" }
      ],
      correctOptionId: "a",
      xpValue: 30,
      learningContext: "Light travels at roughly 299,792 kilometers per second in a vacuum."
    },
    {
      id: "q4",
      questionText: "Which planet is known as the Red Planet?",
      options: [
        { id: "a", text: "Venus" },
        { id: "b", text: "Jupiter" },
        { id: "c", text: "Mars" },
        { id: "d", text: "Saturn" }
      ],
      correctOptionId: "c",
      xpValue: 20,
      learningContext: "Mars is called the Red Planet due to the iron oxide (rust) on its surface."
    },
    {
      id: "q5",
      questionText: "What is the primary gas found in Earth's atmosphere?",
      options: [
        { id: "a", text: "Oxygen" },
        { id: "b", text: "Carbon Dioxide" },
        { id: "c", text: "Hydrogen" },
        { id: "d", text: "Nitrogen" }
      ],
      correctOptionId: "d",
      xpValue: 30,
      learningContext: "Nitrogen makes up about 78% of the Earth's atmosphere, followed by Oxygen at 21%."
    }
  ]
};

export async function generateQuestFromText(studyMaterial, numQuestions = 5) {
  const cacheKey = `text-${numQuestions}-${getStringHash(studyMaterial)}`;
  try {
    return await getOrGenerateCachedQuest(cacheKey, async () => {
      const prompt = `You are an elite educational game designer for "CramAQuest". Your task is to transform this study material into an engaging, JSON-formatted quiz game.
Extract the most critical concepts, definitions, and facts from the provided content.

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON.
2. Generate exactly ${numQuestions} challenging multiple-choice questions.
3. Make the wrong answers plausible but definitively incorrect.
4. Keep the "learningContext" brief but helpful.

Strict JSON Schema to follow:
{
  "questTitle": "String - A catchy, gamified title for this study session",
  "questions": [
    {
      "id": "String - unique identifier (e.g., q1, q2)",
      "questionText": "String - The actual question",
      "options": [
        {"id": "a", "text": "String"},
        {"id": "b", "text": "String"},
        {"id": "c", "text": "String"},
        {"id": "d", "text": "String"}
      ],
      "correctOptionId": "String - 'a', 'b', 'c', or 'd'",
      "xpValue": "Number - Base XP (e.g., 10, 20, 50 based on difficulty)",
      "learningContext": "String - 1 sentence explaining WHY the answer is correct"
    }
  ]
}

STUDY MATERIAL:
${studyMaterial}
`;
      const responseText = await generateContentWithFallback(prompt);
      return extractAndParseJSON(responseText);
    });
  } catch (error) {
    console.error("All live AI models failed:", error);
    throw new Error("Server overload/error. Please cash out your XP and try again tomorrow!");
  }
}

export async function generateQuestFromFile(base64Data, mimeType, numQuestions = 5) {
  const cacheKey = `file-${numQuestions}-${getStringHash(base64Data)}`;
  try {
    return await getOrGenerateCachedQuest(cacheKey, async () => {
      const prompt = `You are an elite educational game designer for "CramAQuest". Your task is to transform this study document (PDF or Image) into an engaging, JSON-formatted quiz game.
Extract the most critical concepts, definitions, and facts from the provided file.

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON.
2. Generate exactly ${numQuestions} challenging multiple-choice questions.
3. Make the wrong answers plausible but definitively incorrect.
4. Keep the "learningContext" brief but helpful.

Strict JSON Schema to follow:
{
  "questTitle": "String - A catchy, gamified title for this study session",
  "questions": [
    {
      "id": "String - unique identifier (e.g., q1, q2)",
      "questionText": "String - The actual question",
      "options": [
        {"id": "a", "text": "String"},
        {"id": "b", "text": "String"},
        {"id": "c", "text": "String"},
        {"id": "d", "text": "String"}
      ],
      "correctOptionId": "String - 'a', 'b', 'c', or 'd'",
      "xpValue": "Number - Base XP (e.g., 10, 20, 50 based on difficulty)",
      "learningContext": "String - 1 sentence explaining WHY the answer is correct"
    }
  ]
}
`;
      const contents = [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        prompt
      ];
      const responseText = await generateContentWithFallback(contents);
      return extractAndParseJSON(responseText);
    });
  } catch (error) {
    console.error("All live AI models failed for file:", error);
    throw new Error("Server overload/error. Please cash out your XP and try again tomorrow!");
  }
}

export async function generateDailyQuest(classGrade, numQuestions = 5) {
  const todayStr = new Date().toLocaleDateString('sv');
  const cacheKey = `daily-${classGrade}-${numQuestions}-${todayStr}`;
  try {
    return await getOrGenerateCachedQuest(cacheKey, async () => {
      const prompt = `You are an elite educational game designer for "CramAQuest". Your task is to generate a Daily Challenge Quiz for a student in Class ${classGrade} studying under the Indian CBSE Curriculum.
This should cover an engaging mix of age-appropriate general knowledge, basic science, and logic. Ensure the difficulty exactly matches the CBSE syllabus for a Class ${classGrade} student.

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON.
2. Generate exactly ${numQuestions} challenging multiple-choice questions.
3. Make the wrong answers plausible but definitively incorrect.
4. Keep the "learningContext" brief but helpful.

Strict JSON Schema to follow:
{
  "questTitle": "Daily Challenge: Class ${classGrade}",
  "questions": [
    {
      "id": "String - unique identifier (e.g., q1, q2)",
      "questionText": "String - The actual question",
      "options": [
        {"id": "a", "text": "String"},
        {"id": "b", "text": "String"},
        {"id": "c", "text": "String"},
        {"id": "d", "text": "String"}
      ],
      "correctOptionId": "String - 'a', 'b', 'c', or 'd'",
      "xpValue": "Number - Base XP (e.g., 10, 20, 50 based on difficulty)",
      "learningContext": "String - 1 sentence explaining WHY the answer is correct"
    }
  ]
}
`;
      const responseText = await generateContentWithFallback(prompt);
      return extractAndParseJSON(responseText);
    });
  } catch (error) {
    console.error("All live AI models failed for Daily Quest:", error);
    throw new Error("Server overload/error. Please cash out your XP and try again tomorrow!");
  }
}

export async function generateDivyamBatch(classGrade, subject, mode, count = 3, batchIndex = 0) {
  // Try to load from scraped local questions first
  try {
    const gradeKey = classGrade ? classGrade.toString() : "10";
    if (scrapedQuestions && scrapedQuestions[gradeKey] && scrapedQuestions[gradeKey][subject]) {
      const allSubjectQs = scrapedQuestions[gradeKey][subject];
      if (allSubjectQs && allSubjectQs.length > 0) {
        console.log(`[Local Database] Found ${allSubjectQs.length} scraped questions for Class ${gradeKey} ${subject}.`);
        
        // Slicing questions sequentially based on batchIndex and count
        const startIndex = (batchIndex * count) % allSubjectQs.length;
        const selectedQs = [];
        
        for (let i = 0; i < count; i++) {
          const qIdx = (startIndex + i) % allSubjectQs.length;
          const originalQ = allSubjectQs[qIdx];
          
          // Prefix the question ID to ensure uniqueness in React key loops
          selectedQs.push({
            ...originalQ,
            id: `scraped-${gradeKey}-${subject}-${batchIndex}-${qIdx}-${originalQ.id}`,
            xpValue: mode === 'hard' ? 30 : 20 // Adjust XP value based on difficulty mode
          });
        }
        
        return selectedQs;
      }
    }
  } catch (dbErr) {
    console.warn("[Local Database] Error reading scraped questions from local database:", dbErr);
  }

  throw new Error(`AI generation is disabled. No local questions found for Class ${classGrade} ${subject}.`);

  const cacheKey = `divyam-${classGrade}-${subject}-${mode}-${count}-${batchIndex}`;
  try {
    return await getOrGenerateCachedQuest(cacheKey, async () => {
      const difficultyStr = mode === 'hard' ? 'highly advanced, tricky, and difficult' : 'standard difficulty';
      const prompt = `You are an elite educational game designer for "CramAQuest". Your task is to generate a batch of exactly ${count} multiple-choice questions for Divyam Mode.
The target student is in Class ${classGrade} studying under the Indian CBSE Curriculum. The subject is strictly "${subject}". The difficulty should be ${difficultyStr} and strictly follow CBSE syllabus guidelines.

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON.
2. Generate exactly ${count} challenging multiple-choice questions.
3. Make the wrong answers plausible but definitively incorrect.
4. Keep the "learningContext" brief but helpful.

Strict JSON Schema to follow:
{
  "questions": [
    {
      "id": "String - unique identifier (e.g., d1, d2)",
      "questionText": "String - The actual question",
      "options": [
        {"id": "a", "text": "String"},
        {"id": "b", "text": "String"},
        {"id": "c", "text": "String"},
        {"id": "d", "text": "String"}
      ],
      "correctOptionId": "String - 'a', 'b', 'c', or 'd'",
      "xpValue": "Number - Base XP (e.g., 20, 30 based on difficulty)",
      "learningContext": "String - 1 sentence explaining WHY the answer is correct"
    }
  ]
}
`;
      const responseText = await generateContentWithFallback(prompt);
      const parsed = extractAndParseJSON(responseText);
      
      let questions = [];
      if (Array.isArray(parsed)) {
        questions = parsed.slice(0, count);
      } else if (parsed && Array.isArray(parsed.questions)) {
        questions = parsed.questions.slice(0, count);
      } else if (parsed && typeof parsed === 'object') {
        for (const key of Object.keys(parsed)) {
          if (Array.isArray(parsed[key])) {
            questions = parsed[key].slice(0, count);
            break;
          }
        }
      }
      if (questions.length === 0) {
        throw new Error("Could not extract questions array from parsed response.");
      }
      
      // Prefix IDs with batchIndex to prevent clashes when appending multiple batches in one session
      return questions.map((q, idx) => ({
        ...q,
        id: q.id ? `divyam-${batchIndex}-${q.id}` : `divyam-${batchIndex}-${idx}-${Math.random().toString(36).substring(2, 7)}`
      }));
    });
  } catch (error) {
    console.error("All live AI models failed for Divyam Mode:", error);
    throw new Error("Server overload/error. Please cash out your XP and try again tomorrow!");
  }
}

export async function generateFeynmanResponse(chatHistory, topic) {
  const systemPrompt = `You are playing the role of a confused 5th-grade student. The user is trying to teach you the topic: "${topic}".
CRITICAL INSTRUCTIONS:
1. Speak plainly and ask naive, clarifying questions.
2. Do not use complex vocabulary.
3. If the user explains it well, express sudden understanding ("Ohhh, I get it now! So it's like...").
4. If the user explains it poorly or uses big words, say you are confused and ask them to explain it simpler.
5. In your very last sentence, output exactly in this format: [SCORE: X/100] based on how well they taught you. Only do this once you fully understand the topic after a few exchanges.

Respond normally in plain text (no JSON schema required).`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory
  ];

  const fullPrompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n") + "\n\nSTUDENT:";

  try {
    // Note: This uses the robust fallback wrapper but expects plain text, not JSON.
    // To support plain text properly we'd need to modify generateContentWithFallback, 
    // but we can just use extractPromptAndMedia since it supports plain text generation.
    // For simplicity, we just pass it to the same fallback chain and parse as string.
    
    // We bypass extractAndParseJSON for this specific call.
    const responseText = await generateContentWithFallback(fullPrompt);
    
    // Sometimes models still return JSON if forced, we try to extract raw text
    try {
      const parsed = JSON.parse(responseText);
      if (parsed.text) return parsed.text;
      if (parsed.response) return parsed.response;
      return JSON.stringify(parsed);
    } catch {
      return responseText; // It was plain text
    }

  } catch (error) {
    console.error("Feynman fallback failed", error);
    return "I'm still a bit confused. Can you explain that again simpler? [SCORE: 50/100]";
  }
}

export async function generateRandomFlashcard(classGrade) {
  const topics = ["Science", "History", "Geography", "Mathematics", "Civics", "General Knowledge", "Space Science"];
  const subject = topics[Math.floor(Math.random() * topics.length)];
  const prompt = `You are an elite educational game designer for "CramAQuest". Your task is to generate exactly 1 educational multiple-choice question for a Class ${classGrade} student under the Indian CBSE Curriculum.
The subject is strictly "${subject}". The question should be engaging, age-appropriate, and follow CBSE syllabus guidelines.

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON.
2. Generate exactly 1 challenging multiple-choice question.
3. Make the wrong answers plausible but definitively incorrect.
4. Keep the "learningContext" brief but helpful.

Strict JSON Schema to follow:
{
  "id": "String - unique identifier",
  "questionText": "String - The actual question",
  "options": [
    {"id": "a", "text": "String"},
    {"id": "b", "text": "String"},
    {"id": "c", "text": "String"},
    {"id": "d", "text": "String"}
  ],
  "correctOptionId": "String - 'a', 'b', 'c', or 'd'",
  "xpValue": 15,
  "learningContext": "String - 1 sentence explaining WHY the answer is correct"
}
`;
  const responseText = await generateContentWithFallback(prompt);
  const parsed = extractAndParseJSON(responseText);
  
  if (parsed && parsed.questionText && parsed.options) {
    return parsed;
  }
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed[0];
  }
  if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
    return parsed.questions[0];
  }
  throw new Error("Could not parse single flashcard question.");
}

export async function generateDoomscrollBatch(classGrade, subject, count = 3) {
  const prompt = `You are an elite educational game designer for "CramAQuest". Your task is to generate a batch of exactly ${count} educational multiple-choice questions for a student in Class ${classGrade} studying under the Indian CBSE Curriculum.
The subject/topic is strictly "${subject}". The difficulty should be standard and follow CBSE syllabus guidelines.

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON.
2. Generate exactly ${count} challenging multiple-choice questions.
3. Make the wrong answers plausible but definitively incorrect.
4. Keep the "learningContext" brief but helpful.

Strict JSON Schema to follow:
{
  "questions": [
    {
      "id": "String - unique identifier",
      "questionText": "String - The actual question",
      "options": [
        {"id": "a", "text": "String"},
        {"id": "b", "text": "String"},
        {"id": "c", "text": "String"},
        {"id": "d", "text": "String"}
      ],
      "correctOptionId": "String - 'a', 'b', 'c', or 'd'",
      "xpValue": 10,
      "learningContext": "String - 1 sentence explaining WHY the answer is correct"
    }
  ]
}
`;
  try {
    const responseText = await generateContentWithFallback(prompt);
    const parsed = extractAndParseJSON(responseText);
    
    let questions = [];
    if (Array.isArray(parsed)) {
      questions = parsed.slice(0, count);
    } else if (parsed && Array.isArray(parsed.questions)) {
      questions = parsed.questions.slice(0, count);
    } else if (parsed && typeof parsed === 'object') {
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          questions = parsed[key].slice(0, count);
          break;
        }
      }
    }
    if (questions.length === 0) {
      throw new Error("Could not extract questions array from parsed response.");
    }
    
    // Assign guaranteed unique IDs to prevent matching previously answered questions
    return questions.map((q, idx) => ({
      ...q,
      id: `ds-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`
    }));
  } catch (error) {
    console.error("All live AI models failed for Doomscroll:", error);
    throw new Error("Server overload/error. Please cash out your XP and try again tomorrow!");
  }
}
