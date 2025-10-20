export const environment = {
  production: true,
  // Production API URL - using your VPS IP with HTTPS
  apiUrl: 'https://quiz-webserver.space',
  
  // WebSocket configuration
  wsUrl: 'wss://quiz-webserver.space',
  wsReconnectionDelay: 1000,  // Time to wait before attempting to reconnect (ms)
  wsReconnectionDelayMax: 5000,  // Maximum time to wait between reconnections (ms)
  wsTimeout: 20000,  // Connection timeout (ms)
  enableDevOverride: false ,
  // Production settings
  useMockData: false,  // Always use real API in production
  apiTimeout: 10000,   // 10 seconds timeout for API calls
  
  // Feature flags
  enableAnalytics: true,
  enableDebugLogging: false,
  enableWebSocket: true,  // Enable/disable WebSocket functionality
  
  // Security settings
  enableAOT: true,
  enableProdMode: true,
  
  // CORS settings
  corsEnabled: true
};
