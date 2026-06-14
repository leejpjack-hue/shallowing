
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AnalysisResult, Language, WritingResult, ChatMessage, StoryImage } from "../types";
import { decodeBase64, pcmToWav, blobToBase64, base64ToInt16, createSilence, concatenateBuffers } from "../utils/audioUtils";
import { compressImage } from "../utils/imageUtils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates audio for the given text using Gemini TTS.
 * Returns a Blob that can be played or cached.
 */
export const generateReferenceAudio = async (text: string, language: Language): Promise<Blob> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Kore' is multilingual and handles both French and Japanese well.
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini.");
    }

    return processAudioResponse(base64Audio);

  } catch (error) {
    console.error("Error generating reference audio:", error);
    throw error;
  }
};

/**
 * Generates a "Teacher Mode" audio where the model breaks down sentences
 * and leaves calculated pauses for the student to repeat.
 */
export const generateTeacherAudio = async (text: string, language: Language): Promise<Blob> => {
  try {
    // Step 1: Generate the script/breakdown using the Text model
    const scriptPrompt = `
      You are a ${language} teacher creating a "shadowing" drill.
      Break down the following ${language} text into cumulative chunks for a student to repeat.
      
      For each sentence in the text, follow this pattern:
      1. Small chunk
      2. Medium chunk (cumulative)
      3. Full sentence
      
      Example Input (French): "Je me réveille à sept heures."
      Example Output JSON: ["Je", "Je me réveille", "Je me réveille à sept heures"]

      Example Input (Japanese): "私は東京に住んでいます。"
      Example Output JSON: ["私は", "私は東京に", "私は東京に住んでいます。"]

      Input text: "${text}"
      
      Return strictly a JSON array of strings. No markdown formatting.
    `;

    const scriptResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: scriptPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const scriptJson = scriptResponse.text;
    if (!scriptJson) throw new Error("Failed to generate shadowing script.");
    
    let phrases: string[] = [];
    try {
      phrases = JSON.parse(scriptJson);
    } catch (e) {
      console.error("Failed to parse script JSON", e);
      // Fallback simple split if JSON fails.
      const separator = language === 'japanese' ? /[。！？]/ : /[.!?]/;
      phrases = text.split(separator).filter(s => s.trim().length > 0);
    }

    // Step 2: Generate Audio for each phrase in PARALLEL to speed up processing
    const SAMPLE_RATE = 24000;
    
    // Create promises for all chunks
    const audioPromises = phrases.map(async (phrase) => {
      if (!phrase.trim()) return null;

      try {
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: phrase }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Zephyr' }, 
              },
            },
          },
        });

        const base64Part = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Part) {
          const audioBuffer = base64ToInt16(base64Part);
          
          // Calculate duration in seconds
          const duration = audioBuffer.length / SAMPLE_RATE;
          
          // Optimized wait time: slightly faster pacing
          // Minimum 1s, Max 4s, usually 1.2x duration
          const waitTime = Math.min(4, Math.max(1.0, duration * 1.2));
          const silenceBuffer = createSilence(waitTime, SAMPLE_RATE);

          return { audio: audioBuffer, silence: silenceBuffer };
        }
        return null;
      } catch (e) {
        console.error(`Failed to generate audio for phrase: ${phrase}`, e);
        return null;
      }
    });

    // Wait for all chunks to be generated
    const results = await Promise.all(audioPromises);

    // Step 3: Concatenate valid results
    const allBuffers: Int16Array[] = [];
    
    for (const result of results) {
      if (result) {
        allBuffers.push(result.audio);
        allBuffers.push(result.silence);
      }
    }

    if (allBuffers.length === 0) {
      throw new Error("No audio generated for teacher mode.");
    }

    // Return final WAV
    const finalBuffer = concatenateBuffers(allBuffers);
    return pcmToWav(finalBuffer, SAMPLE_RATE);

  } catch (error) {
    console.error("Error generating teacher audio:", error);
    throw error;
  }
};

/**
 * Helper to process raw PCM base64 from Gemini into a WAV blob
 */
function processAudioResponse(base64Audio: string): Blob {
  const rawBytes = decodeBase64(base64Audio);
  const int16Data = new Int16Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength / 2);
  return pcmToWav(int16Data, 24000);
}

/**
 * Analyzes user pronunciation by sending the audio and text to Gemini.
 */
