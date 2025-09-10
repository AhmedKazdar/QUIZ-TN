export interface JwtPayload {
  username: string;
  sub: string; // Typically, this would be the user ID or another unique identifier
}
