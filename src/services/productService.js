import { productCategories, productStatuses, products } from '../mock/products';
import { productGroupTypes, productGroups } from '../mock/productGroups';

export function getProducts() {
  return products;
}

export function getProductById(id) {
  return products.find((item) => item.id === id);
}

export function getProductCategories() {
  return productCategories;
}

export function getProductStatuses() {
  return productStatuses;
}

export function getProductGroups() {
  return productGroups;
}

export function getProductGroupTypes() {
  return productGroupTypes;
}
