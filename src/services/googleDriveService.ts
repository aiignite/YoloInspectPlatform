import { getGoogleAccessToken } from './googleDriveAuth';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  isFolder: boolean;
}

export interface DriveStorageQuota {
  limit?: string; // total storage in bytes
  usage?: string; // used storage in bytes
  usageInDrive?: string;
  usageInDriveTrash?: string;
  userName?: string;
  userEmail?: string;
  userPhoto?: string;
}

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

function getAuthHeader(): HeadersInit {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error('未检测到有效的 Google Drive 访问授权，请先登录 Google 账号');
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Fetch Drive Storage Quota and User Info
 */
export async function getDriveAbout(): Promise<DriveStorageQuota> {
  const res = await fetch(`${DRIVE_API_BASE}/about?fields=storageQuota,user`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `获取 Google Drive 存储配额失败: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    limit: data.storageQuota?.limit,
    usage: data.storageQuota?.usage,
    usageInDrive: data.storageQuota?.usageInDrive,
    usageInDriveTrash: data.storageQuota?.usageInDriveTrash,
    userName: data.user?.displayName,
    userEmail: data.user?.emailAddress,
    userPhoto: data.user?.photoLink,
  };
}

/**
 * List files and folders inside a given parent folder
 */
export async function listDriveFiles(options: {
  folderId?: string;
  queryText?: string;
  pageSize?: number;
}): Promise<DriveFileItem[]> {
  const { folderId = 'root', queryText, pageSize = 50 } = options;

  let q = `'${folderId}' in parents and trashed = false`;
  if (queryText && queryText.trim()) {
    const cleanQuery = queryText.trim().replace(/'/g, "\\'");
    q += ` and name contains '${cleanQuery}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: String(pageSize),
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,iconLink,thumbnailLink,parents)',
    orderBy: 'folder,modifiedTime desc',
  });

  const res = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`, {
    headers: getAuthHeader(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `加载文件列表失败: ${res.statusText}`);
  }

  const data = await res.json();
  const rawFiles = data.files || [];

  return rawFiles.map((file: any) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
    webContentLink: file.webContentLink,
    iconLink: file.iconLink,
    thumbnailLink: file.thumbnailLink,
    parents: file.parents,
    isFolder: file.mimeType === 'application/vnd.google-apps.folder',
  }));
}

/**
 * Create a new folder in Google Drive
 */
export async function createDriveFolder(name: string, parentFolderId = 'root'): Promise<DriveFileItem> {
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId],
  };

  const res = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `创建文件夹失败: ${res.statusText}`);
  }

  const file = await res.json();
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    isFolder: true,
  };
}

/**
 * Upload a binary/blob file using multipart upload
 */
export async function uploadFileToDrive(
  file: File | Blob,
  fileName: string,
  parentFolderId = 'root',
  mimeType = 'application/octet-stream'
): Promise<DriveFileItem> {
  const metadata = {
    name: fileName,
    parents: [parentFolderId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const mediaHeader = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

  const fileArrayBuffer = await file.arrayBuffer();

  const multipartBlob = new Blob([
    metadataPart,
    mediaHeader,
    new Uint8Array(fileArrayBuffer),
    closeDelimiter,
  ], { type: `multipart/related; boundary=${boundary}` });

  const res = await fetch(`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBlob,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `文件上传至 Google Drive 失败: ${res.statusText}`);
  }

  const uploaded = await res.json();
  return {
    id: uploaded.id,
    name: uploaded.name,
    mimeType: uploaded.mimeType,
    size: uploaded.size,
    webViewLink: uploaded.webViewLink,
    isFolder: false,
  };
}

/**
 * Upload JSON quality audit report directly
 */
export async function uploadJsonToDrive(
  fileName: string,
  jsonData: Record<string, unknown>,
  parentFolderId = 'root'
): Promise<DriveFileItem> {
  const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], {
    type: 'application/json',
  });
  return uploadFileToDrive(jsonBlob, fileName, parentFolderId, 'application/json');
}

/**
 * Permanently delete a file or folder from Google Drive
 * CAUTION: Caller MUST ensure user confirmed this in the UI!
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `删除文件失败: ${res.statusText}`);
  }
}
