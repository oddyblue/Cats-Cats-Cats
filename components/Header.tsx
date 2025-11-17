
import React from 'react';

const CatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-orange" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.08c-.71 0-1.33-.29-1.79-.75-.46-.46-.75-1.08-.75-1.79 0-.71.29-1.33.75-1.79.46-.46 1.08-.75 1.79-.75s1.33.29 1.79.75c.46.46.75 1.08.75 1.79 0 .71-.29 1.33-.75 1.79-.46.46-1.08.75-1.79.75zm5-3.8c-.3-.21-.63-.35-.98-.44.83-1.04 1.2-2.34.8-3.7-1.11-3.7-5.46-5.6-8.82-4.48s-5.6 5.46-4.48 8.82c.81 2.45 3.09 4.1 5.61 4.31.25.01.5.02.75.02.69 0 1.35-.14 1.97-.4.08-.03.16-.07.23-.12.22-.14.41-.31.57-.5.1-.11.18-.23.25-.36.17-.33.26-.7.26-1.09 0-.32-.07-.64-.2-.93zm-8.8-1.55c-.71 0-1.33-.29-1.79-.75-.46-.46-.75-1.08-.75-1.79s.29-1.33.75-1.79c.46-.46 1.08-.75 1.79-.75s1.33.29 1.79.75c.46.46.75 1.08.75 1.79s-.29 1.33-.75 1.79c-.46.46-1.08.75-1.79.75z"/>
  </svg>
);

const Header: React.FC = () => {
  return (
    <header className="py-4">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center space-x-3">
          <CatIcon />
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-wider">
            Istanbul Cats
          </h1>
        </div>
      </div>
    </header>
  );
};

export default Header;
