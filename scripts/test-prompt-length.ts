/**
 * Diagnostic test to see what prompt is actually being sent
 * Run with: npx tsx scripts/test-prompt-length.ts
 */

// Simulate the route.ts prompt building to see what's happening

const TEST_SYSTEM_PROMPT = `You are Playmaker AI - a concise, accurate sports assistant.

RULES:
- BE CONCISE. Users want quick info, not essays.
- Use EXACT numbers from provided data - never invent stats
- Lead with the score/result, then key performers
- Skip fluff words, headers, and repetition

FORMAT: Score first → top performers → one key insight. Done.`;

const TEST_PERSONALITY_DELTAS: Record<string, string> = {
  default: '',
  hype: `STYLE: HIGH ENERGY! Use caps for KEY STATS, 🔥 emojis for hot streaks.`,
  drunk: `STYLE: Casual bar-talk delivery. Still accurate with numbers.`,
  announcer: `STYLE: Broadcaster drama like Mike Breen. Use gravitas.`,
  analyst: `STYLE: Advanced metrics focus. Lead with PER, BPM, TS%, eFG%.`,
};

const TEST_LENGTH_CONFIG: Record<string, { maxTokens: number; instruction: string }> = {
  short: { 
    maxTokens: 80, 
    instruction: 'STRICT: 1-2 sentences ONLY. Example: "Mavs 138, Jazz 120. Klay Thompson led with 23 points as Dallas dominated at home." NO headers, NO bullets, NO paragraphs.' 
  },
  medium: { 
    maxTokens: 200, 
    instruction: 'STRICT: 3-5 sentences MAX. Lead with score, add 1-2 key performers, one insight. NO headers, NO sections, NO essays. Keep it scannable.' 
  },
  long: { 
    maxTokens: 400, 
    instruction: 'Detailed but focused. Use bullet points for stats. Max 2-3 short paragraphs. Still prioritize readability over completeness.' 
  },
};

// Simulate a request
const testPersonality = 'default';  // What is the frontend sending?
const testLength = 'medium';        // What is the frontend sending?
const testMessage = 'Give me a recap of the Mavericks game';

const lengthSettings = TEST_LENGTH_CONFIG[testLength] || TEST_LENGTH_CONFIG.medium;

// Sample live context (abbreviated)
const liveContext = `
===== NBA SCORES =====
Mavericks 138 vs Jazz 120 (FINAL)
  DAL Top Performers:
    - Klay Thompson: 23 points
    - Moussa Cisse: 10 rebounds
  UTA Top Performers:
    - Keyonte George: 29 points
    - Kyle Filipowski: 12 rebounds
`;

const fullPrompt = `${TEST_SYSTEM_PROMPT}
${TEST_PERSONALITY_DELTAS[testPersonality] || ''}

${lengthSettings.instruction}

CRITICAL ACCURACY RULE: For live/today's games, use ONLY exact numbers from data below. Never invent stats.

===== DATA =====
${liveContext}
===== END DATA =====

USER: ${testMessage}

Be concise. No essays.`;

// Analysis
console.log('='.repeat(70));
console.log('  PROMPT DIAGNOSTIC TEST');
console.log('='.repeat(70));

console.log('\n📋 REQUEST PARAMETERS:\n');
console.log(`   personality: "${testPersonality}"`);
console.log(`   length:      "${testLength}"`);
console.log(`   maxTokens:   ${lengthSettings.maxTokens}`);

console.log('\n📝 LENGTH INSTRUCTION BEING SENT:\n');
console.log(`   "${lengthSettings.instruction}"`);

console.log('\n📊 FULL PROMPT STATS:\n');
console.log(`   Characters:  ${fullPrompt.length}`);
console.log(`   Est. tokens: ~${Math.ceil(fullPrompt.length / 4)}`);

console.log('\n📄 FULL PROMPT PREVIEW:\n');
console.log('-'.repeat(70));
console.log(fullPrompt);
console.log('-'.repeat(70));

console.log('\n⚠️  POTENTIAL ISSUES TO CHECK:\n');
console.log('   1. What "length" parameter is the frontend actually sending?');
console.log('   2. Is maxOutputTokens being respected by Gemini?');
console.log('   3. Is there a different code path for game recaps?');

console.log('\n🔍 TO DEBUG IN BROWSER:\n');
console.log('   Open DevTools > Network tab > find the /api/ai/chat request');
console.log('   Check the Request Payload for: { length: "???", personality: "???" }');
console.log('');
