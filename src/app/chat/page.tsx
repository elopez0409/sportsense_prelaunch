'use client';

// Playmaker AI Chat - The most sophisticated sports intelligence assistant
// Features: Advanced analytics, live data, rich visuals, personality modes

import { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { 
  Send, Settings, Sparkles, Loader2, Bot, Zap, Beer, Megaphone, 
  Radio, Trophy, Target, Flame, Clock, BarChart3, Users, TrendingUp,
  Plus, ArrowUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  AIVisualRenderer,
  type AIVisualResponse,
} from '@/components/ai/ChatVisuals';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  visual?: AIVisualResponse;
  intent?: string;
}

interface ChatSettings {
  personality: 'default' | 'hype' | 'drunk' | 'announcer' | 'analyst';
  length: 'short' | 'medium' | 'long';
}

const PERSONALITIES = [
  { id: 'default', name: 'Playmaker', icon: Bot, description: 'Balanced & Intelligent', color: 'from-blue-500 to-cyan-500' },
  { id: 'hype', name: 'Hype Beast', icon: Zap, description: 'MAX ENERGY!', color: 'from-orange-500 to-red-500' },
  { id: 'drunk', name: 'Bar Buddy', icon: Beer, description: 'Casual Vibes', color: 'from-amber-500 to-yellow-500' },
  { id: 'announcer', name: 'Broadcaster', icon: Megaphone, description: 'Professional', color: 'from-purple-500 to-pink-500' },
  { id: 'analyst', name: 'Analyst', icon: Radio, description: 'Deep Stats', color: 'from-green-500 to-emerald-500' },
] as const;


