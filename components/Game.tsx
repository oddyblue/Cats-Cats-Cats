
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ThreeGame } from '../services/ThreeGame';
import { usePlayerControls } from '../hooks/usePlayerControls';
import ControlsGuide from './ControlsGuide';

interface GameProps {
    nickname: string;
    isRunning: boolean;
}

const Game: React.FC<GameProps> = ({ nickname, isRunning }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameInstance = useRef<ThreeGame | null>(null);
  const controls = usePlayerControls(isRunning);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(9);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [totalCollectibles, setTotalCollectibles] = useState(999);

  const handleScoreUpdate = useCallback((newScore: number, total: number) => {
    setScore(newScore);
    setTotalCollectibles(total);
    if (total > 0 && newScore >= total) {
        setGameState('won');
        if (gameInstance.current) gameInstance.current.setRunning(false);
    }
  }, []);

  const handleLivesUpdate = useCallback((remainingLives: number) => {
    setLives(remainingLives);
    if (remainingLives <= 0) {
        setGameState('lost');
        if (gameInstance.current) gameInstance.current.setRunning(false);
    }
  }, []);

  // Init Game
  useEffect(() => {
    if (!canvasRef.current || gameInstance.current) return;
    
    const game = new ThreeGame(canvasRef.current);
    game.onScoreUpdate = handleScoreUpdate;
    game.onLivesUpdate = handleLivesUpdate;
    gameInstance.current = game;
    
    return () => {
        game.dispose();
        gameInstance.current = null;
    };
  }, []);

  // Game State Sync
  useEffect(() => {
    const game = gameInstance.current;
    if (!game) return;

    if (isRunning) {
        if (gameState !== 'playing') {
            game.resetGame();
            setGameState('playing');
        }
        game.setRunning(true);
        // Delay focus to ensure overlay is gone
        setTimeout(() => canvasRef.current?.focus(), 100);
    } else {
        game.setRunning(false);
    }
  }, [isRunning, gameState]);

  // Controls Sync
  useEffect(() => {
    if (gameInstance.current) {
        gameInstance.current.updateControls(controls);
    }
  }, [controls]);

  const handleRetry = () => {
      setGameState('playing');
      if (gameInstance.current) {
          gameInstance.current.resetGame();
          gameInstance.current.setRunning(true);
      }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-gray-900 select-none font-sans text-white overflow-hidden">
        <canvas ref={canvasRef} className="block w-full h-full outline-none cursor-none" tabIndex={0} />

        {/* HUD */}
        <div className={`absolute top-0 left-0 right-0 p-8 flex justify-between items-start transition-all duration-700 ${isRunning && gameState === 'playing' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            
            {/* Player Identity */}
            <div className="flex flex-col">
                <h2 className="text-2xl font-black tracking-tight text-white drop-shadow-md">{nickname}</h2>
                <div className="text-white/60 text-xs font-medium tracking-widest uppercase mt-1">Istanbul Explorer</div>
            </div>

            {/* Status Panel */}
            <div className="flex gap-8 bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/5">
                {/* Hearts */}
                <div className="flex flex-col items-end">
                    <div className="flex gap-1 mb-1">
                         {Array.from({length: 9}).map((_, i) => (
                            <div 
                                key={i} 
                                className={`w-2 h-6 rounded-sm transition-all duration-300 ${i < lives ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]' : 'bg-white/10'}`} 
                            />
                        ))}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Lives</span>
                </div>

                {/* Score */}
                <div className="flex flex-col items-end">
                    <div className="text-3xl font-black tabular-nums leading-none text-brand-orange drop-shadow-sm">
                        {score}<span className="text-white/20 text-lg">/{totalCollectibles}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Simits</span>
                </div>
            </div>
        </div>

        <ControlsGuide isRunning={isRunning && gameState === 'playing'} />

        {/* Overlay Screens */}
        {gameState !== 'playing' && isRunning && (
             <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center animate-fade-in">
                <div className="text-center max-w-md w-full p-12 bg-white/5 border border-white/10 rounded-3xl shadow-2xl transform scale-100">
                    <div className="text-8xl mb-8 animate-bounce">
                        {gameState === 'won' ? '😺' : '😿'}
                    </div>
                    <h2 className="text-4xl font-bold mb-2 text-white">
                        {gameState === 'won' ? 'Purr-fect!' : 'Game Over'}
                    </h2>
                    <p className="text-white/60 mb-8">
                        {gameState === 'won' 
                            ? "You conquered the streets of Kadıköy!" 
                            : "Ran out of lives... Time for a cat nap."}
                    </p>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={handleRetry} 
                            className="w-full py-4 bg-brand-orange text-white font-bold rounded-xl hover:scale-[1.02] transition-transform uppercase tracking-wider text-sm shadow-lg"
                        >
                            Try Again
                        </button>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="w-full py-4 text-white/40 hover:text-white transition-colors text-xs uppercase tracking-widest"
                        >
                            Exit
                        </button>
                    </div>
                </div>
             </div>
        )}
    </div>
  );
};

export default Game;
