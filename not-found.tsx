import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
      <h2 className="text-2xl font-bold mb-2">404 - Page Not Found</h2>
      <p className="text-neutral-400 text-sm mb-6">The requested console resource could not be found.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-sm transition-colors"
      >
        Return to Security Dashboard
      </Link>
    </div>
  );
}
