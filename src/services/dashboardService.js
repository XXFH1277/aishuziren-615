import { apiRequest } from './request';

export async function getDashboardOverview() {
  const result = await apiRequest.get('/api/dashboard/overview');
  return result.overview;
}
