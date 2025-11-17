import React from 'react';

const CAT_NAMES = [
  "Muezza", "Tombili", "Gli", "Pasha", "Simba", "Luna", "Zeytin", "Duman",
  "Pamuk", "Kedi", "Aslan", "Sultan", "Lokum", "Boncuk"
];

interface HeroProps {
  nickname: string;
  setNickname: (name: string) => void;
  onPlay: () => void;
}

const Hero: React.FC<HeroProps> = ({ nickname, setNickname, onPlay }) => {
  const handleRandomName = () => {
    const randomName = CAT_NAMES[Math.floor(Math.random() * CAT_NAMES.length)];
    setNickname(randomName);
  };
  
  const isDisabled = nickname.trim() === '';

  return (
    <div className="text-center bg-black/50 p-8 rounded-2xl shadow-2xl border border-white/20">
      <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-2">Your Nine Lives Begin Now</h2>
      <p className="text-lg text-gray-300 mb-8">Enter the sprawling world of Istanbul as a cunning cat. No sign-ups, no delays.</p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Enter Cat Name..."
          className="w-full flex-grow px-4 py-3 rounded-md bg-white/10 text-white placeholder-gray-400 border-2 border-transparent focus:outline-none focus:border-brand-orange transition duration-300"
          aria-label="Enter Cat Name"
        />
        <button
          onClick={handleRandomName}
          className="w-full sm:w-auto px-4 py-3 bg-brand-blue hover:bg-cyan-700 text-white font-bold rounded-md whitespace-nowrap transition duration-300 transform hover:scale-105"
        >
          Random Name
        </button>
      </div>

      <button
        onClick={onPlay}
        disabled={isDisabled}
        className="mt-6 w-full max-w-xs mx-auto px-8 py-4 bg-brand-orange hover:bg-amber-600 text-white font-black text-xl rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100"
        aria-label="Play Now"
      >
        PLAY NOW
      </button>
       {isDisabled && <p className="text-xs text-gray-400 mt-2">Please enter a name to play.</p>}
    </div>
  );
};

export default Hero;
