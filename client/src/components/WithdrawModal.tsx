import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { X, ArrowUpRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  onWithdrawComplete: (amount: number) => void;
}

export default function WithdrawModal({ isOpen, onClose, currentBalance, onWithdrawComplete }: WithdrawModalProps) {
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const MIN_WITHDRAWAL = 50;

  const handleWithdraw = async () => {
    if (!withdrawAmount || !walletAddress) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (amount < MIN_WITHDRAWAL) {
      toast({
        title: "Minimum Withdrawal",
        description: `Minimum withdrawal amount is $${MIN_WITHDRAWAL}.00`,
        variant: "destructive"
      });
      return;
    }

    if (amount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough balance to withdraw this amount.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onWithdrawComplete(amount);
      toast({
        title: "Withdrawal Submitted!",
        description: `$${amount.toFixed(2)} withdrawal request has been submitted.`
      });
      
      setWithdrawAmount('');
      setWalletAddress('');
      onClose();
      
    } catch (error) {
      toast({
        title: "Withdrawal Failed",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-2 border-red-500 text-white max-w-md w-full mx-4 rounded-xl shadow-2xl [&>button]:hidden">
        <DialogHeader className="pb-4 border-b border-red-500/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 font-retro text-lg text-red-400">
              <ArrowUpRight className="w-5 h-5" />
              Withdraw Funds
            </DialogTitle>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors border-2 border-gray-600 hover:border-red-500"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
            </button>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
            <p className="text-gray-300 text-xs mb-2 font-retro">Available Balance</p>
            <p className="text-green-400 text-lg font-retro">${currentBalance.toFixed(2)}</p>
          </div>

          <div>
            <label className="text-red-400 font-retro text-xs mb-2 block">
              Withdrawal Amount (USD)
            </label>
            <Input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder={`Min $${MIN_WITHDRAWAL}.00`}
              min={MIN_WITHDRAWAL}
              max={currentBalance}
              step="0.01"
              className="px-3 py-2 bg-gray-800 border-2 border-gray-600 focus:border-red-500 text-white font-retro text-xs"
            />
          </div>

          <div>
            <label className="text-red-400 font-retro text-xs mb-2 block">
              Wallet Address
            </label>
            <Input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Enter your wallet address"
              className="px-3 py-2 bg-gray-800 border-2 border-gray-600 focus:border-red-500 text-white font-retro text-xs"
            />
          </div>

          <Button
            onClick={handleWithdraw}
            disabled={isProcessing || !withdrawAmount || !walletAddress}
            className="w-full bg-red-600 hover:bg-red-700 font-retro py-2 text-white rounded-lg border-2 border-red-500 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="font-retro">Processing...</span>
              </div>
            ) : (
              <span className="font-retro">Withdraw ${withdrawAmount || '0.00'}</span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}