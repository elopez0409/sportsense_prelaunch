// Natural language date parsing for sports queries
// Handles: "last Tuesday", "next Tuesday", "tomorrow", "Jan 8", "2024-01-08", "January 8, 1998", etc.
// Supports historical dates from 1946 (first NBA season) to present

export interface ParsedDate {
  date: Date;
  dateString: string; // YYYYMMDD format for ESPN API
  displayString: string; // Human-readable format
  isPast: boolean;
  isFuture: boolean;
  isToday: boolean;
}

/**
 * Parse natural language date expressions into actual dates
 */
export function parseNaturalDate(input: string, referenceDate: Date = new Date()): ParsedDate | null {
  const normalized = input.toLowerCase().trim();
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Handle "today" - require word boundary to avoid matching "today's" as just "today"
  // Use regex with word boundaries to ensure we match whole words
  if (/\btoday\b/.test(normalized)) {
    return createParsedDate(today, 'Today');
  }
  
  // Handle "tomorrow" - require word boundary
  if (/\btomorrow\b/.test(normalized)) {
    return createParsedDate(tomorrow, 'Tomorrow');
  }
  
  // Handle "yesterday" - require word boundary
  if (/\byesterday\b/.test(normalized)) {
    return createParsedDate(yesterday, 'Yesterday');
  }
  
  // Handle day of week patterns
  const dayOfWeekPattern = /(last|next|this|past)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i;
  const dayMatch = normalized.match(dayOfWeekPattern);
  
  if (dayMatch) {
    const modifier = dayMatch[1]?.toLowerCase() || '';
    const dayName = dayMatch[2]?.toLowerCase() || '';
    
    const dayIndex = getDayIndex(dayName);
    if (dayIndex === null) return null;
    
    const currentDay = today.getDay();
    let targetDate = new Date(today);
    
    // Calculate days difference
    let daysDiff = dayIndex - currentDay;
    
    if (modifier === 'last' || modifier === 'past') {
      // Last occurrence (go back)
      if (daysDiff >= 0) {
        daysDiff -= 7; // Same day this week, so go to last week
      }
      targetDate.setDate(today.getDate() + daysDiff);
    } else if (modifier === 'next') {
      // Next occurrence (go forward)
      if (daysDiff <= 0) {
        daysDiff += 7; // Same day this week or past, so go to next week
      }
      targetDate.setDate(today.getDate() + daysDiff);
    } else {
      // This week (closest occurrence)
      if (daysDiff < -3) {
        daysDiff += 7; // Too far in past, use next week
      } else if (daysDiff > 3) {
        daysDiff -= 7; // Too far in future, use last week
      }
      targetDate.setDate(today.getDate() + daysDiff);
    }
    
    const displayString = formatDateDisplay(targetDate, modifier ? `${modifier} ${dayName}` : dayName);
    return createParsedDate(targetDate, displayString);
  }
  
  // Handle "last week" or "next week" (without number)
  if (normalized.includes('last week') || normalized === 'last week') {
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return createParsedDate(lastWeek, 'Last Week');
  }
  
  if (normalized.includes('next week') || normalized === 'next week') {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return createParsedDate(nextWeek, 'Next Week');
  }
  
  // Handle "next [number] days/weeks" or "last [number] days/weeks"
  const relativePattern = /(next|last|in|ago)\s*(\d+)\s*(day|days|week|weeks|month|months)/i;
  const relativeMatch = normalized.match(relativePattern);
  
  if (relativeMatch) {
    const direction = relativeMatch[1]?.toLowerCase();
    const amount = parseInt(relativeMatch[2] || '0');
    const unit = relativeMatch[3]?.toLowerCase();
    
    let targetDate = new Date(today);
    
    if (unit?.startsWith('day')) {
      targetDate.setDate(today.getDate() + (direction === 'next' || direction === 'in' ? amount : -amount));
    } else if (unit?.startsWith('week')) {
      targetDate.setDate(today.getDate() + (direction === 'next' || direction === 'in' ? amount * 7 : -amount * 7));
    } else if (unit?.startsWith('month')) {
      targetDate.setMonth(today.getMonth() + (direction === 'next' || direction === 'in' ? amount : -amount));
    }
    
    const displayString = formatDateDisplay(targetDate, `${direction} ${amount} ${unit}`);
    return createParsedDate(targetDate, displayString);
  }
  
  // Handle specific dates: "January 8", "Jan 8", "1/8", "2024-01-08", "2024/01/08"
  const datePatterns = [
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/, // YYYY-MM-DD or YYYY/MM/DD
    /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/i, // Month Day [Year]
    /(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?/, // MM-DD-YY or MM/DD/YYYY
  ];
  
  for (const pattern of datePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      let year: number, month: number, day: number;
      
      if (match[0].includes('-') || match[0].includes('/')) {
        // Numeric format
        if (match[3] && match[3].length === 4) {
          // YYYY-MM-DD
          year = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          day = parseInt(match[3]);
        } else if (match[3] && match[3].length <= 2) {
          // MM-DD-YY (handle 2-digit years)
          const yy = parseInt(match[3]);
          // If YY < 50, assume 2000s; if >= 50, assume 1900s (but must be >= 46 for NBA)
          year = yy < 50 ? 2000 + yy : (yy >= 46 ? 1900 + yy : 2000 + yy);
          month = parseInt(match[1]) - 1;
          day = parseInt(match[2]);
        } else {
          // MM-DD (assume current year, but check if it's in the past)
          year = today.getFullYear();
          month = parseInt(match[1]) - 1;
          day = parseInt(match[2]);
          
          // If the date has already passed this year, it might be referring to next year
          const testDate = new Date(year, month, day);
          if (testDate < today && testDate.getMonth() < today.getMonth() - 1) {
            // Date is significantly in the past, might be next year
            // But for NBA queries, it's more likely to be this season or last season
          }
        }
        
        // Validate year is in reasonable NBA range
        if (year < 1946 || year > today.getFullYear() + 10) {
          return null;
        }
      } else {
        // Month name format: "January 8, 1998" or "January 8"
        month = getMonthIndex(match[1]);
        day = parseInt(match[2]);
        // Support historical years (1946-2099)
        year = match[3] ? parseInt(match[3]) : today.getFullYear();
        
        // Validate year is in reasonable NBA range (1946 to 10 years in future)
        if (year < 1946 || year > today.getFullYear() + 10) {
          return null;
        }
      }
      
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const targetDate = new Date(year, month, day);
        targetDate.setHours(0, 0, 0, 0);
        
        // Validate date is valid and in NBA era (1946 onwards)
        if (targetDate.getFullYear() === year && 
            targetDate.getMonth() === month && 
            targetDate.getDate() === day &&
            year >= 1946) {
          const displayString = formatDateDisplay(targetDate, match[0]);
          return createParsedDate(targetDate, displayString);
        }
      }
    }
  }
  
  return null;
}

