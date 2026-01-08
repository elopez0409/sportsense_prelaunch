// Gemini AI Service - Handles all AI interactions with proper grounding

import { GoogleGenAI } from "@google/genai";
import { logger } from '@/lib/logger';
import type { AIGameContext } from '@/types/nba';

// ============================================
// CONFIGURATION
// ============================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('[AI] GEMINI_API_KEY not configured - AI features disabled');
}

// Initialize client - SDK reads from GEMINI_API_KEY env var or can accept apiKey in constructor
let ai: GoogleGenAI | null = null;
try {
  // Try with explicit API key first, fallback to empty object (reads from env)
  ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : new GoogleGenAI({});
  console.log('[AI] GoogleGenAI initialized successfully');
} catch (error) {
  console.error('[AI] Failed to initialize GoogleGenAI:', error);
  ai = null;
}

// Model selection - Using Gemini 2.5 Pro as requested
const MODEL_NAME = 'gemini-2.5-pro';

// ============================================
// SYSTEM PROMPTS
// ============================================

const SYSTEM_PROMPT_BASE = `You are an NBA analyst for SportSense, a real-time sports intelligence app.

CRITICAL RULES:
1. You ONLY use the data provided in the CONTEXT section below
2. If data is missing or unclear, say "I don't have that information yet"
3. NEVER invent or hallucinate statistics, scores, or player names
4. ALWAYS acknowledge the data timestamp when relevant
5. Be concise but insightful - fans want quick, meaningful analysis
6. Use basketball terminology naturally
7. Express enthusiasm for exciting plays without being over-the-top

When analyzing games:
- Focus on the story of the game (momentum shifts, key plays)
- Highlight standout individual performances
- Provide context (e.g., "This is their 3rd win in a row")
- Note important tactical observations when relevant`;

const CHAT_SYSTEM_PROMPT = `${SYSTEM_PROMPT_BASE}

You are answering a fan's question about a live or recent NBA game.
- Be conversational and engaging
- Answer directly, then provide helpful context
- If asked about predictions, base them on current data trends only
- Don't speculate beyond what the data supports`;

const SUMMARY_SYSTEM_PROMPT = `${SYSTEM_PROMPT_BASE}

You are generating an automated game summary.
- Write in a professional sports journalism style
- Lead with the most important storyline
- Include key statistics naturally in the narrative
- Keep summaries focused and punchy (2-3 paragraphs max)`;

const MOMENT_SYSTEM_PROMPT = `${SYSTEM_PROMPT_BASE}

You are explaining why a specific play or moment matters.
- Capture the excitement appropriately
- Explain the context (game situation, stakes)
- Keep it brief (2-3 sentences)
- Use active, engaging language`;

// ============================================
// CONTEXT FORMATTING
// ============================================

function formatGameContext(context: AIGameContext): string {
  const lines: string[] = [
    '--- GAME DATA ---',
    `Matchup: ${context.game.awayTeam} @ ${context.game.homeTeam}`,
    `Score: ${context.game.awayTeam} ${context.game.awayScore} - ${context.game.homeTeam} ${context.game.homeScore}`,
    `Period: Q${context.game.period} | Clock: ${context.game.gameClock || 'N/A'}`,
    `Status: ${context.game.isLive ? 'LIVE' : 'NOT LIVE'}`,
    `Venue: ${context.game.venue || 'Unknown'}`,
    '',
  ];

  if (context.recentPlays.length > 0) {
    lines.push('--- RECENT PLAYS (most recent first) ---');
    context.recentPlays.forEach((play, i) => {
      lines.push(`${i + 1}. [Q${play.period} ${play.clock}] ${play.description} (${play.scoreAfter})`);
    });
    lines.push('');
  }

  lines.push('--- STATISTICAL LEADERS ---');
  lines.push(`${context.game.homeTeam}:`);
  if (context.homeLeaders.points) {
    lines.push(`  Points: ${context.homeLeaders.points.player} (${context.homeLeaders.points.value})`);
  }
  if (context.homeLeaders.rebounds) {
    lines.push(`  Rebounds: ${context.homeLeaders.rebounds.player} (${context.homeLeaders.rebounds.value})`);
  }
  if (context.homeLeaders.assists) {
    lines.push(`  Assists: ${context.homeLeaders.assists.player} (${context.homeLeaders.assists.value})`);
  }

  lines.push(`${context.game.awayTeam}:`);
  if (context.awayLeaders.points) {
    lines.push(`  Points: ${context.awayLeaders.points.player} (${context.awayLeaders.points.value})`);
  }
  if (context.awayLeaders.rebounds) {
    lines.push(`  Rebounds: ${context.awayLeaders.rebounds.player} (${context.awayLeaders.rebounds.value})`);
  }
  if (context.awayLeaders.assists) {
    lines.push(`  Assists: ${context.awayLeaders.assists.player} (${context.awayLeaders.assists.value})`);
  }

  lines.push('');
  lines.push(`--- DATA SOURCE: ${context.dataSource} | TIMESTAMP: ${context.dataTimestamp} ---`);

  return lines.join('\n');
}

