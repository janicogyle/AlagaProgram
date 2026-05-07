// Global error handler utilities
export class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
export class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400);
    this.field = field;
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export function handleApiError(error) {
  console.error('API Error:', error);
  
  // Handle network/connection errors
  if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
    return { success: false, error: 'Network error. Please check your connection.', statusCode: 503 };
  }
  
  // Handle timeout errors
  if (error.name === 'AbortError') {
    return { success: false, error: 'Request timed out. Please try again.', statusCode: 408 };
  }

  // Handle custom AppError types
  if (error instanceof AppError) {
    return { success: false, error: error.message, statusCode: error.statusCode };
  }
  
  // Handle validation errors
  if (error.name === 'ValidationError' || error.message?.includes('required')) {
    return { success: false, error: error.message || 'Validation failed.', statusCode: 400 };
  }
  
  if (error.message?.includes('already exists')) {
    return { success: false, error: 'This record already exists.', statusCode: 409 };
  }
  
  if (error.message?.includes('not found')) {
    return { success: false, error: 'Record not found.', statusCode: 404 };
  }
  
  if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
    return { success: false, error: 'You do not have permission to perform this action.', statusCode: 403 };
  }
  
  if (error.code === '23505') { // PostgreSQL unique violation
    return { success: false, error: 'A record with this information already exists.', statusCode: 409 };
  }
  
  if (error.code === '23503') { // PostgreSQL foreign key violation
    return { success: false, error: 'Cannot delete: record is referenced by other data.', statusCode: 409 };
  }

  if (error.code === '23502') { // PostgreSQL not null violation
    return { success: false, error: 'Required field is missing.', statusCode: 400 };
  }

  if (error.code === 'PGRST116') { // PostgREST no rows returned
    return { success: false, error: 'Record not found.', statusCode: 404 };
  }
  
  return { success: false, error: error.message || 'An unexpected error occurred.', statusCode: 500 };
}

export function showUserError(error) {
  const message = typeof error === 'string' ? error : error?.message || 'An error occurred';
  
  if (typeof window !== 'undefined') {
    // Create a toast/alert notification
    alert(message);
  }
  
  return message;
}

export async function handleAsyncOperation(operation, loadingStateSetter, errorStateSetter) {
  try {
    if (loadingStateSetter) loadingStateSetter(true);
    if (errorStateSetter) errorStateSetter(null); // Clear previous errors
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    const errorInfo = handleApiError(error);
    if (errorStateSetter) errorStateSetter(errorInfo.error);
    console.error('Operation error:', error);
    return { success: false, error: errorInfo.error, statusCode: errorInfo.statusCode };
  } finally {
    if (loadingStateSetter) loadingStateSetter(false);
  }
}

// Utility to safely parse JSON responses
export async function safeJsonParse(response) {
  try {
    return await response.json();
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    return { error: 'Invalid response from server' };
  }
}

// Utility for fetch with timeout
export async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
