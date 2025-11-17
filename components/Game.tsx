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
  const [totalCollectibles, setTotalCollectibles] = useState(0);
  const [gameWon, setGameWon] = useState(false);

  const handleScoreUpdate = useCallback((newScore: number, total: number) => {
    setScore(newScore);
    if (totalCollectibles === 0 && total > 0) {
      setTotalCollectibles(total);
    }
    if (newScore === total && total > 0) {
      setGameWon(true);
    }
  }, [totalCollectibles]);


  useEffect(() => {
    if (canvasRef.current && !gameInstance.current) {
      gameInstance.current = new ThreeGame(canvasRef.current);
      gameInstance.current.onScoreUpdate = handleScoreUpdate;
      gameInstance.current.init();
      
      return () => {
        gameInstance.current?.dispose();
        gameInstance.current = null;
      };
    }
  }, [handleScoreUpdate]);

  useEffect(() => {
    if (gameInstance.current) {
      gameInstance.current.setRunning(isRunning);
      if (isRunning && gameWon) {
        // Reset win state if starting a new game
        setGameWon(false);
      }
    }
  }, [isRunning, gameWon]);

  useEffect(() => {
    if (gameInstance.current) {
      gameInstance.current.updateControls(controls);
    }
  }, [controls]);


  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}>
        <div 
          className={`absolute top-5 left-5 text-white z-10 bg-black/50 p-2.5 rounded-md font-sans transition-opacity duration-500 ${isRunning ? 'opacity-100' : 'opacity-0'}`}
        >
            <p>Playing as: <strong>{nickname}</strong></p>
            <p>Fish Collected: <strong>{score} / {totalCollectibles}</strong></p>
        </div>
        <ControlsGuide isRunning={isRunning} />
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

        {/* Win Screen Overlay */}
        {gameWon && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20 text-white font-sans animate-fade-in">
            <h2 className="text-6xl font-black text-brand-orange mb-4">YOU WIN!</h2>
            <p className="text-2xl text-gray-200">You collected all the fish in Istanbul!</p>
            <p className="text-lg mt-2">A true master of the rooftops.</p>
             <p className="text-sm text-gray-400 mt-8">Reload the page to play again.</p>
          </div>
        )}
    </div>
  );
};

export default Game;