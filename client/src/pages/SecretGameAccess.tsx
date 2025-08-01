import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, AlertCircle } from 'lucide-react';

export default function SecretGameAccess() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();

  const correctPassword = 'secretserveradd119988';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === correctPassword) {
      // Store access token in sessionStorage for this session
      sessionStorage.setItem('gameAccess', 'granted');
      setLocation('/game');
    } else {
      setError('Incorrect password. Access denied.');
      setPassword('');
    }
  };

  const goHome = () => {
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800/90 backdrop-blur-sm border-gray-700">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl text-white">Restricted Access</CardTitle>
          <CardDescription className="text-gray-300">
            Enter the password to access the game
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                autoFocus
              />
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                type="submit" 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!password.trim()}
              >
                Access Game
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={goHome}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Back
              </Button>
            </div>
          </form>
          
          <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-700">
            Authorized personnel only
          </div>
        </CardContent>
      </Card>
    </div>
  );
}