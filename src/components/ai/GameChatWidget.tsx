'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, X, Send, Minimize2, Maximize2, 
  Sparkles, Bot, User, Loader2, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GameInfo } from '@/types/nba';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GameChatWidgetProps {
  games: GameInfo[];
  sport: string;
}

export function GameChatWidget({ games, sport }: GameChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(games[0] || null);
  const [personality, setPersonality] = useState<'default' | 'hype' | 'drunk' | 'announcer'>('default');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          personality,
          length: 'medium',
          type: 'game',
          gameContext: selectedGame ? {
            homeTeam: selectedGame.homeTeam.fullName,
            awayTeam: selectedGame.awayTeam.fullName,
            homeScore: selectedGame.homeScore,
            awayScore: selectedGame.awayScore,
            period: selectedGame.period,
            gameClock: selectedGame.gameClock,
            status: selectedGame.status,
          } : null,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || data.error || 'Sorry, I encountered an error.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm having trouble connecting. Please try again!",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-gradient-to-r from-orange-500 to-blue-500 text-white shadow-lg hover:scale-105 transition-transform glow-mixed"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-50 glass-dark rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden",
        isMinimized
          ? "bottom-6 right-6 w-72 h-14"
          : "bottom-6 right-6 w-96 h-[500px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-orange-500/10 to-blue-500/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-blue-500">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Live Game AI</h3>
            {!isMinimized && selectedGame && (
              <p className="text-[10px] text-white/50">
                {selectedGame.awayTeam.abbreviation} vs {selectedGame.homeTeam.abbreviation}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4 text-white/60" />
            ) : (
              <Minimize2 className="w-4 h-4 text-white/60" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Game selector + Personality */}
          {games.length > 1 && (
            <div className="px-3 py-2 border-b border-white/10 flex gap-2">
              <select
                value={selectedGame?.id || ''}
                onChange={(e) => setSelectedGame(games.find(g => g.id === e.target.value) || null)}
                className="flex-1 text-xs rounded-lg px-2 py-1.5 bg-white/5 border border-white/10"
              >
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
                  </option>
                ))}
              </select>
              
              <select
                value={personality}
                onChange={(e) => setPersonality(e.target.value as any)}
                className="text-xs rounded-lg px-2 py-1.5 bg-white/5 border border-white/10"
              >
                <option value="default">🤖 Normal</option>
                <option value="hype">🔥 Hype</option>
                <option value="drunk">🍺 Casual</option>
                <option value="announcer">📻 Announcer</option>
              </select>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 h-[320px]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Bot className="w-10 h-10 text-blue-400 mb-3" />
                <p className="text-white/60 text-sm">
                  Ask me about the live game! I'm watching with you.
                </p>
                <div className="mt-3 space-y-1">
                  {['Who\'s playing well?', 'Score update?', 'Any highlights?'].map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="block w-full text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2",
                      msg.role === 'user' ? "flex-row-reverse" : ""
                    )}
                  >
                    <div className={cn(
                      "p-1.5 rounded-lg shrink-0 h-fit",
                      msg.role === 'user' ? "bg-blue-500/20" : "bg-orange-500/20"
                    )}>
                      {msg.role === 'user' ? (
                        <User className="w-3 h-3 text-blue-400" />
                      ) : (
                        <Bot className="w-3 h-3 text-orange-400" />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-[80%] rounded-xl px-3 py-2 text-xs",
                      msg.role === 'user'
                        ? "bg-blue-500/20 text-white"
                        : "bg-white/5 text-white/90"
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-2">
                    <div className="p-1.5 rounded-lg bg-orange-500/20">
                      <Bot className="w-3 h-3 text-orange-400" />
                    </div>
                    <div className="bg-white/5 rounded-xl px-3 py-2">
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about the game..."
                className="flex-1 text-sm rounded-xl px-3 py-2 bg-white/5 border border-white/10 focus:border-blue-500/50"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2 rounded-xl bg-gradient-to-r from-orange-500 to-blue-500 text-white disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}




