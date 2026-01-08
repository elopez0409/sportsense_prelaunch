// API Route - Fetch season stats for multiple players
import { NextResponse } from 'next/server';
import { fetchPlayersSeasonStats } from '@/services/nba/espn-api';

export async function POST(request: Request) {
  try {
    const { playerIds } = await request.json();
    
    if (!playerIds || !Array.isArray(playerIds)) {
      return NextResponse.json(
        { error: 'playerIds array is required' },
        { status: 400 }
      );
    }

    const statsMap = await fetchPlayersSeasonStats(playerIds);
    
    // Convert Map to plain object for JSON serialization
    const stats: Record<string, any> = {};
    statsMap.forEach((value, key) => {
      stats[key] = value;
    });

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching player season stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player stats' },
      { status: 500 }
    );
  }
}





