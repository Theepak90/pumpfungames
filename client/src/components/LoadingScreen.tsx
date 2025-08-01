import { useState, useEffect } from 'react';

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

export default function LoadingScreen({ onLoadingComplete }: LoadingScreenProps) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('LOADING...');

  useEffect(() => {
    const loadingSteps = [
      { text: 'INITIALIZING GAME...', delay: 500 },
      { text: 'LOADING ASSETS...', delay: 800 },
      { text: 'SPAWNING SNAKES...', delay: 600 },
      { text: 'PREPARING ARENA...', delay: 700 },
      { text: 'READY TO PLAY!', delay: 400 }
    ];

    let currentStep = 0;
    const totalSteps = loadingSteps.length;

    const runLoadingStep = () => {
      if (currentStep < totalSteps) {
        setLoadingText(loadingSteps[currentStep].text);
        setLoadingProgress(((currentStep + 1) / totalSteps) * 100);
        
        setTimeout(() => {
          currentStep++;
          if (currentStep < totalSteps) {
            runLoadingStep();
          } else {
            // All loading complete
            setTimeout(() => {
              onLoadingComplete();
            }, 500);
          }
        }, loadingSteps[currentStep].delay);
      }
    };

    runLoadingStep();
  }, [onLoadingComplete]);

  return (
    <div className="absolute inset-0 z-30" style={{ backgroundColor: '#15161b' }}>
      <div className="w-full h-full flex flex-col items-center justify-center">
        {/* Loading Title */}
        <div className="text-green-500 text-6xl font-bold mb-8" style={{ 
          fontFamily: "'Press Start 2P', monospace",
          textShadow: '4px 4px 0px #000000, 8px 8px 20px rgba(0, 255, 0, 0.5)'
        }}>
          SNAKE ARENA
        </div>
        
        {/* Loading Text */}
        <div className="text-white text-2xl mb-12" style={{ 
          fontFamily: "'Press Start 2P', monospace"
        }}>
          {loadingText}
        </div>
        
        {/* Loading Bar */}
        <div className="w-96 h-4 bg-gray-800 border-2 border-gray-600 rounded">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded transition-all duration-300"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
        
        {/* Loading Percentage */}
        <div className="text-green-400 text-xl mt-4" style={{ 
          fontFamily: "'Press Start 2P', monospace"
        }}>
          {Math.round(loadingProgress)}%
        </div>
      </div>
    </div>
  );
}