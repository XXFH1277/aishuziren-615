import { apiRequest } from './request';

export async function uploadFileMock(data = {}) {
  const result = await apiRequest.post('/api/files/upload', data);
  return result.file;
}
