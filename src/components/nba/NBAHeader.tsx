'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Bell, Volume2, VolumeX, Menu, X, Gamepad2 } from 'lucide-react';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { useState } from 'react';

const navItems = [
  { href: '/nba', label: 'Games' },
  { href: '/nba/calendar', label: 'Calendar' },
  { href: '/nba/teams', label: 'Teams' },
  { href: '/nba/players', label: 'Players' },
  { href: '/nba/standings', label: 'Standings' },
];

export function NBAHeader() {
  const pathname = usePathname();
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Safe access to notifications
  let unreadCount = 0;
  let soundEnabled = true;
  let toggleSound = () => {};
  
  try {
    const notifications = useNotifications();
    unreadCount = notifications.unreadCount;
    soundEnabled = notifications.soundEnabled;
    toggleSound = notifications.toggleSound;
  } catch {
    // Context not available
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-white/10 glass-dark">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🏀</span>
            <div className="relative flex items-center gap-2">
              <div className="p-1 rounded-lg bg-gradient-to-br from-orange-500 to-blue-500">
                <Gamepad2 className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-black gradient-text">
                Playmaker
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded font-bold">
                NBA
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/nba' && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-white/60 px-3 py-1.5 rounded-full bg-white/5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              Live
            </div>

            {/* Sound toggle */}
            <button
              onClick={toggleSound}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={soundEnabled ? 'Mute notifications' : 'Enable notification sounds'}
            >
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 text-white/60" />
              ) : (
                <VolumeX className="w-5 h-5 text-white/40" />
              )}
            </button>

            {/* Notifications */}
            <button
              onClick={() => setShowNotifPanel(true)}
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Bell className="w-5 h-5 text-white/60" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-white/60" /> : <Menu className="w-5 h-5 text-white/60" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-black/95 backdrop-blur-xl">
            <nav className="container mx-auto px-4 py-4 space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/nba' && pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'block px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                      isActive
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Notification Panel */}
      <NotificationPanel 
        isOpen={showNotifPanel}
        onClose={() => setShowNotifPanel(false)}
      />
    </>
  );
}
