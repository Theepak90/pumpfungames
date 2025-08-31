import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Gift, X } from 'lucide-react';

interface DailyRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim: () => void;
  canClaim: boolean;
  hoursUntilNext: number;
}

const spinRewards = [
  { label: '$0.10', value: 0.10, color: '#10b981' },
  { label: '$0.50', value: 0.50, color: '#ef4444' },
  { label: '$1.00', value: 1.00, color: '#3b82f6' },
  { label: '$5.00', value: 5.00, color: '#8b5cf6' },
  { label: '$10.00', value: 10.00, color: '#f59e0b' },
  { label: '$100.00', value: 100.00, color: '#06b6d4' },
  { label: '$500.00', value: 500.00, color: '#f97316' },
  { label: '$1000.00', value: 1000.00, color: '#eab308' },
];

export default function DailyRewardModal({ isOpen, onClose, onClaim, canClaim, hoursUntilNext }: DailyRewardModalProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [wonReward, setWonReward] = useState<typeof spinRewards[0] | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  const handleSpin = async () => {
    if (!canClaim || isSpinning || hasSpun) return;
    
    setIsSpinning(true);
    
    // Prize probabilities as specified
    const weights = [100, 0, 0, 0, 0, 0, 0, 0]; // $0.10 = 100%, all others = 0%
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    let selectedIndex = 0;
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedIndex = i;
        break;
      }
    }
    
    const selectedReward = spinRewards[selectedIndex];
    const segmentAngle = 360 / spinRewards.length;
    const targetAngle = selectedIndex * segmentAngle + (segmentAngle / 2);
    const spins = 5; // Number of full rotations
    const finalRotation = spins * 360 + (360 - targetAngle); // Spin to the selected segment
    
    // Apply rotation to wheel
    if (wheelRef.current) {
      wheelRef.current.style.transform = `rotate(${finalRotation}deg)`;
    }
    
    // Wait for spin animation to complete
    setTimeout(async () => {
      setWonReward(selectedReward);
      setHasSpun(true);
      setIsSpinning(false);
      
      // Call the original onClaim function
      try {
        await onClaim();
      } catch (error) {
        console.error('Failed to claim reward:', error);
      }
    }, 3000); // 3 seconds for spin animation
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-2 border-green-500 text-white max-w-lg w-full mx-4 rounded-xl shadow-2xl [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="pb-4 border-b border-green-500/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 font-retro text-xl text-green-400">
              <Gift className="w-6 h-6" />
              Daily Spin Wheel
            </DialogTitle>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors border-2 border-gray-600 hover:border-green-500"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-green-400" />
            </button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 pt-2">
          {!canClaim ? (
            <div className="text-center space-y-4">
              <div className="bg-red-900/30 border-2 border-red-600/50 rounded-lg p-4">
                <p className="text-red-400 font-retro text-lg mb-2">
                  ⏰ Already Spun Today!
                </p>
                <p className="text-gray-300 font-retro text-sm">
                  Next spin available in: <span className="text-yellow-400 font-bold">{hoursUntilNext} hours</span>
                </p>
              </div>
            </div>
          ) : hasSpun ? (
            <div className="text-center space-y-4">
              <div className="bg-green-900/30 border-2 border-green-500/50 rounded-lg p-6">
                <div className="text-green-400 text-3xl font-retro mb-4">🎉 Congratulations! 🎉</div>
                <div className="text-white font-retro text-2xl mb-2">
                  You won: <span className="text-yellow-400 font-bold">{wonReward?.label}</span>
                </div>
                <p className="text-gray-300 font-retro text-sm">
                  Added to your balance!
                </p>
              </div>
              <Button
                onClick={onClose}
                className="w-full bg-green-600 hover:bg-green-700 font-retro py-3 text-white rounded-lg border-2 border-green-500 text-lg"
              >
                Awesome!
              </Button>
            </div>
          ) : (
            <>
              {/* Spinning Wheel */}
              <div className="flex justify-center relative">
                <div className="relative">
                  {/* Pointer */}
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2 z-10">
                    <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-b-[25px] border-l-transparent border-r-transparent border-b-white"></div>
                  </div>
                  
                  {/* Wheel */}
                  <div 
                    ref={wheelRef}
                    className="w-80 h-80 rounded-full border-4 border-white relative overflow-hidden"
                    style={{
                      transition: isSpinning ? 'transform 3s cubic-bezier(0.23, 1, 0.32, 1)' : 'none',
                    }}
                  >
                    {spinRewards.map((reward, index) => {
                      const segmentAngle = 360 / spinRewards.length;
                      const rotation = index * segmentAngle;
                      
                      return (
                        <div
                          key={index}
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos((segmentAngle * Math.PI) / 180)}% ${50 - 50 * Math.sin((segmentAngle * Math.PI) / 180)}%)`,
                            transform: `rotate(${rotation}deg)`,
                            backgroundColor: reward.color,
                          }}
                        >
                          <div 
                            className="text-white font-retro text-sm font-bold absolute"
                            style={{
                              transform: `rotate(${segmentAngle / 2}deg) translateY(-120px)`,
                            }}
                          >
                            {reward.label}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Center circle */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800 rounded-full border-4 border-white flex items-center justify-center">
                      <Gift className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Spin Button */}
              <Button
                onClick={handleSpin}
                disabled={isSpinning || !canClaim}
                className="w-full bg-green-600 hover:bg-green-700 font-retro py-3 text-white rounded-lg border-2 border-green-500 text-lg disabled:bg-gray-600 disabled:border-gray-500"
              >
                {isSpinning ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Spinning...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Gift className="w-5 h-5" />
                    Spin the Wheel!
                  </div>
                )}
              </Button>
              
              <p className="text-center text-gray-400 font-retro text-xs">
                Spin once per day for your chance to win rewards!
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}