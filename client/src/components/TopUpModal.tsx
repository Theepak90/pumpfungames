import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Copy, CheckCircle, DollarSign, ArrowLeft, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';

// Crypto icon component using real logos from the web with reliable fallbacks
const CryptoIcon = ({ type, size = 16 }: { type: string; size?: number }) => {
  const [imageError, setImageError] = React.useState(false);
  
  const logoUrls = {
    SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  };

  const logoUrl = logoUrls[type as keyof typeof logoUrls];

  // If image failed to load or no URL, show gradient fallback
  if (!logoUrl || imageError) {
    const gradients = {
      SOL: 'from-purple-500 to-blue-500',
      ETH: 'from-blue-400 to-blue-600'
    };
    
    return (
      <div 
        className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br ${gradients[type as keyof typeof gradients] || 'from-gray-500 to-gray-600'}`}
        style={{ width: size, height: size }}
      >
        <span className="text-white font-bold" style={{ fontSize: size * 0.3 }}>
          {type}
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${type} logo`}
      width={size}
      height={size}
      className="rounded-full"
      style={{ objectFit: 'contain' }}
      onError={() => setImageError(true)}
    />
  );
};

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  onTopUpComplete: (amount: number) => void;
}

export default function TopUpModal({ isOpen, onClose, currentBalance, onTopUpComplete }: TopUpModalProps) {
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [step, setStep] = useState<'amount' | 'payment'>('amount');
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Payment wallet addresses
  const WALLETS = {
    SOL: '3XVzfnAsvCPjTm4LJKaVWJVMWMYAbNRra3twrzBaokJv',
    ETH: '0x19574FF4c4b0eE2785DbBE57944C498f33377078'
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${type} address copied to clipboard`,
    });
  };

  const handleAmountSubmit = () => {
    const amount = parseFloat(topUpAmount);
    
    if (!topUpAmount || isNaN(amount)) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        variant: "destructive"
      });
      return;
    }

    if (amount < 1) {
      toast({
        title: "Minimum Amount",
        description: "Minimum top-up amount is $1.00",
        variant: "destructive"
      });
      return;
    }

    if (amount > 1000) {
      toast({
        title: "Maximum Amount",
        description: "Maximum top-up amount is $1,000.00",
        variant: "destructive"
      });
      return;
    }

    setStep('payment');
  };

  const handlePaymentConfirm = async () => {
    const amount = parseFloat(topUpAmount);
    setIsVerifying(true);
    
    try {
      toast({
        title: "Verifying Payment...",
        description: "Checking blockchain for your transaction",
      });

      // Call backend to verify payment
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          walletAddresses: WALLETS,
          userId: user?.id, // You'll need to get current user
        }),
      });

      const result = await response.json();

      if (result.verified) {
        // Payment verified - credit the user
        onTopUpComplete(amount);
        toast({
          title: "Payment Verified! 🎉",
          description: `$${amount.toFixed(2)} added to your balance. TX: ${result.transactionHash?.slice(0, 8)}...`,
        });
        setTopUpAmount('');
        setStep('amount');
        onClose();
      } else {
        toast({
          title: "Payment Not Found",
          description: "No payment detected yet. Please wait a few minutes for blockchain confirmation.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Payment verification failed:', error);
      toast({
        title: "Verification Failed",
        description: "Unable to verify payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const resetModal = () => {
    setStep('amount');
    setTopUpAmount('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-2 border-green-500 text-white max-w-md w-full mx-4 rounded-xl shadow-2xl [&>button]:hidden">
        <DialogHeader className="pb-4 border-b border-green-500/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 font-retro text-lg text-green-400">
              {step === 'payment' && (
                <button
                  onClick={() => setStep('amount')}
                  className="p-1 hover:bg-gray-800 rounded-lg transition-colors border border-gray-600 hover:border-green-500 mr-2"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-400 hover:text-green-400" />
                </button>
              )}
              <DollarSign className="w-5 h-5" />
              {step === 'amount' ? 'Top Up Balance' : 'Payment Instructions'}
            </DialogTitle>
            <button 
              onClick={handleClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors border-2 border-gray-600 hover:border-green-500"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-green-400" />
            </button>
          </div>
        </DialogHeader>

        {step === 'amount' ? (
          <div className="space-y-4 pt-2">
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
              <p className="text-gray-300 text-xs mb-2 font-retro">Current Balance</p>
              <p className="text-green-400 text-lg font-retro">${currentBalance.toFixed(2)}</p>
            </div>

            <div>
              <label className="text-green-400 font-retro text-xs mb-2 block">
                Top-Up Amount (USD)
              </label>
              <Input
                type="number"
                placeholder="Enter amount..."
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="px-3 py-2 bg-gray-800 border-2 border-gray-600 focus:border-green-500 text-white font-retro text-xs"
                min="1"
                max="1000"
                step="0.01"
              />
              <p className="text-gray-500 font-retro text-xs mt-1">
                Min: $1.00 • Max: $1,000.00
              </p>
            </div>

            <Button
              onClick={handleAmountSubmit}
              disabled={!topUpAmount}
              className="w-full bg-green-600 hover:bg-green-700 font-retro py-2 text-white rounded-lg border-2 border-green-500 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-retro">Continue to Payment</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-600 text-center">
              <p className="text-gray-300 text-xs mb-1 font-retro">Amount to Pay</p>
              <p className="text-green-400 text-xl font-retro">${parseFloat(topUpAmount).toFixed(2)}</p>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {Object.entries(WALLETS).map(([currency, address]) => (
                <div key={currency} className="bg-gray-800 rounded-lg p-3 border border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CryptoIcon type={currency} size={16} />
                                                    <h3 className="font-retro text-xs text-white">
                                {currency === 'SOL' && 'Solana (SOL)'}
                                {currency === 'ETH' && 'Ethereum (ETH)'}
                              </h3>
                    </div>
                    <Button
                      onClick={() => copyToClipboard(address, currency)}
                      className="bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-green-500 font-retro text-xs px-2 py-1 h-auto"
                    >
                      <Copy size={12} className="mr-1" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 font-mono break-all bg-gray-900 p-2 rounded border border-gray-700">
                    {address}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-yellow-900/30 border-2 border-yellow-600/50 rounded-lg p-3">
              <h4 className="text-yellow-400 font-retro text-xs mb-2">📋 Instructions:</h4>
                                    <ul className="text-yellow-200 font-retro text-xs space-y-1">
                        <li>• Send <strong>${parseFloat(topUpAmount).toFixed(2)}</strong> USD equivalent</li>
                        <li>• Choose either Solana (SOL) or Ethereum (ETH)</li>
                        <li>• Copy the wallet address for your chosen crypto</li>
                        <li>• Send from your crypto wallet</li>
                        <li>• Click "I Have Paid" when transaction is complete</li>
                      </ul>
            </div>

            <Button
              onClick={handlePaymentConfirm}
              disabled={isVerifying}
              className="w-full bg-green-600 hover:bg-green-700 font-retro py-2 text-white rounded-lg border-2 border-green-500 text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="font-retro">Verifying Payment...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={14} />
                  <span className="font-retro">I Have Paid</span>
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}