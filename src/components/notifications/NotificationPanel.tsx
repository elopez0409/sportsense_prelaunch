'use client';

// Notification Panel - Shows all notifications with mark as read functionality
// Integrates with NotificationProvider context

import { useState } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  CheckCheck, 
  Trash2, 
  Trophy, 
  Zap, 
  AlertTriangle, 
  Info,
  Volume2,
  VolumeX,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { useNotifications, type Notification } from './NotificationProvider';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ICON_MAP = {
  score: Trophy,
  highlight: Zap,
  alert: AlertTriangle,
  info: Info,
};

const COLOR_MAP = {
  score: 'text-green-400 bg-green-500/20',
  highlight: 'text-orange-400 bg-orange-500/20',
  alert: 'text-red-400 bg-red-500/20',
  info: 'text-blue-400 bg-blue-500/20',
};

type FilterType = 'all' | 'unread' | 'score' | 'highlight' | 'alert' | 'info';

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    soundEnabled,
    toggleSound,
  } = useNotifications();

  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.type === filter;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md glass-dark rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-slide-in-right">
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-orange-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-orange-500">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Notifications</h2>
                <p className="text-xs text-white/50">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Sound Toggle */}
              <button
                onClick={toggleSound}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  soundEnabled 
                    ? "text-green-400 hover:bg-green-500/20" 
                    : "text-white/40 hover:bg-white/10"
                )}
                title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Close */}
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span className="capitalize">{filter}</span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  showFilters && "rotate-180"
                )} />
              </button>

              {showFilters && (
                <div className="absolute top-full left-0 mt-2 w-40 glass-dark rounded-lg border border-white/10 py-1 z-10">
                  {(['all', 'unread', 'score', 'highlight', 'alert', 'info'] as FilterType[]).map(f => (
                    <button
                      key={f}
                      onClick={() => {
                        setFilter(f);
                        setShowFilters(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors flex items-center gap-2",
                        filter === f ? "text-blue-400" : "text-white/70"
                      )}
                    >
                      {f !== 'all' && f !== 'unread' && (
                        <span className={COLOR_MAP[f as keyof typeof COLOR_MAP].split(' ')[0]}>
                          {f === 'score' && <Trophy className="w-3 h-3" />}
                          {f === 'highlight' && <Zap className="w-3 h-3" />}
                          {f === 'alert' && <AlertTriangle className="w-3 h-3" />}
                          {f === 'info' && <Info className="w-3 h-3" />}
                        </span>
                      )}
                      <span className="capitalize">{f}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Mark All Read */}
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}

              {/* Clear All */}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-sm text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">
                {filter === 'unread' 
                  ? "You're all caught up!"
                  : "No notifications yet"}
              </p>
              <p className="text-xs text-white/30 mt-2">
                You'll be notified about big plays and game updates
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredNotifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={() => markAsRead(notification.id)}
                  onClear={() => clearNotification(notification.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 text-center">
          <p className="text-xs text-white/30">
            Notifications are saved locally
          </p>
        </div>
      </div>
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
  onClear,
}: {
  notification: Notification;
  onMarkRead: () => void;
  onClear: () => void;
}) {
  const Icon = ICON_MAP[notification.type];
  const colorClass = COLOR_MAP[notification.type];

  return (
    <div
      className={cn(
        "p-4 hover:bg-white/5 transition-colors group",
        !notification.read && "bg-white/[0.02]"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn("p-2 rounded-lg flex-shrink-0", colorClass)}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h4 className={cn(
                  "font-medium text-sm",
                  notification.read ? "text-white/70" : "text-white"
                )}>
                  {notification.title}
                </h4>
                {!notification.read && (
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>
              {notification.sport && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 uppercase">
                  {notification.sport}
                </span>
              )}
            </div>
            
            {/* Time */}
            <span className="text-xs text-white/30 flex-shrink-0">
              {formatRelativeTime(notification.timestamp)}
            </span>
          </div>

          <p className={cn(
            "text-sm mt-1",
            notification.read ? "text-white/50" : "text-white/70"
          )}>
            {notification.message}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {!notification.read && (
              <button
                onClick={onMarkRead}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                <Check className="w-3 h-3" />
                Mark read
              </button>
            )}
            <button
              onClick={onClear}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}





