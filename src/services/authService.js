import { AUTH_TOKEN_KEY, apiRequest } from './request';

export function getStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export async function getAuthProfile() {
  return apiRequest.get('/api/auth/me');
}

export async function getCurrentUser() {
  const result = await getAuthProfile();
  return result.user;
}

export async function login(data = {}) {
  const result = await apiRequest.post('/api/auth/login', data);
  setStoredToken(result.token);
  return result;
}

export async function logout() {
  const result = await apiRequest.post('/api/auth/logout', {});
  setStoredToken('');
  return result;
}

export async function refreshAuth() {
  return apiRequest.post('/api/auth/refresh', {});
}

export async function loginMock(data = {}) {
  return login(data);
}

export async function logoutMock() {
  return logout();
}

export async function refreshAuthMock() {
  return refreshAuth();
}
