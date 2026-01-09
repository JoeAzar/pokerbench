'use client';

import React from 'react';

interface TopDownCardProps {
  card: string;
  isFolded?: boolean;
}

const SUIT_COLORS = {
  h: '#ef4444', // Hearts - Red
  d: '#ef4444', // Diamonds - Red
  c: '#0f172a', // Clubs - Black (darker for contrast)
  s: '#0f172a', // Spades - Black
};

const SUIT_SYMBOLS = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

export default function TopDownCard({ card, isFolded }: TopDownCardProps) {
  if (!card) return null;

  // Parse "Ah", "Td", etc.
  const shortCode = card.includes('(')
    ? card.split('(')[1]?.replace(')', '') || card
    : card;

  const rank = shortCode.slice(0, -1);
  const suit = shortCode.slice(-1).toLowerCase() as keyof typeof SUIT_COLORS;

  const color = SUIT_COLORS[suit] || '#000000';
  const symbol = SUIT_SYMBOLS[suit] || '?';

  // Increased dimensions for better visibility
  const w = '50px';
  const h = '72px';

  if (isFolded) {
    return (
      <div
        className="rounded border shadow-md flex items-center justify-center"
        style={{
          width: w,
          height: h,
          borderColor: 'rgba(30, 58, 138, 1)',
          backgroundColor: '#1e3a8a', // Dark blue
          boxShadow: '2px 2px 5px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ width: '80%', height: '85%', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '4px' }} />
      </div>
    );
  }

  return (
    <div
      className="rounded-md shadow-md flex flex-col justify-between p-1.5 select-none transition-transform"
      style={{
        width: w,
        height: h,
        position: 'relative',
        backgroundColor: '#ffffff', // Explicit white background for non-Tailwind
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
      }}
    >
      <div className="flex flex-col items-center" style={{ position: 'absolute', top: '4px', left: '4px' }}>
        <div className="font-bold leading-none" style={{ color, fontSize: '14px' }}>{rank}</div>
        <div style={{ color, fontSize: '12px', lineHeight: '1' }}>{symbol}</div>
      </div>

      <div className="flex justify-center items-center flex-1" style={{ color, fontSize: '28px' }}>
        {symbol}
      </div>

      <div className="flex flex-col items-center" style={{ position: 'absolute', bottom: '4px', right: '4px', transform: 'rotate(180deg)' }}>
        <div className="font-bold leading-none" style={{ color, fontSize: '14px' }}>{rank}</div>
        <div style={{ color, fontSize: '12px', lineHeight: '1' }}>{symbol}</div>
      </div>
    </div>
  );
}
