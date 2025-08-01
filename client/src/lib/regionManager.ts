export interface ServerRegion {
  id: string;
  name: string;
  endpoint: string;
  playerCount: number;
  maxPlayers: number;
  ping?: number;
}

export class RegionManager {
  private static regions: ServerRegion[] = [
    {
      id: 'us',
      name: 'US East',
      endpoint: import.meta.env.NODE_ENV === 'production' ? 'wss://us.snakearena.app' : 'ws://localhost:5000',
      playerCount: 0,
      maxPlayers: 50 // 10 rooms × 5 players each
    },
    {
      id: 'eu',
      name: 'Europe',
      endpoint: import.meta.env.NODE_ENV === 'production' ? 'wss://eu.snakearena.app' : 'ws://localhost:5000',
      playerCount: 0,
      maxPlayers: 50 // 10 rooms × 5 players each
    }
  ];

  public static detectRegionFromTimezone(): 'us' | 'eu' {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // European timezones
      const europeanTimezones = [
        'Europe/', 'GMT', 'UTC', 'WET', 'CET', 'EET',
        'Africa/Casablanca', 'Africa/Tunis', 'Africa/Cairo'
      ];

      // Check if timezone matches European patterns
      const isEuropean = europeanTimezones.some(tz => timezone.includes(tz));
      
      if (isEuropean) {
        return 'eu';
      }

      // Default to US for Americas and other regions
      return 'us';
    } catch (error) {
      console.warn('Could not detect timezone, defaulting to US:', error);
      return 'us';
    }
  }

  public static getRegions(): ServerRegion[] {
    return [...this.regions];
  }

  public static getRegion(regionId: string): ServerRegion | null {
    return this.regions.find(r => r.id === regionId) || null;
  }

  public static getBestRegion(): ServerRegion {
    const detectedRegion = this.detectRegionFromTimezone();
    const region = this.getRegion(detectedRegion);
    
    if (region && region.playerCount < region.maxPlayers) {
      return region;
    }

    // Find region with most capacity
    return this.regions.reduce((best, current) => {
      const bestCapacity = best.maxPlayers - best.playerCount;
      const currentCapacity = current.maxPlayers - current.playerCount;
      return currentCapacity > bestCapacity ? current : best;
    });
  }

  public static updateRegionPlayerCount(regionId: string, playerCount: number) {
    const region = this.regions.find(r => r.id === regionId);
    if (region) {
      region.playerCount = playerCount;
    }
  }

  public static getRegionEndpoint(regionId?: string): string {
    if (!regionId) {
      return this.getBestRegion().endpoint;
    }

    const region = this.getRegion(regionId);
    return region ? region.endpoint : this.getBestRegion().endpoint;
  }

  // For development, both regions point to the same server
  // In production, these would be different server instances
  public static getCurrentRegion(): 'us' | 'eu' {
    // In development, we can simulate different regions
    const forceRegion = import.meta.env.VITE_FORCE_REGION as 'us' | 'eu';
    if (forceRegion) {
      return forceRegion;
    }

    // Default to US for single server development
    return 'us';
  }

  public static async fetchRegions(): Promise<ServerRegion[]> {
    try {
      const response = await fetch('/api/regions');
      const data = await response.json();
      this.regions = data.regions || this.regions;
      return this.regions;
    } catch (error) {
      console.warn('Failed to fetch regions from server, using defaults:', error);
      return this.regions;
    }
  }

  public static async selectRegion(regionId: string): Promise<ServerRegion | null> {
    try {
      const response = await fetch('/api/regions/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ regionId })
      });
      
      const data = await response.json();
      return data.region || null;
    } catch (error) {
      console.error('Failed to select region:', error);
      return null;
    }
  }
}

export function getWebSocketUrl(regionId?: string): string {
  const region = regionId ? RegionManager.getRegion(regionId) : RegionManager.getBestRegion();
  const endpoint = region?.endpoint || RegionManager.getBestRegion().endpoint;
  
  // For development, use the current host
  if (import.meta.env.NODE_ENV === 'development' || import.meta.env.DEV) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }
  
  return `${endpoint}/ws`;
}