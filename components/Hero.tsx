
import React, { useEffect } from 'react';

const TITLES = [
  "The Bosphorus Jumper", "Galata Guardian", "Pasha of Pera", 
  "Kadiköy King", "Prince of Polonez", "The Sultan's Shadow",
  "Grand Bazaar Ghost", "Ferry Chaser", "Tea Garden Thief"
];

const NAMES = [
  "Muezza", "Tombili", "Gli", "Duman", "Simba", 
  "Zeytin", "Pamuk", "Boncuk", "Lokum", "Şero"
];

interface HeroProps {
  nickname: string;
  setNickname: (name: string) => void;
  onPlay: () => void;
}

const Hero: React.FC<HeroProps> = ({ nickname, setNickname, onPlay }) => {
  useEffect(() => {
    if (!nickname) handleRandomize();
  }, []);

  const handleRandomize = () => {
    const randomTitle = TITLES[Math.floor(Math.random() * TITLES.length)];
    const randomName = NAMES[Math.floor(Math.random() * NAMES.length)];
    setNickname(`${randomName}, ${randomTitle}`);
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-2xl mx-auto text-center font-sans">
      
      <div className="mb-16 space-y-4 animate-fade-in-up">
        <h1 className="text-6xl md:text-9xl font-bold text-white tracking-tighter leading-none drop-shadow-2xl">
          ISTANBUL
          <span className="block text-4xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-yellow-500 mt-2">
            CATS
          </span>
        </h1>
      </div>

      <div className="w-full space-y-8 animate-fade-in-up delay-100">
        <div className="relative group max-w-md mx-auto">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-transparent border-b-2 border-white/10 focus:border-brand-orange py-4 text-center text-2xl font-light text-white placeholder-white/20 focus:outline-none transition-all"
              placeholder="Name your cat"
            />
            <button 
              onClick={handleRandomize}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-white/30 hover:text-brand-orange transition-colors p-2"
              title="Randomize"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
        </div>

        <button
          onClick={onPlay}
          disabled={!nickname.trim()}
          className="group relative px-12 py-5 bg-white text-black font-black rounded-full hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 overflow-hidden"
        >
          <span className="relative z-10 tracking-widest uppercase text-sm">Start Adventure</span>
          <div className="absolute inset-0 bg-brand-orange transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
          <span className="absolute inset-0 z-10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 tracking-widest uppercase text-sm">Let's Go!</span>
        </button>
      </div>
      
      <div className="mt-16 flex gap-8 text-white/40 text-xs font-bold tracking-widest uppercase">
         <span className="flex items-center gap-2"><span className="w-1 h-1 bg-brand-orange rounded-full"></span>Explore</span>
         <span className="flex items-center gap-2"><span className="w-1 h-1 bg-brand-orange rounded-full"></span>Meow</span>
         <span className="flex items-center gap-2"><span className="w-1 h-1 bg-brand-orange rounded-full"></span>Survive</span>
      </div>
    </div>
  );
};

export default Hero;
