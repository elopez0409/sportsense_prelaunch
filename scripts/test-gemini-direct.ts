/**
 * Direct test of Gemini API to see the actual error
 * Run with: npx tsx scripts/test-gemini-direct.ts
 */

import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function testGeminiDirect() {
  console.log('='.repeat(60));
  console.log('  DIRECT GEMINI API TEST');
  console.log('='.repeat(60));
  
  if (!GEMINI_API_KEY) {
    console.log('\n❌ GEMINI_API_KEY not set in environment');
    console.log('   Make sure you have a .env.local file with GEMINI_API_KEY=...');
    return;
  }
  
  console.log(`\n🔑 API Key: ${GEMINI_API_KEY.substring(0, 10)}...`);
  
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log('✅ GoogleGenAI client created');
    
    const prompt = `Lakers 118, Blazers 105 (Final)
Top: LeBron James 28pts | Anfernee Simons 22pts

Write 2-3 sentences: score summary, top performer, one insight. NO headers, NO bullets.`;

    console.log('\n📤 Sending prompt to gemini-2.5-flash...\n');
    console.log('   Prompt:', prompt.slice(0, 100) + '...');
    
    const startTime = Date.now();
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.5,
      },
    });
    
    const elapsed = Date.now() - startTime;
    
    console.log(`\n✅ Response received in ${elapsed}ms\n`);
    
    // Try different ways to extract text
    const text = (response as any).text 
      || (response as any).response?.text 
      || (response as any).content 
      || JSON.stringify(response, null, 2);
    
    console.log('📝 RESPONSE TEXT:\n');
    console.log('   ' + text);
    
  } catch (error: any) {
    console.log('\n❌ GEMINI API ERROR:\n');
    console.log('   Message:', error.message);
    
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      console.log('\n   ⚠️  RATE LIMITED!');
      console.log('   You have exceeded the free tier quota (20 requests/minute)');
      console.log('   Options:');
      console.log('     1. Wait 30-60 seconds and try again');
      console.log('     2. Upgrade to pay-as-you-go at https://ai.google.dev');
    }
    
    if (error.message?.includes('API_KEY')) {
      console.log('\n   ⚠️  INVALID API KEY!');
      console.log('   Check your GEMINI_API_KEY in .env.local');
    }
    
    // Log full error for debugging
    console.log('\n   Full error:', JSON.stringify(error, null, 2));
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

testGeminiDirect();
