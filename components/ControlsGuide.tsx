import React from 'react';

interface ControlsGuideProps {
  isRunning: boolean;
}

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-10 h-10 bg-black/50 border-2 border-white/30 rounded-md flex items-center justify-center font-bold text-lg">
    {children}
  </div>
);

const ControlsGuide: React.FC<ControlsGuideProps> = ({ isRunning }) => {
  return (
    <div
      className={`absolute bottom-5 left-5 text-white z-10 p-4 rounded-md font-sans transition-opacity duration-700 select-none ${
        isRunning ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <Key>W</Key>
            <div className="flex gap-2 mt-1">
              <Key>A</Key>
              <Key>S</Key>
              <Key>D</Key>
            </div>
          </div>
          <p className="font-semibold ml-2">Move</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-10 px-6 bg-black/50 border-2 border-white/30 rounded-md flex items-center justify-center font-bold text-lg">
            SPACE
          </div>
          <p className="font-semibold ml-2">Jump (x3)</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="h-10 px-4 bg-black/50 border-2 border-white/30 rounded-md flex items-center justify-center font-bold text-lg">
            SHIFT
          </div>
          <p className="font-semibold ml-2">Sprint</p>
        </div>
        
         <div className="flex items-center gap-2">
          <div className="h-10 px-4 bg-black/50 border-2 border-white/30 rounded-md flex items-center justify-center font-bold text-lg">
            MOUSE
          </div>
          <p className="font-semibold ml-2">Control Camera</p>
        </div>

      </div>
    </div>
  );
};

export default ControlsGuide;