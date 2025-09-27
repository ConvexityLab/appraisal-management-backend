import express from 'express';

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