// Gemini AI Service - Game summaries and previews

import { GoogleGenAI } from '@google/genai';
import { logger } from '@/lib/logger';
import type { AIGameContext } from '@/types/nba';

export interface ChatResponse {
  text: string;
  model: string;
  tokensUsed?: number;
  error?: string;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.5-pro';

let ai: GoogleGenAI | null = null;
if (GEMINI_API_KEY) {
  try {
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
    const prompt = `Generate an engaging NBA pregame preview for ${awayTeam} @ ${homeTeam}.

${additionalContext || ''}

Provide:
- Key matchup details
- Recent team performance trends
- Players to watch
- Potential storylines
- Prediction or key factors

Keep it engaging, insightful, and informative.`;

    const requestParams: any = {
      model: MODEL_NAME,
      contents: prompt,
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
    const { game, homeLeaders, awayLeaders, recentPlays } = context;
    
    let prompt = `Generate a ${type === 'halftime' ? 'halftime report' : 'game recap'} for ${game.awayTeam} @ ${game.homeTeam}.

Score: ${game.awayTeam} ${game.awayScore} - ${game.homeScore} ${game.homeTeam}
${game.period ? `Period: ${game.period}${game.gameClock ? ` (${game.gameClock})` : ''}` : ''}
${game.venue ? `Venue: ${game.venue}` : ''}

Top Performers:
${homeLeaders.points ? `${game.homeTeam} - Points: ${homeLeaders.points.player} (${homeLeaders.points.value})` : ''}
${homeLeaders.rebounds ? `${game.homeTeam} - Rebounds: ${homeLeaders.rebounds.player} (${homeLeaders.rebounds.value})` : ''}
${homeLeaders.assists ? `${game.homeTeam} - Assists: ${homeLeaders.assists.player} (${homeLeaders.assists.value})` : ''}
${awayLeaders.points ? `${game.awayTeam} - Points: ${awayLeaders.points.player} (${awayLeaders.points.value})` : ''}
${awayLeaders.rebounds ? `${game.awayTeam} - Rebounds: ${awayLeaders.rebounds.player} (${awayLeaders.rebounds.value})` : ''}
${awayLeaders.assists ? `${game.awayTeam} - Assists: ${awayLeaders.assists.player} (${awayLeaders.assists.value})` : ''}

${recentPlays.length > 0 ? `Recent Plays:\n${recentPlays.slice(0, 5).map(p => `- ${p.description} (${p.scoreAfter})`).join('\n')}` : ''}

Provide:
${type === 'halftime' ? '- First half analysis\n- Key moments and turning points\n- Half-time adjustments needed' : '- Complete game recap\n- Key moments and turning points\n- Final analysis and takeaways'}
- Top performers analysis
- What decided the game (or first half)
${type === 'final' ? '- Final thoughts and context' : ''}

Keep it engaging, insightful, and informative.`;

    const requestParams: any = {
      model: MODEL_NAME,
      contents: prompt,
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
