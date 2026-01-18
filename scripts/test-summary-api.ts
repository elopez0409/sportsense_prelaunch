/**
 * Test script to debug the /api/ai/summary endpoint
 * Run with: npx tsx scripts/test-summary-api.ts
 */

const API_URL = 'http://localhost:3000/api/ai/summary';

// Test data - use a real game ID from today's games
const TEST_GAME = {
  gameId: '401810456', // Lakers vs Blazers from the logs
  type: 'final',
  homeTeamAbbr: 'POR',
  awayTeamAbbr: 'LAL',
  gameDate: '2026-01-18T03:00Z',
};

async function testSummaryAPI() {
  console.log('='.repeat(60));
  console.log('  SUMMARY API DEBUG TEST');
  console.log('='.repeat(60));
  
  console.log('\n📤 REQUEST:\n');
  console.log(JSON.stringify(TEST_GAME, null, 2));
  
  try {
    console.log('\n⏳ Sending request to:', API_URL);
    const startTime = Date.now();
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_GAME),
    });
    
    const elapsed = Date.now() - startTime;
    
    console.log('\n📥 RESPONSE:\n');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Time: ${elapsed}ms`);
    console.log(`   Headers:`);
    response.headers.forEach((value, key) => {
      if (['content-type', 'x-ratelimit-remaining', 'retry-after'].includes(key.toLowerCase())) {
        console.log(`     ${key}: ${value}`);
      }
    });
    
    const data = await response.json();
    
    console.log('\n📦 BODY:\n');
    console.log(JSON.stringify(data, null, 2));
    
    // Analyze the response
    console.log('\n🔍 ANALYSIS:\n');
    
    if (data.success) {
      console.log('   ✅ Request succeeded');
      if (data.data?.summary) {
        console.log(`   ✅ Summary returned (${data.data.summary.length} chars)`);
        console.log('\n   📝 SUMMARY PREVIEW:\n');
        console.log('   ' + data.data.summary.slice(0, 200) + '...');
      } else {
        console.log('   ❌ No summary in response data');
      }
      if (data.meta?.cached) {
        console.log('   📦 Response was cached');
      }
      if (data.meta?.model) {
        console.log(`   🤖 Model used: ${data.meta.model}`);
      }
    } else {
      console.log('   ❌ Request failed');
      console.log(`   Error code: ${data.error?.code}`);
      console.log(`   Error message: ${data.error?.message}`);
      
      // Check for specific errors
      if (data.error?.code === 'RATE_LIMITED') {
        console.log('\n   ⚠️  RATE LIMITED - Wait 30-60 seconds and try again');
      } else if (data.error?.code === 'AI_UNAVAILABLE') {
        console.log('\n   ⚠️  AI NOT CONFIGURED - Check GEMINI_API_KEY in .env');
      } else if (data.error?.code === 'GAME_NOT_FOUND') {
        console.log('\n   ⚠️  GAME NOT FOUND - The game ID may be invalid or not in database');
      }
    }
    
  } catch (error) {
    console.log('\n❌ REQUEST FAILED:\n');
    console.log(`   ${error}`);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('\n   ⚠️  Is the dev server running? Start it with: npm run dev');
    }
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the test
testSummaryAPI();
