// Gemini AI Service - Stub implementation
// Note: Main AI functionality is now in /api/ai/chat route

import { logger } from '@/lib/logger';
import type { AIGameContext } from '@/types/nba';

export interface ChatResponse {
  text: string;
  model: string;
  tokensUsed?: number;
  error?: string;
}

/**
 * Check if AI is available
 */
export function isAIAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Generate a pregame preview (stub)
 */
export async function generatePregamePreview(
  homeTeam: string,
  awayTeam: string,
  additionalContext?: string
): Promise<ChatResponse> {
  return {
    text: `${awayTeam} @ ${homeTeam} - Game preview unavailable. Please use the main chat interface.`,
    model: 'stub',
    error: 'Use /api/ai/chat instead',
  };
}

/**
 * Generate halftime or final game summary (stub)
 */
export async function generateGameSummary(
  context: AIGameContext,
  type: 'halftime' | 'final'
): Promise<ChatResponse> {
  return {
    text: `Game summary unavailable. Please use the main chat interface.`,
    model: 'stub',
    error: 'Use /api/ai/chat instead',
  };
}
