import type { Request } from 'express';

/**
 * "http://192.168.1.24:3000/api/v1": links made by the local storage driver must point at the
 * address the phone used to reach us, so they're built from the request.
 */
export const baseUrl = (req: Request) => `${req.protocol}://${req.get('host')}/api/v1`;
