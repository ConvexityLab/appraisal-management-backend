export class VendorConnectionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VendorConnectionConfigurationError';
  }
}

export class VendorConnectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VendorConnectionValidationError';
  }
}

export class VendorConnectionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VendorConnectionConflictError';
  }
}

export class VendorConnectionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VendorConnectionNotFoundError';
  }
}