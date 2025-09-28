import express from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger();

/**
 * Simple validation middleware
 */
export function validateRequest(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // Basic validation - can be enhanced as needed
  if (!req.body) {
    res.status(400).json({ error: 'Request body is required' });
    return;
  }
  next();
}

/**
 * Validates that request contains valid latitude and longitude coordinates
 */
export const validateCoordinates = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const { latitude, longitude } = req.body;

  // Check if coordinates are provided
  if (latitude === undefined || longitude === undefined) {
    res.status(400).json({
      success: false,
      error: 'latitude and longitude are required',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  // Check if coordinates are numbers
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    res.status(400).json({
      success: false,
      error: 'latitude and longitude must be valid numbers',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  // Check coordinate ranges
  if (latitude < -90 || latitude > 90) {
    res.status(400).json({
      success: false,
      error: 'latitude must be between -90 and 90 degrees',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  if (longitude < -180 || longitude > 180) {
    res.status(400).json({
      success: false,
      error: 'longitude must be between -180 and 180 degrees',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  logger.debug('Coordinates validation passed', { latitude, longitude });
  next();
};

/**
 * Validates that request contains a valid address string
 */
export const validateAddress = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const { address } = req.body;

  if (!address) {
    res.status(400).json({
      success: false,
      error: 'address is required',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  if (typeof address !== 'string') {
    res.status(400).json({
      success: false,
      error: 'address must be a string',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  if (address.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'address cannot be empty',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  if (address.length > 500) {
    res.status(400).json({
      success: false,
      error: 'address is too long (maximum 500 characters)',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  logger.debug('Address validation passed', { addressLength: address.length });
  next();
};

/**
 * Validates batch request for multiple property analysis
 */
export const validateBatchRequest = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const { properties } = req.body;

  if (!properties) {
    res.status(400).json({
      success: false,
      error: 'properties array is required',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  if (!Array.isArray(properties)) {
    res.status(400).json({
      success: false,
      error: 'properties must be an array',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  if (properties.length === 0) {
    res.status(400).json({
      success: false,
      error: 'properties array cannot be empty',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  if (properties.length > 50) {
    res.status(400).json({
      success: false,
      error: 'maximum 50 properties allowed per batch request',
      metadata: {
        processingTime: 0,
        dataSourcesUsed: [],
        lastUpdated: new Date(),
        cacheHit: false
      }
    });
    return;
  }

  // Validate each property in the batch
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    
    if (typeof property !== 'object' || property === null) {
      res.status(400).json({
        success: false,
        error: `property at index ${i} must be an object`,
        metadata: {
          processingTime: 0,
          dataSourcesUsed: [],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });
      return;
    }

    const { latitude, longitude } = property;
    
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({
        success: false,
        error: `property at index ${i} must have valid latitude and longitude numbers`,
        metadata: {
          processingTime: 0,
          dataSourcesUsed: [],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });
      return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      res.status(400).json({
        success: false,
        error: `property at index ${i} has invalid coordinate ranges`,
        metadata: {
          processingTime: 0,
          dataSourcesUsed: [],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });
      return;
    }
  }

  logger.debug('Batch request validation passed', { propertyCount: properties.length });
  next();
};

/**
 * Error handling helper
 */
export function handleError(res: express.Response, error: any): void {
  console.error('API Error:', error);
  
  const statusCode = error.statusCode || error.status || 500;
  const message = error.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    timestamp: new Date()
  });
}