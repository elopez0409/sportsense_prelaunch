'use client';

import { useEffect } from 'react';

// Component that scrolls to top when mounted
export function ScrollToTop() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return null;
}




