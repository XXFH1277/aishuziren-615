import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadRoot = path.resolve(__dirname, '..', 'uploads');
export const uploadPublicPrefix = '/uploads';
export const maxUploadSize = 5 * 1024 * 1024;
export const allowedUploadDescription = 'PNG、JPG、WEBP、GIF、PDF、TXT、MP4、WEBM、MOV、MP3、WAV、M4A、AAC';

export const allowedMimeTypes = new Map([
  ['image/png', { extension: '.png', fileType: 'image' }],
  ['image/jpeg', { extension: '.jpg', fileType: 'image' }],
  ['image/webp', { extension: '.webp', fileType: 'image' }],
  ['image/gif', { extension: '.gif', fileType: 'image' }],
  ['application/pdf', { extension: '.pdf', fileType: 'document' }],
  ['text/plain', { extension: '.txt', fileType: 'document' }],
  ['video/mp4', { extension: '.mp4', fileType: 'video' }],
  ['video/webm', { extension: '.webm', fileType: 'video' }],
  ['video/quicktime', { extension: '.mov', fileType: 'video' }],
  ['audio/mpeg', { extension: '.mp3', fileType: 'audio' }],
  ['audio/mp4', { extension: '.m4a', fileType: 'audio' }],
  ['audio/aac', { extension: '.aac', fileType: 'audio' }],
  ['audio/wav', { extension: '.wav', fileType: 'audio' }],
  ['audio/x-wav', { extension: '.wav', fileType: 'audio' }],
  ['audio/webm', { extension: '.webm', fileType: 'audio' }],
  ['audio/x-m4a', { extension: '.m4a', fileType: 'audio' }],
]);
