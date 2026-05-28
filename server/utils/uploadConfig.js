import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadRoot = path.resolve(__dirname, '..', 'uploads');
export const uploadPublicPrefix = '/uploads';
export const maxUploadSize = 5 * 1024 * 1024;

export const allowedMimeTypes = new Map([
  ['image/png', { extension: '.png', fileType: 'image' }],
  ['image/jpeg', { extension: '.jpg', fileType: 'image' }],
  ['image/webp', { extension: '.webp', fileType: 'image' }],
  ['image/gif', { extension: '.gif', fileType: 'image' }],
  ['application/pdf', { extension: '.pdf', fileType: 'document' }],
  ['text/plain', { extension: '.txt', fileType: 'document' }],
]);
