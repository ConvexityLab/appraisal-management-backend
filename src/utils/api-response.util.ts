import { ApiError } from '../types/index.js';

/**
 * Utility functions for creating standardized API responses and errors
 */

/**
 * Creates a standardized API response object
 */
export function createApiResponse<T>(data: T, message: string = 'Success'): { success: boolean; data: T; message: string; timestamp: Date } {
  return {
    success: true,
    data,
    message,
    timestamp: new Date()
  };
}

/**
 * Creates a properly formatted ApiError object
 */
export function createApiError(code: string, message: string, details?: Record<string, any>): ApiError {
  const error: ApiError = {
    code,
    message,
    timestamp: new Date()
  };
  
  if (details) {
    error.details = details;
  }
  
  return error;
}

/**
 * Common error codes for consistency across services
 */
export const ErrorCodes = {
  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Connection/Database errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONTAINER_NOT_READY: 'CONTAINER_NOT_READY',
  
  // Entity not found errors
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  VENDOR_NOT_FOUND: 'VENDOR_NOT_FOUND',
  PROPERTY_NOT_FOUND: 'PROPERTY_NOT_FOUND',
  PROPERTY_DETAILS_NOT_FOUND: 'PROPERTY_DETAILS_NOT_FOUND',
  
  // Operation failed errors
  ORDER_CREATE_FAILED: 'ORDER_CREATE_FAILED',
  ORDER_UPDATE_FAILED: 'ORDER_UPDATE_FAILED',
  ORDER_DELETE_FAILED: 'ORDER_DELETE_FAILED',
  ORDER_RETRIEVE_FAILED: 'ORDER_RETRIEVE_FAILED',
  ORDER_SEARCH_FAILED: 'ORDER_SEARCH_FAILED',
  
  VENDOR_CREATE_FAILED: 'VENDOR_CREATE_FAILED',
  VENDOR_UPDATE_FAILED: 'VENDOR_UPDATE_FAILED',
  VENDOR_DELETE_FAILED: 'VENDOR_DELETE_FAILED',
  VENDOR_RETRIEVE_FAILED: 'VENDOR_RETRIEVE_FAILED',
  VENDOR_SEARCH_FAILED: 'VENDOR_SEARCH_FAILED',
  
  PROPERTY_CREATE_FAILED: 'PROPERTY_CREATE_FAILED',
  PROPERTY_UPDATE_FAILED: 'PROPERTY_UPDATE_FAILED',
  PROPERTY_DELETE_FAILED: 'PROPERTY_DELETE_FAILED',
  PROPERTY_RETRIEVE_FAILED: 'PROPERTY_RETRIEVE_FAILED',
  PROPERTY_SEARCH_FAILED: 'PROPERTY_SEARCH_FAILED',
  
  // Service specific errors
  SERVICE_NOT_READY: 'SERVICE_NOT_READY',
  HEALTH_CHECK_FAILED: 'HEALTH_CHECK_FAILED',
  STATS_FAILED: 'STATS_FAILED'
} as const;

/**
 * Helper function to convert unknown errors to ApiError
 */
export function convertToApiError(error: unknown, defaultCode: string = ErrorCodes.UNKNOWN_ERROR): ApiError {
  if (error instanceof Error) {
    return createApiError(defaultCode, error.message);
  }
  
  if (typeof error === 'string') {
    return createApiError(defaultCode, error);
  }
  
  return createApiError(defaultCode, 'An unknown error occurred');
}