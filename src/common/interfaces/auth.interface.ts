import { Request } from 'express';

export interface JwtPayload {
  email: string;
  sub: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin: boolean;
  isConfirmed?: boolean;
  name?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface UserRegistrationResponse {
  message: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
    isConfirmed: boolean;
  };
}

export interface UserPresenceInfo {
  id: string;
  email: string;
  name: string;
  isOnline: boolean;
  lastSeen?: Date;
}

export interface AdminUser extends AuthenticatedUser {
  isAdmin: true;
}

// For service methods that require admin privileges
export interface ServiceContext {
  currentUser: AuthenticatedUser;
}

// For pagination and filtering
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  isActive?: boolean;
}
