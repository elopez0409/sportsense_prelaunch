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
  temperature: 0.2, // Lower temperature to reduce creative drift/hallucinations
  topK: 40,
  topP: 0.8,
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
    const { game, homeLeaders, awayLeaders, benchScoring, inactivePlayers } = context;

    // Build compact data string
    const homeTop = homeLeaders.points ? `${homeLeaders.points.player} ${homeLeaders.points.value}pts` : '';
    const awayTop = awayLeaders.points ? `${awayLeaders.points.player} ${awayLeaders.points.value}pts` : '';

    // Build bench scoring context
    let benchContext = '';
    if (benchScoring && benchScoring.length > 0) {
      const benchStrs = benchScoring.map(b => `${b.player} ${b.points}pts`);
      benchContext = `\nBench contributors: ${benchStrs.join(', ')}`;
    }

    // Build inactive players context
    let inactiveContext = '';
    if (inactivePlayers && inactivePlayers.length > 0) {
      const inactiveStrs = inactivePlayers.map(p => p.player);
      inactiveContext = `\nDid not play: ${inactiveStrs.join(', ')}`;
    }

    const prompt = `${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeScore} (${type === 'halftime' ? 'Halftime' : 'Final'})
Top scorers: ${awayTop} | ${homeTop}${benchContext}${inactiveContext}

FACTS (USE ONLY THESE FACTS; do not add or infer anything else):
- Score: ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeScore}
- Top scorers: ${awayTop || 'Not available'} | ${homeTop || 'Not available'}
- Bench contributors: ${benchScoring && benchScoring.length > 0 ? benchScoring.map(b => `${b.player} ${b.points}pts`).join(', ') : 'None provided'}
- Did not play: ${inactivePlayers && inactivePlayers.length > 0 ? inactivePlayers.map(p => p.player).join(', ') : 'None provided'}

Write 3-4 sentences covering:
1. Final score and game flow
2. Top performer(s) and their impact
3. Notable bench contributions if any players stepped up off the bench
4. If key players were out, mention how the team adjusted or the context of the result

STRICT RULES:
- Use ONLY the FACTS above. Do NOT add stats, names, or details not listed.
- If a fact is missing, say "Not available" rather than guessing.
- First sentence must include the score AND (if provided) bench contributors or key absences.

Write as a professional sports recap like ESPN or The Athletic. NO headers, NO bullets, NO sections. Plain paragraph only.`;

    // Increase token limit slightly to accommodate richer recaps
    const requestParams: any = {
      model: MODEL_NAME,
      contents: prompt,
      generationConfig: {
        ...GENERATION_CONFIG,
        maxOutputTokens: 200, // Increased from 150 to allow for richer context
      },
    };

    const response = await ai.models.generateContent(requestParams);

    const text = (response as any).text || (response as any).response?.text || (response as any).content || '';

    return {
      text: text || `${type === 'halftime' ? 'Halftime' : 'Final'} summary generated.`,
      model: MODEL_NAME,
    };
  } catch (error) {
    // Log the full error for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Gemini] generateGameSummary FAILED:', errorMessage);
    
    // Check if it's a rate limit error
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      console.error('[Gemini] ⚠️ RATE LIMITED - Wait 30-60 seconds');
    }
    
    logger.error('Failed to generate game summary', error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) });
    return {
      text: `Failed to generate ${type === 'halftime' ? 'halftime' : 'final'} summary.`,
      model: MODEL_NAME,
      error: errorMessage,
    };
  }
}
