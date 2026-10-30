export class ApiError extends Error { constructor(message: string, public readonly code: 'NOT_FOUND' | 'ACCESS_DENIED' | 'STORAGE_ERROR') { super(message); this.name = 'ApiError'; } }
