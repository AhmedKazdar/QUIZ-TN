// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // Development API URL - points to the local backend server
  apiUrl: 'http://localhost:3001',
  
  // Development settings
  useMockData: true,  // Set to false to use real API in development
  apiTimeout: 10000,  // 10 seconds timeout for API calls
  
  // Feature flags
  enableAnalytics: false,
  enableDebugLogging: true
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
