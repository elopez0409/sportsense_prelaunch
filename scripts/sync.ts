// Data sync CLI script
// Usage: npm run sync:full | npm run sync:teams | npm run sync:players | npm run sync:games

import { config } from 'dotenv';
config(); // Load .env file

import { syncTeams, syncPlayers, syncGames, runFullSync } from '../src/services/nba/sync';
import { getCurrentSeason } from '../src/services/nba/client';

async function main() {
  const command = process.argv[2] || 'full';
  
  console.log(`\n🏀 SportSense Data Sync\n`);
  console.log(`Command: ${command}`);
  console.log(`Season: ${getCurrentSeason()}\n`);

  const startTime = Date.now();

  try {
    switch (command) {
      case 'teams':
        console.log('Syncing teams...');
        const teamCount = await syncTeams();
        console.log(`✅ Synced ${teamCount} teams`);
        break;

      case 'players':
        console.log('Syncing players...');
        const playerCount = await syncPlayers(100);
        console.log(`✅ Synced ${playerCount} players`);
        break;

      case 'games': {
        console.log('Syncing games...');
        const season = getCurrentSeason();
        const startDate = `${season}-10-01`;
        const endDate = new Date().toISOString().split('T')[0];
        const gameCount = await syncGames({ startDate, endDate, season });
        console.log(`✅ Synced ${gameCount} games`);
        break;
      }

      case 'full':
      default:
        console.log('Running full sync...\n');
        const result = await runFullSync();
        console.log(`\n✅ Full sync complete:`);
        console.log(`   Teams: ${result.teams}`);
        console.log(`   Players: ${result.players}`);
        console.log(`   Games: ${result.games}`);
        break;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Completed in ${elapsed}s\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

main();