// ============================================
// PUBLIC API
// ============================================

export interface ChatResponse {
  text: string;
  model: string;
  tokensUsed?: number;
  error?: string;
}

/**
 * Chat with AI about a game
 */
export async function chatAboutGame(
  question: string,
  context: AIGameContext
): Promise<ChatResponse> {
  if (!ai || !GEMINI_API_KEY) {
    return {
      text: 'AI features are currently unavailable. Please check back later.',
      model: 'none',
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const contextStr = formatGameContext(context);
    const prompt = `${CHAT_SYSTEM_PROMPT}

CONTEXT:
${contextStr}

USER QUESTION: ${question}

Respond to the user's question using ONLY the data provided above.`;

    logger.ai.invoke(MODEL_NAME, 'chat', { questionLength: question.length });

    console.log('[AI] Calling generateContent with model:', MODEL_NAME);
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    console.log('[AI] Response received:', {
      hasText: !!response.text,
      responseKeys: Object.keys(response || {}),
      responseType: typeof response,
    });

    // Handle different possible response structures
    let text = '';
    if (response && typeof response === 'object') {
      // Try different possible properties
      text = response.text || response.response?.text || response.content || '';
      
      // If still no text, log the full response for debugging
      if (!text) {
        console.error('[AI] No text found in response:', JSON.stringify(response, null, 2));
      }
    }

    if (!text) {
      throw new Error('No text content in API response. Check API key and model availability.');
    }

    return {
      text,
      model: MODEL_NAME,
      tokensUsed: response.usageMetadata?.totalTokenCount || response.usage?.totalTokenCount,
    };
  } catch (error) {
    console.error('[AI] Error in chatAboutGame:', error);
    logger.ai.error(MODEL_NAME, 'chat', error as Error);
    return {
      text: `I encountered an error: ${(error as Error).message}. Please check your API key configuration.`,
      model: MODEL_NAME,
      error: (error as Error).message,
    };
  }
}

/**
 * Generate a pregame preview
 */
export async function generatePregamePreview(
  homeTeam: string,
  awayTeam: string,
  additionalContext?: string
): Promise<ChatResponse> {
  if (!ai || !GEMINI_API_KEY) {
    return {
      text: 'AI features are currently unavailable.',
      model: 'none',
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const prompt = `${SUMMARY_SYSTEM_PROMPT}

Generate a brief pregame preview for:
${awayTeam} @ ${homeTeam}

${additionalContext ? `Additional context: ${additionalContext}` : ''}

Write a 2-paragraph preview focusing on:
1. What to watch for in this matchup
2. Key players and storylines

Keep it engaging but grounded in the information provided. If you don't have specific stats, focus on general team narratives.`;

    logger.ai.invoke(MODEL_NAME, 'pregame_preview', { homeTeam, awayTeam });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return {
      text: response.text || '',
      model: MODEL_NAME,
      tokensUsed: response.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    logger.ai.error(MODEL_NAME, 'pregame_preview', error as Error);
    return {
      text: 'Unable to generate preview at this time.',
      model: MODEL_NAME,
      error: (error as Error).message,
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
  if (!ai || !GEMINI_API_KEY) {
    return {
      text: 'AI features are currently unavailable.',
      model: 'none',
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const contextStr = formatGameContext(context);
    const summaryType = type === 'halftime' ? 'halftime report' : 'final game recap';

    const prompt = `${SUMMARY_SYSTEM_PROMPT}

CONTEXT:
${contextStr}

Generate a ${summaryType} for this game.

Focus on:
- The current score and what it means
- Standout performances (cite specific stats from the data)
- The story of the game so far
${type === 'halftime' ? '- What to watch for in the second half' : '- The key turning points'}

Write 2-3 concise paragraphs.`;

    logger.ai.invoke(MODEL_NAME, `${type}_summary`, {
      homeTeam: context.game.homeTeam,
      awayTeam: context.game.awayTeam,
    });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return {
      text: response.text || '',
      model: MODEL_NAME,
      tokensUsed: response.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    logger.ai.error(MODEL_NAME, `${type}_summary`, error as Error);
    return {
      text: `Unable to generate ${type} summary at this time.`,
      model: MODEL_NAME,
      error: (error as Error).message,
    };
  }
}

/**
 * Generate a "moment card" explanation for a big play
 */
export async function generateMomentCard(
  playDescription: string,
  context: AIGameContext,
  momentType: 'big_play' | 'lead_change' | 'scoring_run' | 'clutch_shot'
): Promise<ChatResponse> {
  if (!ai || !GEMINI_API_KEY) {
    return {
      text: 'AI features are currently unavailable.',
      model: 'none',
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const contextStr = formatGameContext(context);
    const momentDescriptions: Record<string, string> = {
      big_play: 'a significant play that could swing momentum',
      lead_change: 'a play that changed the lead',
      scoring_run: 'part of a scoring run',
      clutch_shot: 'a clutch moment late in the game',
    };

    const prompt = `${MOMENT_SYSTEM_PROMPT}

CONTEXT:
${contextStr}

THE PLAY: ${playDescription}

This is ${momentDescriptions[momentType]}.

Explain in 2-3 sentences why this moment matters. Capture the excitement while staying grounded in the data.`;

    logger.ai.invoke(MODEL_NAME, 'moment_card', { momentType });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return {
      text: response.text || '',
      model: MODEL_NAME,
      tokensUsed: response.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    logger.ai.error(MODEL_NAME, 'moment_card', error as Error);
    return {
      text: 'An exciting play!',
      model: MODEL_NAME,
      error: (error as Error).message,
    };
  }
}

/**
 * Stream chat response for real-time UI
 */
export async function* streamChatAboutGame(
  question: string,
  context: AIGameContext
): AsyncGenerator<string, void, unknown> {
  if (!ai || !GEMINI_API_KEY) {
    yield 'AI features are currently unavailable.';
    return;
  }

  try {
    const contextStr = formatGameContext(context);
    const prompt = `${CHAT_SYSTEM_PROMPT}

CONTEXT:
${contextStr}

USER QUESTION: ${question}

Respond to the user's question using ONLY the data provided above.`;

    logger.ai.invoke(MODEL_NAME, 'chat_stream', { questionLength: question.length });

    const result = await ai.models.generateContentStream({
      model: MODEL_NAME,
      contents: prompt,
    });

    // Handle streaming response - check structure
    if (result.stream) {
      for await (const chunk of result.stream) {
        const text = chunk.text || chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          yield text;
        }
      }
    } else {
      // If no stream, try alternative structure
      yield 'Streaming not available.';
    }
  } catch (error) {
    logger.ai.error(MODEL_NAME, 'chat_stream', error as Error);
    yield 'I encountered an error. Please try again.';
  }
}

/**
 * Check if AI is available
 */
export function isAIAvailable(): boolean {
  return !!ai && !!GEMINI_API_KEY;
}
