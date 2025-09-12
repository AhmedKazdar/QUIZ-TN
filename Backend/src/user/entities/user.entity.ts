export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export class User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
