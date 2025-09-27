import { Request as ExpressRequest } from 'express';

/**
 * Extended Request interface to include user authentication
 */
export interface AuthenticatedRequest extends ExpressRequest {
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
    permissions?: string[];
  };
}