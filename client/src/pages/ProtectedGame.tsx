import { useEffect } from 'react';
import { useLocation } from 'wouter';
import GamePage from './game';

export default function ProtectedGame() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check if user has access token from password entry
    const hasAccess = sessionStorage.getItem('gameAccess') === 'granted';
    
    if (!hasAccess) {
      // Redirect to secret access page if no valid access
      setLocation('/game8999');
      return;
    }
  }, [setLocation]);

  // If we reach here, user has valid access
  const hasAccess = sessionStorage.getItem('gameAccess') === 'granted';
  
  if (!hasAccess) {
    return null; // Don't render anything while redirecting
  }

  return <GamePage />;
}