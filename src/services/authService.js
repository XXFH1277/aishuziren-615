import { apiRequest } from './request';

export async function getCurrentUser() {
  const result = await apiRequest.get('/api/auth/me');
  return result.user;
}

export async function loginMock(data = {}) {
  return apiRequest.post('/api/auth/login', data);
}

export async function logoutMock() {
  return apiRequest.post('/api/auth/logout', {});
}

export async function refreshAuthMock() {
  return apiRequest.post('/api/auth/refresh', {});
}
