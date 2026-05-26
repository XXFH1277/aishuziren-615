import { productCategories, productStatuses, products as mockProducts } from '../mock/products';
import { productGroupTypes, productGroups as mockProductGroups } from '../mock/productGroups';
import { apiRequest } from './request';

export async function getProducts(params = {}) {
  return apiRequest.get('/api/products', params);
}

export async function getProductById(id) {
  const data = await apiRequest.get(`/api/products/${id}`);
  return data.product;
}

export async function createProduct(data) {
  const result = await apiRequest.post('/api/products', data);
  return result.product;
}

export async function updateProduct(id, data) {
  const result = await apiRequest.put(`/api/products/${id}`, data);
  return result.product;
}

export async function updateProductStatus(id, status) {
  const result = await apiRequest.patch(`/api/products/${id}/status`, { status });
  return result.product;
}

export function getProductCategories() {
  return productCategories;
}

export function getProductStatuses() {
  return productStatuses;
}

export async function getProductGroups(params = {}) {
  return apiRequest.get('/api/product-groups', params);
}

export async function createProductGroup(data) {
  const result = await apiRequest.post('/api/product-groups', data);
  return result.productGroup;
}

export function getProductGroupTypes() {
  return productGroupTypes;
}

export function getMockProducts() {
  return mockProducts;
}

export function getMockProductGroups() {
  return mockProductGroups;
}
