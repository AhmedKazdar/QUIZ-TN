export {};

declare module "expo-router" {
  interface RouteMap {
    "/otp-verification": {
      pathname: "/otp-verification";
      params?: { userData?: string };
    };
  }
}