const SUGGESTED_PROMPTS = [
  { text: "What are today's NBA games?", icon: Clock, visualHint: "games" },
  { text: "Show me the standings", icon: Trophy, visualHint: "standings" },
  { text: "Compare LeBron vs Curry", icon: TrendingUp, visualHint: "comparison" },
  { text: "Tell me about Luka Doncic", icon: Users, visualHint: "player" },
  { text: "Who's the MVP frontrunner?", icon: Target, visualHint: "analysis" },
  { text: "Best shooters in the league?", icon: Flame, visualHint: "leaders" },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>({
    personality: 'default',
    length: 'medium',
  });
  const [typedText, setTypedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [messages, scrollToBottom]);

  // Add initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hey! 👋 I'm your Playmaker AI assistant with access to **live NBA data**. I can show you:\n\n• 📊 **Today's games** with live scores\n• 🏆 **Standings** for both conferences\n• 👤 **Player stats** and profiles\n• ⚡ **Player comparisons** with visual breakdowns\n\nTry asking anything - I'll show you rich visuals, not just text!",
        timestamp: new Date(),
      }]);
    }
  }, []);

  // Typewriter effect for "Just Ask."
  useEffect(() => {
    if (messages.length > 1) {
      // Don't animate if there's already a conversation
      setTypedText('Just Ask.');
      setShowCursor(false);
      return;
    }

    const targetText = 'Just Ask.';
    let currentIndex = 0;
    setTypedText('');
    setShowCursor(true);

    const typeInterval = setInterval(() => {
      if (currentIndex < targetText.length) {
        setTypedText(targetText.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        // After typing is complete, start cursor blink
        clearInterval(typeInterval);
      }
    }, 120); // Speed of typing (120ms per character = ~1 second total)

    // Cursor blink animation
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);

    return () => {
      clearInterval(typeInterval);
      clearInterval(cursorInterval);
    };
  }, [messages.length]);

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
    const currentInput = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          personality: settings.personality,
          length: settings.length,
          type: 'general',
          requestVisuals: true,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || data.error || 'Sorry, I encountered an error.',
        timestamp: new Date(),
        visual: data.visual,
        intent: data.intent,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again!",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      setInput(text);
      handleSubmit(fakeEvent);
    }, 100);
  };

  const currentPersonality = PERSONALITIES.find(p => p.id === settings.personality);

  // Format message content with markdown-like styling
  const formatContent = (content: string) => {
    return content
      .split('\n')
      .map((line) => {
        // Bold text
        line = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
        // Bullet points
        if (line.startsWith('• ') || line.startsWith('- ')) {
          return `<div class="flex gap-2 my-1"><span class="text-orange-400">•</span><span>${line.slice(2)}</span></div>`;
        }
        return line;
      })
      .join('<br/>');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section - Meta Manus Style - Only show when no conversation */}
        {messages.length <= 1 && (
          <div className="max-w-4xl mx-auto text-center space-y-8 py-12 animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-serif text-white/90 min-h-[4rem] flex items-center justify-center">
              <span>{typedText || '\u00A0'}</span>
              <span className={cn(
                "transition-opacity duration-300 ml-1 text-6xl md:text-7xl",
                showCursor ? "opacity-100" : "opacity-0"
              )}>|</span>
            </h1>

          {/* Main Input - Centered, Large */}
          <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                <Plus className="w-6 h-6 text-white/40" />
              </div>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Assign a task or ask anything"
                className="w-full bg-white rounded-2xl px-14 py-6 pr-16 text-gray-900 text-lg placeholder:text-gray-400 resize-none focus:outline-none focus:ring-4 focus:ring-blue-500/30 max-h-32 shadow-2xl"
                rows={1}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all",
                  input.trim() && !isLoading
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowUp className="w-5 h-5" />
                )}
              </button>
            </div>

          </form>
          </div>
        )}

        {/* Messages Area - Show when conversation starts */}
        {messages.length > 1 && (
          <div className="max-w-4xl mx-auto mt-8 pb-24">
            <div className="space-y-6">
            {messages.slice(1).map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex animate-fade-in",
                  message.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  message.role === 'user' ? "max-w-[85%]" : "w-full max-w-[95%]"
                )}>
                  {/* Message Bubble */}
                  <div
                    className={cn(
                      "relative px-6 py-4 rounded-2xl",
                      message.role === 'user'
                        ? "bg-blue-600 text-white rounded-br-md ml-auto shadow-lg"
                        : "bg-white/10 text-white/90 rounded-bl-md backdrop-blur-sm border border-white/10"
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
                        <div className={cn(
                          "p-1.5 rounded-full bg-gradient-to-br",
                          currentPersonality?.color || "from-blue-500 to-cyan-500"
                        )}>
                          <Sparkles className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-xs text-white/70 uppercase tracking-wider font-medium">
                          {currentPersonality?.name || 'Playmaker'}
                        </span>
                        {message.intent && message.intent !== 'general' && (
                          <span className="ml-2 px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                            {message.intent}
                          </span>
                        )}
                      </div>
                    )}
                    <div 
                      className="text-sm whitespace-pre-wrap leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
                    />
                  </div>

                  {/* Rich Visual Response */}
                  {message.visual && (
                    <div className="mt-4">
                      <AIVisualRenderer visual={message.visual} />
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className={cn(
                    "text-xs text-white/30 mt-2 px-2",
                    message.role === 'user' ? "text-right" : "text-left"
                  )}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-white/10 rounded-2xl rounded-bl-md px-6 py-4 backdrop-blur-sm border border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-white/40">Fetching live data...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
            </div>

            {/* Input at bottom when in conversation */}
            <form onSubmit={handleSubmit} className="sticky bottom-0 bg-black/80 backdrop-blur-xl rounded-2xl p-4 border border-white/10 mt-6 z-30 shadow-2xl">
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about games, players, stats..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white text-sm placeholder:text-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 max-h-32"
                    rows={1}
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all",
                      input.trim() && !isLoading
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                        : "bg-white/10 text-white/30 cursor-not-allowed"
                    )}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUp className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Suggested Prompts - When no conversation */}
        {messages.length <= 1 && (
          <div className="max-w-4xl mx-auto mt-12 py-8 animate-fade-in">
            <p className="text-center text-white/50 text-sm mb-6">Try asking:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => handleSuggestionClick(prompt.text)}
                  className="flex items-start gap-4 p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                >
                  <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-blue-500/20 group-hover:from-orange-500/30 group-hover:to-blue-500/30 transition-colors">
                    <prompt.icon className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-medium mb-1">{prompt.text}</h3>
                    <p className="text-white/40 text-xs">Click to get started</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Settings Panel - Floating */}
      {showSettings && (
        <div className="fixed bottom-20 right-4 w-80 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 z-50 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Chat Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-white/60 hover:text-white transition-colors"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs text-white/50 mb-3">Personality</p>
              <div className="grid grid-cols-5 gap-2">
                {PERSONALITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSettings(s => ({ ...s, personality: p.id as ChatSettings['personality'] }))}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg transition-all",
                      settings.personality === p.id
                        ? `bg-gradient-to-br ${p.color} text-white shadow-lg`
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                    title={p.description}
                  >
                    <p.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{p.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-white/50 mb-3">Response Length</p>
              <div className="flex gap-2">
                {['short', 'medium', 'long'].map((len) => (
                  <button
                    key={len}
                    onClick={() => setSettings(s => ({ ...s, length: len as ChatSettings['length'] }))}
                    className={cn(
                      "flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize",
                      settings.length === len
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Button - Fixed Bottom Right */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className={cn(
          "fixed bottom-6 right-6 p-4 rounded-full transition-all shadow-lg z-40",
          showSettings 
            ? "bg-blue-600 text-white" 
            : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white backdrop-blur-sm border border-white/10"
        )}
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );
}
