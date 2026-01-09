'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Game } from '../lib/types';
import { formatModelName } from '../lib/constants';
import { Canvas, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import PokerScene from './PokerScene';
import { Play, Pause, SkipForward, SkipBack, FastForward, Rewind, ZoomIn, ZoomOut, Eye, List } from 'lucide-react';
import GameTimeline from './GameTimeline';
import StackSizeChart from './StackSizeChart';
import GameStats from './GameStats';
import { calculateWinProbabilities } from '../lib/poker-engine';
import TopDownView from './poker/TopDownView';

function CameraUpdater({ fov }: { fov: number }) {
  const { camera } = useThree();
  useEffect(() => {
    // @ts-ignore - TS might complain about fov on Camera but PerspectiveCamera has it
    if (camera.type === 'PerspectiveCamera') {
      // @ts-ignore
      camera.fov = fov;
      // @ts-ignore
      camera.zoom = 0.6; // Fixed optical zoom
      camera.updateProjectionMatrix();
    }
  }, [fov, camera]);
  return null;
}

interface GameSimulatorProps {
  game: Game;
  runId?: string;
}

export default function GameSimulator({ game, runId }: GameSimulatorProps) {
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [fov, setFov] = useState(35);
  const [zoom, setZoom] = useState(0.6);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [sceneReady, setSceneReady] = useState(false);
  const [winProbabilities, setWinProbabilities] = useState<(number | null)[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  const currentHand = game.hands[currentHandIndex];
  const steps = useMemo(() => {
    return currentHand?.actions || [];
  }, [currentHand]);

  // Reconstruct state for the current step
  const gameState = useMemo(() => {
    if (!currentHand) {
      return { players: [], board: [], pot: 0, dealerIndex: -1 };
    }

    const players = game.players.map(name => ({
      name,
      displayName: formatModelName(name, runId),
      stack: currentHand.pre_hand_stacks[name] || 0,
      bet: 0,
      cards: currentHand.hole_cards[name] || [],
      isActive: (currentHand.pre_hand_stacks[name] || 0) > 0,
      isFolded: false,
      isDealer: currentHand.dealer === name,
      isAction: false,
      thought: '',
      currentAction: undefined as string | undefined,
      netGain: 0,
      winProbability: null as number | null
    }));

    let pot = 0;
    const board: string[] = [];
    const dealerIndex = game.players.indexOf(currentHand.dealer);

    // Initialize Blinds with Elimination Handling
    const activePlayersCount = players.filter(p => p.stack > 0).length;

    const getNextActive = (startIdx: number) => {
      let current = (startIdx + 1) % players.length;
      for (let i = 0; i < players.length; i++) {
        if (players[current].stack > 0) return current;
        current = (current + 1) % players.length;
      }
      return -1;
    };

    let sbIndex = -1;
    let bbIndex = -1;

    if (activePlayersCount === 2) {
      // Heads Up: Dealer is SB, Opponent is BB
      sbIndex = dealerIndex;
      bbIndex = getNextActive(dealerIndex);
    } else if (activePlayersCount > 2) {
      // Normal: SB left of Dealer, BB left of SB
      sbIndex = getNextActive(dealerIndex);
      if (sbIndex !== -1) {
        bbIndex = getNextActive(sbIndex);
      }
    }

    // Apply blinds (cap at stack size)
    if (sbIndex !== -1 && players[sbIndex]) {
      const sbAmt = Math.min(players[sbIndex].stack, 50);
      players[sbIndex].bet = sbAmt;
      players[sbIndex].stack -= sbAmt;
    }
    if (bbIndex !== -1 && players[bbIndex]) {
      const bbAmt = Math.min(players[bbIndex].stack, 100);
      players[bbIndex].bet = bbAmt;
      players[bbIndex].stack -= bbAmt;
    }

    // Apply actions up to currentStepIndex
    for (let i = 0; i <= currentStepIndex && i < steps.length; i++) {
      const action = steps[i];
      if (action.type === 'street_event') {
        // Collect folded cards when moving to next street
        players.forEach(p => { p.isFolded = false; });

        if (action.cards) {
          board.splice(0, board.length, ...action.cards);
        }
        if (action.street && action.street !== 'PRE-FLOP') {
          // Collect bets
          players.forEach(p => {
            pot += p.bet;
            p.bet = 0;
          });
        }
      } else if (action.type === 'player_action') {
        const pIndex = players.findIndex(p => p.name === action.player);
        if (pIndex !== -1) {
          const p = players[pIndex];
          const amount = action.chips_added || 0;
          p.stack -= amount;
          p.bet += amount;
          p.thought = (i === currentStepIndex) ? (action.thought || '') : '';
          p.isAction = (i === currentStepIndex);
          if (i === currentStepIndex) {
            p.currentAction = action.action;
          }

          if (action.action === 'fold') {
            p.isActive = false;
            p.isFolded = true;
          }
        }
      }
    }

    // Check results at end of hand
    if (currentStepIndex >= steps.length - 1) {
      currentHand.results.forEach(r => {
        const p = players.find(pl => pl.name === r.player);
        if (p) p.netGain = r.net_gain;
      });
    }

    return { players, board, pot, dealerIndex };
  }, [currentHand, currentStepIndex, game.players, steps]);

  // Calculate win probabilities lazily to not lag the simulation
  useEffect(() => {
    setWinProbabilities([]);

    const activeWithCards = gameState.players.filter(p => p.isActive && p.cards.length === 2);
    if (activeWithCards.length < 2) {
      setIsCalculating(false);
      return;
    }

    setIsCalculating(true);
    const timer = setTimeout(() => {
      const { players, board } = gameState;
      if (players.length === 0) {
        setIsCalculating(false);
        return;
      }

      const result = calculateWinProbabilities(players, board);
      setWinProbabilities(result);
      setIsCalculating(false);
    }, isPlaying ? 200 : 50);

    return () => clearTimeout(timer);
  }, [gameState.players, gameState.board, isPlaying]);

  // Merge win probabilities into game state for the scene
  const scenePlayers = useMemo(() => {
    return gameState.players.map((p, i) => ({
      ...p,
      winProbability: winProbabilities[i] ?? null,
      isCalculating: isCalculating && p.isActive && p.cards.length === 2
    }));
  }, [gameState.players, winProbabilities, isCalculating]);

  // Auto-play logic

  const stateRef = useRef({ currentStepIndex, currentHandIndex, steps, game });
  stateRef.current = { currentStepIndex, currentHandIndex, steps, game };

  useEffect(() => {
    if (!isPlaying) return;

    const tick = () => {
      const { currentStepIndex, steps, currentHandIndex, game } = stateRef.current;
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      } else {
        // If we're at the end of the current hand, move to the next one
        if (currentHandIndex < game.hands.length - 1) {
          setCurrentHandIndex(h => h + 1);
          setCurrentStepIndex(0);
        } else {
          setIsPlaying(false);
        }
      }
    };

    tick();
    const interval = setInterval(tick, 2000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  const handleNextHand = () => {
    if (currentHandIndex < game.hands.length - 1) {
      setCurrentHandIndex(prev => prev + 1);
      setCurrentStepIndex(0);
    }
  };

  const handlePrevHand = () => {
    if (currentHandIndex > 0) {
      setCurrentHandIndex(prev => prev - 1);
      setCurrentStepIndex(0);
    }
  };

  const handleStepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentStepIndex(Number(e.target.value));
  };

  if (!currentHand) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        No hand data available.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mb-0 select-none">
      <div className="card text-white relative overflow-hidden p-0 bg-black mb-0 poker-scene-container">
        <div className="absolute top-4 left-4 z-10 select-none">
          <h2 className="text-2xl font-bold bg-black-50 px-2 rounded">Hand #{currentHand.hand_number}</h2>
          <div className="mt-2 space-y-1">
            {currentHand.results.length > 0 && currentStepIndex >= steps.length - 1 && (
              <div className="bg-green-900-80 p-2 rounded max-w-xs">
                <span className="font-bold text-green-300">Winner:</span> {formatModelName(currentHand.results.find(r => r.winner)?.player || '', runId)}
              </div>
            )}
          </div>
        </div>


        {/* Persistent Loading Overlay - Fades out only when Scene is actually ready */}
        {viewMode === '3d' && !sceneReady && (
          <div className="loading-overlay">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <div className="text-blue-400 font-bold tracking-widest text-sm uppercase animate-pulse">
                  Loading...
                </div>
              </div>
          </div>
        )}

        <Suspense fallback={null}>
          {viewMode === '3d' ? (
            <Canvas shadows camera={{ position: [-9.43, 12.03, 26.47], fov: fov, zoom: 0.6 }}>
              <CameraUpdater fov={fov} />
              <PokerScene
                players={scenePlayers}
                board={gameState.board}
                pot={gameState.pot}
                dealerIndex={gameState.dealerIndex}
                zoomLevel={zoom}
                onZoomChange={setZoom}
                onSceneReady={() => setSceneReady(true)}
              />
            </Canvas>
          ) : (
            <TopDownView
              players={scenePlayers}
              board={gameState.board}
              pot={gameState.pot}
              dealerIndex={gameState.dealerIndex}
            />
          )}
        </Suspense>
      </div>

      <div className="layout-split mb-0">
        {/* Control Panel (Left) */}
        <div className="control-panel mb-0 h-full flex flex-col gap-4">
          <div className="flex-responsive-tight">
            <div className="flex items-center gap-1">
              <button onClick={handlePrevHand} className="btn-control" style={{ marginRight: '4px' }} title="Previous Hand"><SkipBack size={14} /></button>
              <button
                onClick={() => {
                  if (currentStepIndex > 0) {
                    setCurrentStepIndex(currentStepIndex - 1);
                  } else if (currentHandIndex > 0) {
                    const prevHand = game.hands[currentHandIndex - 1];
                    setCurrentHandIndex(currentHandIndex - 1);
                    setCurrentStepIndex(prevHand.actions.length - 1);
                  }
                }}
                className="btn-control"
                title="Previous Step"
              >
                <Rewind size={14} />
              </button>

              <div style={{ margin: '0 4px' }}>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="btn-play"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={20} className="fill-white" /> : <Play size={20} className="fill-white" style={{ marginLeft: '3px' }} />}
                </button>
              </div>

              <button
                onClick={() => {
                  if (currentStepIndex < steps.length - 1) {
                    setCurrentStepIndex(currentStepIndex + 1);
                  } else {
                    handleNextHand();
                  }
                }}
                className="btn-control"
                title="Next Step"
              >
                <FastForward size={14} />
              </button>
              <button onClick={handleNextHand} className="btn-control" style={{ marginLeft: '4px' }} title="Next Hand"><SkipForward size={14} /></button>
            </div>

            <div className="flex items-center gap-3" style={{ background: 'rgba(30, 41, 59, 0.3)', padding: '0.375rem', borderRadius: '0.5rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span className="text-xs font-bold text-slate-400 px-2 lg-visible">SPEED</span>
              <div className="flex gap-2">
                {[0.5, 1, 2, 5].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`speed-toggle ${playbackSpeed === speed ? 'active' : ''}`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Unified Control Panel Section */}
          <div className="panel-section flex-responsive-tight">
            {/* Step/Progress Control */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <List size={14} className="text-blue-400" />
                <span className="text-xs font-bold text-slate-400">Step</span>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="range"
                  min={0}
                  max={steps.length - 1}
                  value={currentStepIndex}
                  onChange={handleStepChange}
                  className="range-slider"
                  style={{ height: '4px' }}
                />
                <span className="text-xs font-mono text-slate-300 w-12 text-right shrink-0">{currentStepIndex}/{steps.length - 1}</span>
              </div>
            </div>

            <div className="w-px h-6 bg-white/10 shrink-0 lg-visible" />

            {/* View Controls Group */}
            <div className="flex items-center gap-4 shrink-0 flex-wrap sm:flex-nowrap">
              {/* FOV */}
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-blue-400" />
                <span className="text-xs font-bold text-slate-400 xl-visible">FOV</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={fov}
                  onChange={(e) => setFov(Number(e.target.value))}
                  className="range-slider"
                  style={{ width: '60px', height: '4px' }}
                />
              </div>

              {/* Zoom */}
              <div className="flex items-center gap-2">
                <ZoomIn size={14} className="text-blue-400" />
                <span className="text-xs font-bold text-slate-400 xl-visible">Zoom</span>
                <input
                  type="range"
                  min={0.4}
                  max={1.5}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="range-slider"
                  style={{ width: '60px', height: '4px' }}
                />
              </div>

              <div className="w-px h-6 bg-white/10 shrink-0 lg-visible" />

              <div className="flex items-center gap-2 p-1 bg-white/5 rounded-lg border border-white/5">
                <button
                  onClick={() => setViewMode('3d')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === '3d' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  3D
                </button>
                <button
                  onClick={() => setViewMode('2d')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === '2d' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  2D
                </button>
              </div>

              <div className="w-px h-6 bg-white/10 shrink-0 lg-visible" />

              <button
                onClick={() => { setFov(35); setZoom(0.6); }}
                className="text-xs font-bold text-slate-400 hover:text-white transition-colors shrink-0 px-2 py-1 rounded hover:bg-white/5"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Thoughts Panel (Right) - Persistent to prevent layout shift */}
        <div className="card border-l-4 border-blue-500 mb-0 flex flex-col overflow-hidden h-full" style={{ minHeight: '160px' }}>
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10 shrink-0">
            {gameState.players.find(p => p.thought)?.thought ? (
              <>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="font-bold text-blue-400">
                  {gameState.players.find(p => p.thought)?.displayName || gameState.players.find(p => p.thought)?.name}
                </span>
                <span className="text-xs text-slate-500 uppercase tracking-wider font-mono">
                  {'// REASONING TRACE'}
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-600 uppercase tracking-wider font-mono">{'// WAITING FOR ACTION'}</span>
            )}
          </div>
          <div className="text-slate-300 text-sm leading-relaxed font-mono whitespace-pre-wrap flex-1 overflow-y-auto pr-2 custom-scrollbar select-text">
            {gameState.players.find(p => p.thought)?.thought || <span className="text-slate-700 italic">No active thoughts...</span>}
          </div>
        </div>
      </div>

      <GameTimeline
        hands={game.hands}
        currentHandIndex={currentHandIndex}
        onHandSelect={(index) => {
          setCurrentHandIndex(index);
          setCurrentStepIndex(0);
          setIsPlaying(false);
        }}
      />
      <StackSizeChart game={game} currentHandIndex={currentHandIndex} runId={runId} />
      <GameStats game={game} currentHandIndex={currentHandIndex} runId={runId} />
    </div>
  );
}
