// Region detection utilities for geographic server routing

export type Region = 'us' | 'eu';

// European countries for IP geolocation detection
const EU_COUNTRIES = [
  'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'PL', 'AT', 'SE', 'NO', 'DK', 'FI', 
  'IE', 'PT', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE', 
  'LU', 'MT', 'CY', 'GR', 'GB'
];

// Method 1: IP Geolocation Detection (Primary)
const detectUserRegionByIP = async (): Promise<Region> => {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      timeout: 3000, // 3 second timeout
    });
    
    if (!response.ok) {
      throw new Error('IP geolocation API failed');
    }
    
    const data = await response.json();
    console.log(`Detected country: ${data.country_code}`);
    
    return EU_COUNTRIES.includes(data.country_code) ? 'eu' : 'us';
  } catch (error) {
    console.warn('IP geolocation failed:', error);
    throw error;
  }
};

// Method 2: Timezone Detection (Backup)
const detectRegionByTimezone = (): Region => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log(`Detected timezone: ${timezone}`);
    
    // European timezones
    const isEuropeanTimezone = timezone.startsWith('Europe/') || 
                              timezone === 'GMT' || 
                              timezone === 'UTC' ||
                              timezone.includes('London') ||
                              timezone.includes('Berlin') ||
                              timezone.includes('Paris');
    
    return isEuropeanTimezone ? 'eu' : 'us';
  } catch (error) {
    console.warn('Timezone detection failed:', error);
    return 'us'; // Default fallback
  }
};

// Method 3: Combined Approach (Recommended)
export const detectBestRegion = async (): Promise<Region> => {
  try {
    console.log('Attempting IP geolocation detection...');
    const ipRegion = await detectUserRegionByIP();
    console.log(`IP geolocation result: ${ipRegion}`);
    return ipRegion;
  } catch {
    console.log('IP geolocation failed, falling back to timezone detection...');
    const timezoneRegion = detectRegionByTimezone();
    console.log(`Timezone detection result: ${timezoneRegion}`);
    return timezoneRegion;
  }
};

// Get stored user preference or detect automatically
export const getUserPreferredRegion = async (): Promise<Region> => {
  // Check if user has manually selected a region before
  const storedRegion = localStorage.getItem('preferred-region') as Region;
  
  if (storedRegion && (storedRegion === 'us' || storedRegion === 'eu')) {
    console.log(`Using stored region preference: ${storedRegion}`);
    return storedRegion;
  }
  
  // Auto-detect if no preference stored
  const detectedRegion = await detectBestRegion();
  console.log(`Auto-detected region: ${detectedRegion}`);
  return detectedRegion;
};

// Store user's manual region selection
export const setUserRegionPreference = (region: Region): void => {
  localStorage.setItem('preferred-region', region);
  console.log(`Stored region preference: ${region}`);
};

// Clear stored preference (for auto-detect)
export const clearRegionPreference = (): void => {
  localStorage.removeItem('preferred-region');
  console.log('Cleared region preference - will auto-detect');
};