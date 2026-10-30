import { createHash, randomInt } from 'crypto';

export const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export const generateCode = () => randomInt(100000, 1000000).toString();