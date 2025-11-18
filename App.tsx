
import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Game from './components/Game';

const App: React.FC = () => {
  const [nickname, setNickname] = useState<string>('');
  const [gameStarted, setGameStarted] = useState<boolean>(false);

  const handlePlayNow = useCallback(() => {
    if (nickname.trim() === '') {
      return;
    }
    setGameStarted(true);
  }, [nickname]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-brand-dark relative font-sans">
      {/* The Game Layer */}
      <Game nickname={nickname} isRunning={gameStarted} />

      {/* The UI Overlay Layer */}
      <div
        className={`absolute inset-0 transition-all duration-1000 ease-in-out flex flex-col ${
          gameStarted ? 'opacity-0 pointer-events-none scale-110' : 'opacity-100 scale-100'
        }`}
      >
        {/* Background Image with Gradient Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1527838832700-5059252407fa?q=80&w=1920&auto=format&fit=crop')` }}
        >
           <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-brand-dark/95"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          <Header />
          <main className="flex-grow flex items-center justify-center p-4">
             <Hero
               nickname={nickname}
               setNickname={setNickname}
               onPlay={handlePlayNow}
             />
          </main>
          
          {/* Footer Credit */}
          <footer className="p-4 text-center text-gray-500 text-xs relative z-10">
             Designed with ❤️ for Istanbul
          </footer>
        </div>
      </div>
    </div>
  );
};

export default App;
