// Playmaker Hub - Central landing page for all sports

import Link from 'next/link';
import { 
  Trophy, Zap, MessageCircle, Calendar, TrendingUp, 
  ChevronRight, Star, Play 
} from 'lucide-react';

const SPORTS = [
  {
    id: 'nba',
    name: 'NBA',
    fullName: 'National Basketball Association',
    icon: '🏀',
    color: 'from-orange-500 to-red-600',
    bgGlow: 'rgba(249, 115, 22, 0.2)',
    href: '/nba',
    status: 'live',
    gamesLive: 4,
    description: 'Real-time scores, play-by-play, and AI insights',
  },
  {
    id: 'nfl',
    name: 'NFL',
    fullName: 'National Football League',
    icon: '🏈',
    color: 'from-blue-500 to-indigo-600',
    bgGlow: 'rgba(59, 130, 246, 0.2)',
    href: '/nfl',
    status: 'coming',
    description: 'Coming Soon - Football intelligence',
  },
  {
    id: 'mlb',
    name: 'MLB',
    fullName: 'Major League Baseball',
    icon: '⚾',
    color: 'from-red-500 to-rose-600',
    bgGlow: 'rgba(239, 68, 68, 0.2)',
    href: '/mlb',
    status: 'coming',
    description: 'Coming Soon - Baseball analytics',
  },
  {
    id: 'ncaa',
    name: 'NCAA',
    fullName: 'College Sports',
    icon: '🎓',
    color: 'from-purple-500 to-violet-600',
    bgGlow: 'rgba(168, 85, 247, 0.2)',
    href: '/ncaa',
    status: 'coming',
    description: 'Coming Soon - College basketball & football',
  },
];

function SportCard({ sport }: { sport: typeof SPORTS[0] }) {
  const isLive = sport.status === 'live';
  
  return (
    <Link
      href={sport.href}
      className={`group relative block p-6 rounded-2xl glass card-hover overflow-hidden ${
        !isLive ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''
      }`}
      style={{
        background: `radial-gradient(ellipse at top right, ${sport.bgGlow}, transparent 70%)`,
      }}
    >
      {/* Live badge */}
      {isLive && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs text-green-400 font-medium">
            {sport.gamesLive} LIVE
          </span>
        </div>
      )}
      
      {/* Coming soon badge */}
      {!isLive && (
        <div className="absolute top-4 right-4">
          <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/50">
            Coming Soon
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className={`text-5xl p-3 rounded-xl bg-gradient-to-br ${sport.color} shadow-lg`}>
          {sport.icon}
        </div>
        
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
            {sport.name}
          </h3>
          <p className="text-white/50 text-sm">{sport.fullName}</p>
          <p className="text-white/70 text-sm mt-2">{sport.description}</p>
        </div>
      </div>

      {isLive && (
        <div className="mt-4 flex items-center gap-2 text-sm text-white/60 group-hover:text-white/80 transition-colors">
          <Play className="w-4 h-4" />
          <span>Enter Arena</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      )}
    </Link>
  );
}

function QuickAction({ icon: Icon, label, href, color }: {
  icon: typeof Trophy;
  label: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 rounded-xl glass card-hover"
    >
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-white font-medium">{label}</span>
      <ChevronRight className="w-4 h-4 text-white/40 ml-auto" />
    </Link>
  );
}

export default function HubPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 glass-dark">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-2xl font-black gradient-text">
                Playmaker
              </span>
              <span className="absolute -top-1 -right-6 text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-orange-500 to-blue-500 rounded-full text-white font-bold">
                AI
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/nba/calendar" className="text-white/60 hover:text-white text-sm font-medium transition-colors">
              Calendar
            </Link>
            <Link href="/nba/standings" className="text-white/60 hover:text-white text-sm font-medium transition-colors">
              Standings
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link 
              href="/chat" 
              className="p-2 rounded-lg hover:bg-white/10 transition-colors group relative"
            >
              <MessageCircle className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center space-y-6 py-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-blue">
            <Zap className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-200">AI-Powered Sports Intelligence</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black">
            <span className="gradient-text">Your Game.</span>
            <br />
            <span className="text-white">Your Playmaker.</span>
          </h1>
          
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Real-time scores, live AI commentary, and intelligent insights. 
            Like having a sports-obsessed friend who never misses a play.
          </p>
        </div>

        {/* Sports Grid */}
        <div className="mt-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-lg font-semibold text-white/80 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-blue-400" />
            Choose Your Arena
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SPORTS.map((sport) => (
              <SportCard key={sport.id} sport={sport} />
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <QuickAction
            icon={Calendar}
            label="NBA Calendar"
            href="/nba/calendar"
            color="bg-blue-500/20"
          />
          <QuickAction
            icon={TrendingUp}
            label="NBA Standings"
            href="/nba/standings"
            color="bg-green-500/20"
          />
          <QuickAction
            icon={Star}
            label="NBA Teams"
            href="/nba/teams"
            color="bg-yellow-500/20"
          />
        </div>

        {/* Chat CTA Section */}
        <div className="mt-16 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <Link 
            href="/chat"
            className="block max-w-2xl mx-auto p-8 rounded-3xl glass card-hover border border-white/10 hover:border-orange-500/30 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-blue-500 shadow-lg shadow-orange-500/20 group-hover:shadow-orange-500/40 transition-shadow">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1 group-hover:text-orange-400 transition-colors">
                    Chat with Playmaker AI
                  </h2>
                  <p className="text-white/60">
                    Compare players, get live stats, and talk sports
                  </p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-white/40 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
            </div>
            
            <div className="mt-6 flex flex-wrap gap-2">
              {['Compare LeBron vs Curry', "Tonight's games", 'MVP predictions', 'Trade rumors'].map((suggestion) => (
                <span 
                  key={suggestion}
                  className="px-3 py-1.5 text-xs rounded-full bg-white/5 text-white/50 border border-white/10"
                >
                  "{suggestion}"
                </span>
              ))}
            </div>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-white/40 text-sm">
          <p>
            <span className="gradient-text font-semibold">Playmaker</span> — AI-native sports intelligence
          </p>
          <p className="mt-2 text-xs">
            Real-time data. Not affiliated with NBA, NFL, MLB, or NCAA.
          </p>
        </div>
      </footer>
    </div>
  );
}
