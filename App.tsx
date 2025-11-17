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
    <div className="w-screen h-screen bg-brand-dark">
      {/* The Game is now always rendered in the background. Removing Suspense
          to bypass a suspected incompatibility with React 19's StrictMode. */}
      <Game nickname={nickname} isRunning={gameStarted} />

      {/* The UI is now an overlay that fades out, providing a seamless transition. */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
          gameStarted ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div
          className="min-h-screen bg-brand-sand text-brand-dark font-sans bg-cover bg-center"
          style={{ backgroundImage: `url('https://picsum.photos/seed/istanbul/1920/1080')` }}
        >
          <div className="min-h-screen bg-black/60 backdrop-blur-sm flex flex-col">
            <Header />
            <main className="container mx-auto px-4 py-8 md:py-16 flex-grow flex items-center justify-center">
              <div className="max-w-3xl w-full">
                <Hero
                  nickname={nickname}
                  setNickname={setNickname}
                  onPlay={handlePlayNow}
                />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;