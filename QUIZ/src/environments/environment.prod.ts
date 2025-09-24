export const environment = {
  production: true,
  // Production API URL - using your VPS IP with HTTPS
  apiUrl: 'https://quiz-webserver.space',
  
  // Production settings
  useMockData: false,  // Always use real API in production
  apiTimeout: 10000,   // 10 seconds timeout for API calls
  
  // Feature flags
  enableAnalytics: true,
  enableDebugLogging: false,
  
  // Security settings
  enableAOT: true,
  enableProdMode: true,
  
  // CORS settings
  corsEnabled: true
};
