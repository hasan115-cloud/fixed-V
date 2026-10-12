"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center font-sans">
        <h2 className="text-xl font-bold mb-2">Application Error</h2>
        <p className="text-neutral-400 text-sm max-w-md text-center mb-4">
          {error?.message || "An unexpected error occurred while loading the application."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-sm transition-colors"
        >
          Reload Dashboard
        </button>
      </body>
    </html>
  );
}
