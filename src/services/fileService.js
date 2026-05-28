import { API_BASE_URL, apiRequest } from './request';

export function resolveFileUrl(fileUrl = '') {
  if (!fileUrl) {
    return '';
  }

  if (/^https?:\/\//.test(fileUrl)) {
    return fileUrl;
  }

  return new URL(fileUrl, API_BASE_URL).toString();
}

export async function uploadFile({ file, module = 'common', businessId = '', fileType = 'document' } = {}) {
  if (!file) {
    throw new Error('请选择要上传的文件');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('module', module);
  formData.append('businessId', businessId);
  formData.append('fileType', fileType);

  const result = await apiRequest.upload('/api/files/upload', formData);
  return result.file;
}

export async function uploadFileMock(data = {}) {
  if (data.file) {
    return uploadFile(data);
  }

  throw new Error('文件上传已切换为真实 multipart，本地 API 服务未连接时请先运行 npm run server:dev');
}
