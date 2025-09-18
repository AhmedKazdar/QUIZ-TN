// src/auth/types/request-with-user.interface.ts
import { Request as ExpressRequest } from 'express';
import { AuthUser } from './auth-user.interface';

// Extend Express's Request type with our user property
declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}

// Create a type that we can use in our controllers
export type RequestWithUser = ExpressRequest & {
  user: AuthUser;
};