export const analyzePronunciation = async (
  userAudioBlob: Blob,
  referenceText: string,
  language: Language
): Promise<AnalysisResult> => {
  try {
    const base64Audio = await blobToBase64(userAudioBlob);
    
    // Default to 'audio/webm' if null
    const mimeType = userAudioBlob.type || 'audio/webm';

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: {
        parts: [
          {
            text: `Analyze this ${language} student's pronunciation of: "${referenceText}".
            
            Return JSON:
            {
              "score": 0-100,
              "feedback": "Concise corrective feedback (max 2 sentences)",
              "wordsToImprove": ["list", "of", "mispronounced", "words"]
            }`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            feedback: { type: Type.STRING },
            wordsToImprove: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No analysis received.");

    return JSON.parse(resultText) as AnalysisResult;

  } catch (error) {
    console.error("Error analyzing audio:", error);
    return {
      score: 0,
      feedback: "Analysis timed out or failed. Please try recording a shorter clip.",
      wordsToImprove: []
    };
  }
};

/**
 * Generates a writing prompt or fill-in-the-blank exercise based on a story.
 */
export const generateWritingPrompt = async (
  storyContent: string, 
  language: Language, 
  mode: 'fill-in-the-blank' | 'full-story'
): Promise<{ prompt: string; solution?: string }> => {
  try {
    const prompt = mode === 'fill-in-the-blank' 
      ? `Based on this ${language} story: "${storyContent}", create a fill-in-the-blank exercise. 
         Replace 3-5 key words with "____". 
         Return JSON: { "prompt": "The text with blanks", "solution": "The full original text" }`
      : `Based on this ${language} story: "${storyContent}", give the user a prompt to write a similar story. 
         The prompt should be in ${language} and English.
         Return JSON: { "prompt": "The writing prompt" }`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING },
            solution: { type: Type.STRING }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating writing prompt:", error);
    throw error;
  }
};

/**
 * Corrects and improves a user's written story.
 */
export const correctAndImproveStory = async (
  userInput: string,
  language: Language,
  contextStory: string
): Promise<WritingResult> => {
  try {
    const prompt = `
      The user is learning ${language}. They wrote this based on the story: "${contextStory}".
      User Input: "${userInput}"
      
      Please:
      1. Correct any grammatical errors in the user's input.
      2. Provide a "better" version (more natural, more advanced vocabulary).
      3. Provide a brief feedback in English.
      4. Provide phonetic transcription (IPA for French, Romaji for Japanese) for the "better" version.

      Return JSON:
      {
        "original": "${userInput}",
        "corrected": "The grammatically correct version",
        "improved": "A more natural/advanced version",
        "feedback": "Brief encouragement and correction notes",
        "phonetic": "Phonetic transcription of the improved version"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            original: { type: Type.STRING },
            corrected: { type: Type.STRING },
            improved: { type: Type.STRING },
            feedback: { type: Type.STRING },
            phonetic: { type: Type.STRING }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error correcting story:", error);
    throw error;
  }
};

/**
 * Generates an image for a story and identifies vocabulary locations.
 */
export const generateStoryImage = async (
  storyContent: string,
  vocabulary: string[],
  language: Language
): Promise<Omit<StoryImage, 'id'>> => {
  try {
    // Step 1: Generate the image
    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Create a vibrant, detailed illustration for this ${language} story: "${storyContent}". The style should be clean and educational.` }],
      },
    });

    let base64Image = "";
    for (const part of imageResponse.candidates[0].content.parts) {
      if (part.inlineData) {
        base64Image = part.inlineData.data;
        break;
      }
    }

    if (!base64Image) throw new Error("Failed to generate image.");

    // Step 1.5: Compress image to stay under Firestore 1MB limit
    const compressedImage = await compressImage(`data:image/png;base64,${base64Image}`);

    // Step 2: Identify coordinates for vocabulary in the generated image
    // Since we don't have real object detection on the generated image yet, 
    // we'll ask Gemini to "imagine" where these objects would be in the composition it just described.
    const coordPrompt = `
      I just generated an image for this story: "${storyContent}".
      For each of these vocabulary words: ${vocabulary.join(', ')}, 
      estimate their (x, y) coordinates in a 100x100 grid where (0,0) is top-left.
      
      Return JSON: { "labels": [{ "word": "string", "x": number, "y": number }] }
    `;

    const coordResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: coordPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            labels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    const labelsData = JSON.parse(coordResponse.text);

    return {
      storyId: 0, // Will be set by caller
      imageUrl: compressedImage,
      labels: labelsData.labels
    };

  } catch (error) {
    console.error("Error in generateStoryImage:", error);
    throw error;
  }
};

/**
 * Starts a chat session with an AI teacher.
 */
export const startTeacherChat = (storyContent: string, language: Language) => {
  return ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `You are a friendly ${language} teacher. 
      The student just read this story: "${storyContent}".
      Engage them in a conversation about the story. 
      Ask questions, encourage them to use the vocabulary, and gently correct their mistakes.
      Keep your responses relatively short (2-3 sentences).`
    }
  });
};

/**
 * Generates final feedback for a conversation.
 */
export const generateConversationFeedback = async (
  history: ChatMessage[],
  language: Language
): Promise<{ score: number; feedback: string }> => {
  try {
    const prompt = `
      Review this conversation between a ${language} student and a teacher.
      
      Conversation:
      ${history.map(m => `${m.role}: ${m.text}`).join('\n')}
      
      Provide a score (0-100) and constructive feedback on the student's performance.
      Return JSON: { "score": number, "feedback": "string" }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating conversation feedback:", error);
    return { score: 0, feedback: "Could not generate feedback." };
  }
};
