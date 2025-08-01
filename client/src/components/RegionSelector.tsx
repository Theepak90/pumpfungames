import { useState, useEffect } from 'react';
import { RegionManager, type ServerRegion } from '@/lib/regionManager';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Globe, Users, Wifi } from 'lucide-react';

interface RegionSelectorProps {
  selectedRegion: string | null;
  onRegionChange: (regionId: string) => void;
  className?: string;
}

export function RegionSelector({ selectedRegion, onRegionChange, className = '' }: RegionSelectorProps) {
  const [regions, setRegions] = useState<ServerRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoDetectedRegion, setAutoDetectedRegion] = useState<string>('');

  useEffect(() => {
    const loadRegions = async () => {
      setLoading(true);
      try {
        const fetchedRegions = await RegionManager.fetchRegions();
        setRegions(fetchedRegions);
        
        // Auto-detect region
        const detected = RegionManager.detectRegionFromTimezone();
        setAutoDetectedRegion(detected);
        
        // If no region selected, use auto-detected
        if (!selectedRegion) {
          onRegionChange(detected);
        }
      } catch (error) {
        console.error('Failed to load regions:', error);
        setRegions(RegionManager.getRegions());
      } finally {
        setLoading(false);
      }
    };

    loadRegions();
  }, [selectedRegion, onRegionChange]);

  const getRegionStatus = (region: ServerRegion) => {
    const capacity = region.maxPlayers - region.playerCount;
    if (capacity > 30) return { label: 'Online', color: 'bg-green-500' };
    if (capacity > 10) return { label: 'Busy', color: 'bg-yellow-500' };
    if (capacity > 0) return { label: 'Full', color: 'bg-red-500' };
    return { label: 'Offline', color: 'bg-gray-500' };
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Wifi className="h-4 w-4 animate-pulse" />
        <span className="text-sm text-muted-foreground">Detecting region...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe className="h-4 w-4" />
        <span>Select your region for better connection</span>
      </div>

      <Select value={selectedRegion || autoDetectedRegion} onValueChange={onRegionChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose region" />
        </SelectTrigger>
        <SelectContent>
          {regions.map((region) => {
            const status = getRegionStatus(region);
            const isAutoDetected = region.id === autoDetectedRegion;
            
            return (
              <SelectItem key={region.id} value={region.id}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                    <span>{region.name}</span>
                    {isAutoDetected && (
                      <Badge variant="secondary" className="text-xs">
                        Auto
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{region.playerCount}/{region.maxPlayers}</span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {selectedRegion && (
        <div className="space-y-2">
          {regions
            .filter(r => r.id === selectedRegion)
            .map(region => {
              const status = getRegionStatus(region);
              return (
                <div key={region.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${status.color}`} />
                    <div>
                      <div className="font-medium">{region.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {region.playerCount} players online
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline">{status.label}</Badge>
                </div>
              );
            })}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        <p>• Auto-detected: {regions.find(r => r.id === autoDetectedRegion)?.name}</p>
        <p>• Max 5 players per game room</p>
        <p>• Real-time multiplayer synchronization</p>
      </div>
    </div>
  );
}