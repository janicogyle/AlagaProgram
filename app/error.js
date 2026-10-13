'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <main style={{ maxWidth: 640, margin: '10vh auto', padding: 24, textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <p>Please try again. If the problem continues, contact the ALAGA program office.</p>
      <button type="button" onClick={reset} style={{ padding: '10px 18px', cursor: 'pointer' }}>
        Try again
      </button>
    </main>
  );
}
