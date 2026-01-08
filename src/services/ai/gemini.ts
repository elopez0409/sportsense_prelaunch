// Gemini AI Service - Handles all AI interactions with proper grounding

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { logger } from '@/lib/logger';
import type { AIGameContext } from '@/types/nba';

// ============================================
// CONFIGURATION
// ============================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('[AI] GEMINI_API_KEY not configured - AI features disabled');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Safety settings - block harmful content
const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Model selection - Using Gemini 2.5 Flash (stable and available)
const FLASH_MODEL = 'gemini-2.5-flash';
const PRO_MODEL = 'gemini-2.5-flash';

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
// VALIDATION
// ============================================

function validatePlayerName(name: string, context: AIGameContext): boolean {
  // Check if the player name appears in our data
  const allPlayers = [
    context.homeLeaders.points?.player,
    context.homeLeaders.rebounds?.player,
    context.homeLeaders.assists?.player,
    context.awayLeaders.points?.player,
    context.awayLeaders.rebounds?.player,
    context.awayLeaders.assists?.player,
  ].filter(Boolean);

  // Also check recent plays
  context.recentPlays.forEach((play) => {
    // Extract player names from play descriptions
    const words = play.description.split(' ');
    // Simple heuristic - player names are usually at the start
    if (words.length >= 2) {
      allPlayers.push(`${words[0]} ${words[1]}`);
    }
  });

  return allPlayers.some((p) =>
    p?.toLowerCase().includes(name.toLowerCase())
  );
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
  if (!genAI) {
    return {
      text: 'AI features are currently unavailable. Please check back later.',
      model: 'none',
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: FLASH_MODEL,
      safetySettings: SAFETY_SETTINGS,
    });

    const contextStr = formatGameContext(context);
    const prompt = `${CHAT_SYSTEM_PROMPT}

CONTEXT:
${contextStr}

USER QUESTION: ${question}

Respond to the user's question using ONLY the data provided above.`;

    logger.ai.invoke(FLASH_MODEL, 'chat', { questionLength: question.length });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return {
      text,
      model: FLASH_MODEL,
      tokensUsed: response.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    logger.ai.error(FLASH_MODEL, 'chat', error as Error);
    return {
      text: 'I encountered an error processing your question. Please try again.',
      model: FLASH_MODEL,
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
  if (!genAI) {
    return {
      text: 'AI features are currently unavailable.',
      model: 'none',
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: PRO_MODEL,
      safetySettings: SAFETY_SETTINGS,
    });

    const prompt = `${SUMMARY_SYSTEM_PROMPT}

Generate a brief pregame preview for:
${awayTeam} @ ${homeTeam}

${additionalContext ? `Additional context: ${additionalContext}` : ''}

Write a 2-paragraph preview focusing on:
1. What to watch for in this matchup
2. Key players and storylines

Keep it engaging but grounded in the information provided. If you don't have specific stats, focus on general team narratives.`;

    logger.ai.invoke(PRO_MODEL, 'pregame_preview', { homeTeam, awayTeam });

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return {
      text: response.text(),
      model: PRO_MODEL,
      tokensUsed: response.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    logger.ai.error(PRO_MODEL, 'pregame_preview', error as Error);
    return {
      text: 'Unable to generate preview at this time.',
      model: PRO_MODEL,
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
  if (!genAI) {
    return {
      text: 'AI features are currently unavailable.',
      model: 'none',
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: FLASH_MODEL,
      safetySettings: SAFETY_SETTINGS,
    });

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

    logger.ai.invoke(FLASH_MODEL, `${type}_summary`, {
      homeTeam: context.game.homeTeam,
      awayTeam: context.game.awayTeam,
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return {
      text: response.text(),
      model: FLASH_MODEL,
      tokensUsed: response.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    logger.ai.error(FLASH_MODEL, `${type}_summary`, error as Error);
    return {
      text: `Unable to generate ${type} summary at this time.`,
      model: FLASH_MODEL,
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
  if (!genAI) {
    return {
      text: 'AI features are currently unavailable.',
      model: 'none',
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: FLASH_MODEL,
      safetySettings: SAFETY_SETTINGS,
    });

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

    logger.ai.invoke(FLASH_MODEL, 'moment_card', { momentType });

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return {
      text: response.text(),
      model: FLASH_MODEL,
      tokensUsed: response.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    logger.ai.error(FLASH_MODEL, 'moment_card', error as Error);
    return {
      text: 'An exciting play!',
      model: FLASH_MODEL,
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
  if (!genAI) {
    yield 'AI features are currently unavailable.';
    return;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: FLASH_MODEL,
      safetySettings: SAFETY_SETTINGS,
    });

    const contextStr = formatGameContext(context);
    const prompt = `${CHAT_SYSTEM_PROMPT}

CONTEXT:
${contextStr}

USER QUESTION: ${question}

Respond to the user's question using ONLY the data provided above.`;

    logger.ai.invoke(FLASH_MODEL, 'chat_stream', { questionLength: question.length });

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  } catch (error) {
    logger.ai.error(FLASH_MODEL, 'chat_stream', error as Error);
    yield 'I encountered an error. Please try again.';
  }
}

/**
 * Check if AI is available
 */
export function isAIAvailable(): boolean {
  return !!genAI;
}
