'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TopDownCard from './TopDownCard';
import { MODEL_CONFIG } from '../../lib/constants';

interface PlayerState {
  name: string;
  displayName?: string;
  stack: number;
  bet: number;
  cards: string[];
  isActive: boolean;
  isFolded: boolean;
  isDealer: boolean;
  isAction: boolean;
  currentAction?: string;
  thought?: string;
  netGain?: number;
  winProbability?: number | null;
  isCalculating?: boolean;
}

interface TopDownViewProps {
  players: PlayerState[];
  board: string[];
  pot: number;
  dealerIndex: number;
}

export default function TopDownView({ players, board, pot, dealerIndex }: TopDownViewProps) {
  // Player positions around the table (centered at 50, 50) distributed in an oval shape
  const getPlayerPosition = (index: number, total: number) => {
    // Offset so player 0 is at the bottom center
    const angle = (index / total) * Math.PI * 2 + Math.PI / 2;
    // Push players slightly further out to sit "around" the smaller table
    const rx = 33; // horizontal radius in %
    const ry = 32; // vertical radius in %

    return {
      left: `${50 + Math.cos(angle) * rx}%`,
      top: `${46 + Math.sin(angle) * ry}%`,
      angle
    };
  };

  const totalPot = pot + players.reduce((sum, p) => sum + p.bet, 0);

  return (
    <div
      className="relative w-full rounded-t-xl group/view border-b border-white/10 shadow-inner select-none font-sans"
      style={{ height: '100%', minHeight: '500px', backgroundColor: '#2d0f0f' }} // Reduced minHeight to fit smaller screens
    >
      {/* Background/Room Styling */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #500f0f 0%, #200505 100%)', opacity: 0.8 }} />

      {/* Table Rail (Outer Border) */}
      <div
        className="absolute shadow-2xl"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '64%',
          height: '46%',
          backgroundColor: '#1a1a1a',
          borderRadius: '120px',
          border: '16px solid #1f1212',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), inset 0 2px 5px rgba(255,255,255,0.05)'
        }}
      />

      {/* Table Felt */}
      <div
        className="absolute overflow-hidden"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '61%',
          height: '43%',
          backgroundColor: '#104020',
          borderRadius: '100px',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)'
        }}
      >
        {/* Felt Texture/Gradient */}
        <div className="absolute inset-0 opacity-100" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #15552b 0%, #0e351b 100%)' }} />

        {/* Branding / Center Info - Moved below board */}
        <div
          className="absolute flex flex-col items-center pointer-events-none"
          style={{ top: '75%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.1 }}
        >
          <span className="font-black tracking-[0.1em] text-black text-xl" style={{ textTransform: 'lowercase' }}>pokerbench.adfontes.io</span>
        </div>

        {/* Pot Display - Centered above Board */}
        <div
          className="absolute flex flex-col items-center gap-1 z-10 shadow-2xl"
          style={{
            top: '22%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            borderRadius: '999px',
            padding: '6px 20px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            margin: '0 5px'
          }}
        >
          <div
            className="font-black tracking-widest"
            style={{
              color: '#fbbf24',
              fontSize: '20px',
              textShadow: '0 0 10px rgba(251, 191, 36, 0.4)'
            }}
          >
            POT: ${totalPot.toLocaleString()}
          </div>
        </div>

        {/* Board Cards */}
        <div
          className="absolute flex gap-4 z-10"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <AnimatePresence mode='popLayout'>
            {board.map((card, i) => (
              <motion.div
                key={`${card}-${i}`}
                initial={{ opacity: 0, y: 20, rotateY: 90 }}
                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', damping: 15, stiffness: 100 }}
              >
                <TopDownCard card={card} />
              </motion.div>
            ))}
          </AnimatePresence>
          {Array.from({ length: Math.max(0, 5 - board.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="rounded border border-white/5 border-dashed"
              style={{ width: '50px', height: '72px', backgroundColor: 'rgba(0,0,0,0.1)' }}
            />
          ))}
        </div>
      </div>

      {/* Players */}
      {players.map((player, i) => {
        const pos = getPlayerPosition(i, players.length);
        const config = MODEL_CONFIG[player.name] || MODEL_CONFIG[player.name.toLowerCase()];

        return (
          <div
            key={player.name}
            className="absolute flex flex-col items-center gap-3"
            style={{
              left: pos.left,
              top: pos.top,
              zIndex: 20,
              transform: 'translate(-50%, -50%)' // Explicit transform for centering
            }}
          >
            {/* Dealer Button is positioned relative to the Player now, visible on top */}
            {player.isDealer && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute w-8 h-8 bg-white rounded-full border-2 border-gray-300 flex items-center justify-center font-black text-black shadow-lg z-50"
                style={{
                  top: '40px',
                  right: '-10px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                }}
              >
                D
              </motion.div>
            )}

            {/* Action Badge */}
            <AnimatePresence>
              {player.isAction && player.currentAction && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute px-3 py-1 rounded shadow-[0_5px_15px_rgba(0,0,0,0.4)] z-50 font-black uppercase tracking-widest ring-1 ring-black/20"
                  style={{
                    top: '-32px',
                    fontSize: '12px',
                    backgroundColor: player.currentAction === 'fold' ? '#ef4444' : player.currentAction === 'check' ? '#10b981' : '#f59e0b',
                    color: 'white',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span>{player.currentAction}</span>
                    {['bet', 'call', 'raise', 'all-in'].includes(player.currentAction.toLowerCase()) && player.bet > 0 && (
                      <span className="opacity-90">${player.bet.toLocaleString()}</span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Structured Player Info Badge */}
            <div
              className="flex flex-col items-stretch overflow-hidden rounded-lg border shadow-xl backdrop-blur-md"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                borderColor: player.isAction ? 'rgba(59, 130, 246, 0.6)' : 'rgba(255, 255, 255, 0.1)',
                minWidth: '140px'
              }}
            >
              {/* Name Header with Small Logo */}
              <div
                className="flex items-center justify-center gap-2 px-3 py-1.5 border-b border-white/10"
                style={{ backgroundColor: player.isAction ? 'rgba(30, 58, 138, 0.8)' : 'transparent' }}
              >
                {config?.logo && (
                  <img
                    src={config.logo}
                    alt={player.name}
                    className={`object-contain ${config.logoInvert ? 'invert' : ''}`}
                    style={{
                      width: '20px',
                      height: '20px',
                      minWidth: '20px',
                      opacity: player.isActive ? 1 : 0.6
                    }}
                  />
                )}
                <span className="font-bold text-white truncate text-center" style={{ fontSize: '13px' }}>{player.displayName || player.name}</span>
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-between px-3 py-1.5 gap-3">
                <span className="text-green-400 font-mono font-bold" style={{ fontSize: '14px' }}>${player.stack.toLocaleString()}</span>
                {player.isActive && player.winProbability !== null && player.winProbability !== undefined && (
                  <span className="text-blue-300 font-bold" style={{ fontSize: '12px' }}>{player.winProbability.toFixed(0)}%</span>
                )}
              </div>

              {/* Out State Overlay */}
              {!player.isActive && !player.isFolded && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-grayscale z-10">
                  <span className="font-exhibit font-bold text-white/50 tracking-widest text-xs">OUT</span>
                </div>
              )}
            </div>

            {/* Hold Cards - Centered below badge */}
            <div className="absolute flex gap-1 transform translate-y-2" style={{ top: '100%', paddingTop: '8px' }}>
              {player.isActive && player.cards.length > 0 && !player.isFolded && (
                <>
                  <motion.div initial={{ x: 15, rotate: -5 }} animate={{ x: 0, rotate: -5 }} style={{ zIndex: 10 }}>
                    <TopDownCard card={player.cards[0]} />
                  </motion.div>
                  <motion.div initial={{ x: -15, rotate: 5 }} animate={{ x: 0, rotate: 5 }} style={{ marginLeft: '-15px', zIndex: 20 }}>
                    <TopDownCard card={player.cards[1]} />
                  </motion.div>
                </>
              )}
              {player.isFolded && (
                <div className="opacity-50 grayscale scale-90 flex gap-1 transform translate-y-1">
                  <div style={{ transform: 'rotate(-8deg)', zIndex: 10 }}>
                    <TopDownCard card="XX" isFolded />
                  </div>
                  <div style={{ transform: 'rotate(8deg)', marginLeft: '-20px', zIndex: 20 }}>
                    <TopDownCard card="XX" isFolded />
                  </div>
                </div>
              )}
            </div>

            {/* Bet Amount (Chips on Table) */}
            {player.bet > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute pointer-events-none flex flex-col items-center justify-center"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) translate(${Math.cos(pos.angle || 0) * 160}px, ${Math.sin(pos.angle || 0) * 120}px)`
                }}
              >
                {/* Graphics for Chips */}
                <div
                  className="w-8 h-8 rounded-full border-4 border-dashed border-white/30 shadow-lg mb-1"
                  style={{ backgroundColor: '#eab308', boxShadow: '0 4px 6px rgba(0,0,0,0.5)' }}
                />

                <div
                  className="bg-black/80 text-[#fbbf24] font-black px-3 py-1 rounded-full shadow-lg border border-yellow-600/50 whitespace-nowrap z-30"
                  style={{ fontSize: '13px' }}
                >
                  ${player.bet.toLocaleString()}
                </div>
              </motion.div>
            )}

            {/* Net Gain (Win Animation) */}
            <AnimatePresence>
              {player.netGain !== undefined && player.netGain !== 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: 1, y: -100, scale: 1.2 }}
                  exit={{ opacity: 0 }}
                  className={`absolute font-black text-2xl drop-shadow-md z-50 whitespace-nowrap`}
                  style={{ color: player.netGain > 0 ? '#4ade80' : '#f87171', top: '0' }}
                >
                  {player.netGain > 0 ? '+$' : '-$'}{Math.abs(player.netGain).toLocaleString()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Hand Info Overlay (Small) */}
      <div className="absolute bottom-6 left-6 z-10 pointer-events-none opacity-50">
        <div className="text-white font-mono tracking-widest uppercase" style={{ fontSize: '12px' }}>
          2D Traditional View
        </div>
      </div>
    </div>
  );
}