/**
 * Extract date from a message and return parsed date info
 */
export function extractDateFromMessage(message: string): ParsedDate | null {
  // Common date patterns in questions
  // Note: Use word boundaries (\b) for standalone words to avoid matching "today" in "today's"
  const dateKeywords = [
    /\b(today|tomorrow|yesterday)\b/i, // Word boundaries to avoid matching "today's", "todays", etc.
    /\b(last|next)\s+week\b/i, // "last week" or "next week"
    /\b(last|next|this|past)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
    /\b(next|last|in|ago)\s+\d+\s+(day|days|week|weeks)\b/i,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\b/i,
    /\b\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?\b/,
    /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/,
  ];
  
  for (const pattern of dateKeywords) {
    const match = message.match(pattern);
    if (match) {
      return parseNaturalDate(match[0]);
    }
  }
  
  return null;
}

function getDayIndex(dayName: string): number | null {
  const dayMap: Record<string, number> = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'tues': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6,
  };
  
  return dayMap[dayName] ?? null;
}

function getMonthIndex(monthName: string): number {
  const monthMap: Record<string, number> = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11,
  };
  
  return monthMap[monthName.toLowerCase()] ?? -1;
}

function createParsedDate(date: Date, displayString: string): ParsedDate {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const dateString = date.toISOString().split('T')[0].replace(/-/g, '');
  
  const isToday = targetDate.getTime() === today.getTime();
  const isPast = targetDate.getTime() < today.getTime();
  const isFuture = targetDate.getTime() > today.getTime();
  
  const formattedDisplay = formatDateDisplay(targetDate, displayString);
  
  return {
    date: targetDate,
    dateString,
    displayString: formattedDisplay,
    isPast,
    isFuture,
    isToday,
  };
}

function formatDateDisplay(date: Date, fallback: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  if (targetDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (targetDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else if (targetDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  }
}

