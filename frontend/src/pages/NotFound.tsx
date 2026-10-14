import React from 'react';
import { Link } from 'react-router-dom';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="space-y-4 max-w-md">
        <h1 className="text-7xl font-extrabold text-decodeai-primary">404</h1>
        <h2 className="text-2xl font-bold text-slate-100">Page Not Found</h2>
        <p className="text-slate-400 text-sm">
          The page or lesson you are looking for does not exist or has been moved.
        </p>
        <div className="pt-4">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium transition-colors border border-slate-700"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};
