// Teams listing page

import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/card';
import type { TeamInfo } from '@/types/nba';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Revalidate every hour

async function getTeams(): Promise<TeamInfo[]> {
  try {
    const teams = await prisma.team.findMany({
      orderBy: [
        { conference: 'asc' },
        { division: 'asc' },
        { name: 'asc' },
      ],
    });

    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      fullName: team.fullName,
      abbreviation: team.abbreviation,
      city: team.city,
      conference: team.conference,
      division: team.division,
      logoUrl: team.logoUrl,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
    }));
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    return [];
  }
}

export default async function TeamsPage() {
  const teams = await getTeams();

  // Group by conference and division
  const conferences = teams.reduce((acc, team) => {
    const conf = team.conference;
    const div = team.division;
    
    if (!acc[conf]) acc[conf] = {};
    if (!acc[conf][div]) acc[conf][div] = [];
    acc[conf][div].push(team);
    
    return acc;
  }, {} as Record<string, Record<string, TeamInfo[]>>);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl md:text-5xl font-bold">
          <span className="gradient-text">NBA</span>
          <span className="text-white"> Teams</span>
        </h1>
        <p className="text-white/60">
          All 30 NBA teams organized by conference and division
        </p>
      </div>

      {/* Teams by Conference */}
      {Object.entries(conferences).map(([conference, divisions]) => (
        <div key={conference} className="space-y-6">
          <h2 className="text-2xl font-bold text-white border-l-4 border-orange-500 pl-4">
            {conference}ern Conference
          </h2>
          
          {Object.entries(divisions).map(([division, divisionTeams]) => (
            <div key={division} className="space-y-4">
              <h3 className="text-lg font-semibold text-white/70">{division} Division</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {divisionTeams.map((team) => (
                  <Link key={team.id} href={`/teams/${team.id}`}>
                    <Card className="group p-4 hover:border-orange-500/50 transition-all duration-300 cursor-pointer">
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div
                          className="w-16 h-16 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                          style={{ backgroundColor: team.primaryColor || '#333' }}
                        >
                          {team.logoUrl ? (
                            <Image
                              src={team.logoUrl}
                              alt={team.name}
                              width={48}
                              height={48}
                              className="object-contain"
                              unoptimized
                            />
                          ) : (
                            <span className="text-white font-bold">
                              {team.abbreviation}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-white/50">{team.city}</p>
                          <p className="font-semibold text-white">{team.name}</p>
                        </div>
                      </div>
                      
                      {/* Hover effect */}
                      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Empty state */}
      {teams.length === 0 && (
        <div className="text-center py-16">
          <p className="text-white/60">No teams found. Run data sync to populate teams.</p>
        </div>
      )}
    </div>
  );
}



