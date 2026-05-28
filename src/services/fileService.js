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

export function toFileAsset(uploadItem = {}) {
  const file = uploadItem.response?.file || uploadItem.file || uploadItem;

  if (!file || typeof file === 'string') {
    return null;
  }

  return {
    fileId: file.fileId || file.id || uploadItem.uid,
    fileName: file.fileName || file.name || uploadItem.name,
    fileUrl: file.fileUrl || file.url || uploadItem.url,
    fileType: file.fileType || uploadItem.fileType,
    size: file.size || uploadItem.size,
    mimeType: file.mimeType || uploadItem.type,
    uploadedAt: file.uploadedAt || uploadItem.uploadedAt,
  };
}

export async function uploadAvatarAsset(file, meta = {}) {
  return uploadFile({
    file,
    module: 'avatar',
    businessId: meta.businessId || '',
    fileType: meta.fileType || 'image',
  });
}

export async function uploadAvatarAuthorization(file, meta = {}) {
  return uploadFile({
    file,
    module: 'avatar_authorization',
    businessId: meta.businessId || '',
    fileType: meta.fileType || 'document',
  });
}

export async function uploadSystemLogo(file) {
  return uploadFile({
    file,
    module: 'settings',
    businessId: 'basic',
    fileType: 'logo',
  });
}

export async function uploadFileMock(data = {}) {
  if (data.file) {
    return uploadFile(data);
  }

  throw new Error('文件上传已切换为真实 multipart，本地 API 服务未连接时请先运行 npm run server:dev');
}
