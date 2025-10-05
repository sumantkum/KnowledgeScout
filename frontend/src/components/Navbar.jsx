import React from 'react';

function Navbar() {
  return (
    <nav className="w-full py-4 px-8 flex justify-between items-center bg-white/5 backdrop-blur-lg shadow-lg border-b border-white/10">
      <h1 className="text-2xl font-bold text-white tracking-wide">
        Knowledge<span className="text-blue-400">Scout</span>
      </h1>
      <button
        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg shadow transition-all text-white">
        Sign In
      </button>
    </nav>
  );
}

export default Navbar;