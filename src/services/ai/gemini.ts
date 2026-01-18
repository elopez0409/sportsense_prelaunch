// Gemini AI Service - Game summaries and previews

import { GoogleGenAI } from '@google/genai';
import { createHash } from 'crypto';
import { logger } from '@/lib/logger';
import type { AIGameContext } from '@/types/nba';

export interface ChatResponse {
  text: string;
  model: string;
  tokensUsed?: number;
  error?: string;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.5-flash';

// Log API key info at startup (for debugging quota issues)
function logApiKeyInfo() {
  if (!GEMINI_API_KEY) {
    console.warn('[AI Service] ⚠️ GEMINI_API_KEY not set');
    return;
  }
  const keyHash = createHash('sha256').update(GEMINI_API_KEY).digest('hex').substring(0, 12);
  const keyPrefix = GEMINI_API_KEY.substring(0, 8);
  console.log(`[AI Service] 🔑 API Key: ${keyPrefix}... (hash: ${keyHash}, len: ${GEMINI_API_KEY.length})`);
}

let ai: GoogleGenAI | null = null;
if (GEMINI_API_KEY) {
  try {
    logApiKeyInfo();
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log('[AI Service] GoogleGenAI initialized successfully');
  } catch (error) {
    console.error('[AI Service] Failed to initialize GoogleGenAI:', error);
    ai = null;
  }
}

/**
 * Check if AI is available
 */
export function isAIAvailable(): boolean {
  return !!ai && !!GEMINI_API_KEY;
}

// Generation config for concise responses
const GENERATION_CONFIG = {
  maxOutputTokens: 150,  // ~3-4 sentences max
  temperature: 0.5,
  topK: 40,
  topP: 0.9,
};

/**
 * Generate a pregame preview
 */
export async function generatePregamePreview(
  homeTeam: string,
  awayTeam: string,
  additionalContext?: string
): Promise<ChatResponse> {
  if (!ai || !isAIAvailable()) {
    return {
      text: `${awayTeam} @ ${homeTeam} - AI preview unavailable. Please check configuration.`,
      model: 'unavailable',
      error: 'AI not configured',
    };
  }

  try {
    const prompt = `${awayTeam} @ ${homeTeam} pregame preview.
${additionalContext || ''}

Write 2-3 sentences: key matchup, player to watch, prediction. NO headers, NO bullets.`;

    const requestParams: any = {
      model: MODEL_NAME,
      contents: prompt,
      generationConfig: GENERATION_CONFIG,
    };

    const response = await ai.models.generateContent(requestParams);

    const text = (response as any).text || (response as any).response?.text || (response as any).content || '';

    return {
      text: text || `${awayTeam} @ ${homeTeam} - Preview generated.`,
      model: MODEL_NAME,
    };
  } catch (error) {
    logger.error('Failed to generate pregame preview', error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) });
    return {
      text: `${awayTeam} @ ${homeTeam} - Failed to generate preview.`,
      model: MODEL_NAME,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate halftime or final game summary
 */
export async function generateGameSummary(
  context: AIGameContext,
  type: 'halftime' | 'final'
): Promise<ChatResponse> {
  if (!ai || !isAIAvailable()) {
    return {
      text: `Game summary unavailable. Please check configuration.`,
      model: 'unavailable',
      error: 'AI not configured',
    };
  }

  try {
    const { game, homeLeaders, awayLeaders } = context;

    // Build compact data string
    const homeTop = homeLeaders.points ? `${homeLeaders.points.player} ${homeLeaders.points.value}pts` : '';
    const awayTop = awayLeaders.points ? `${awayLeaders.points.player} ${awayLeaders.points.value}pts` : '';

    const prompt = `${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeScore} (${type === 'halftime' ? 'Halftime' : 'Final'})
Top: ${awayTop} | ${homeTop}

Write 3-4 sentences: score summary, top performer, key moment, one insight. NO headers, NO bullets, NO sections. Plain paragraph only.`;

    const requestParams: any = {
      model: MODEL_NAME,
      contents: prompt,
      generationConfig: GENERATION_CONFIG,
    };

    const response = await ai.models.generateContent(requestParams);

    const text = (response as any).text || (response as any).response?.text || (response as any).content || '';

    return {
      text: text || `${type === 'halftime' ? 'Halftime' : 'Final'} summary generated.`,
      model: MODEL_NAME,
    };
  } catch (error) {
    logger.error('Failed to generate game summary', error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) });
    return {
      text: `Failed to generate ${type === 'halftime' ? 'halftime' : 'final'} summary.`,
      model: MODEL_NAME,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
