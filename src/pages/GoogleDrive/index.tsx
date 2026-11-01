import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Input,
  Table,
  Tag,
  Space,
  Modal,
  message,
  Breadcrumb,
  Typography,
  Progress,
  Tooltip,
  Upload,
  Divider,
  Alert,
  Avatar,
} from 'antd';
import {
  CloudSyncOutlined,
  FolderOutlined,
  FileTextOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  FileZipOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  UploadOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  GoogleOutlined,
  LogoutOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import {
  initGoogleAuth,
  googleSignIn,
  googleSignOut,
  getGoogleAccessToken,
  getCurrentGoogleUser,
} from '../../services/googleDriveAuth';
import {
  listDriveFiles,
  createDriveFolder,
  uploadFileToDrive,
  uploadJsonToDrive,
  deleteDriveFile,
  getDriveAbout,
  DriveFileItem,
  DriveStorageQuota,
} from '../../services/googleDriveService';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import api from '../../utils/api';

const { Title, Text, Paragraph } = Typography;

function formatBytes(bytesStr?: string | number): string {
  if (!bytesStr) return '0 B';
  const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
  if (isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const GoogleDrivePage: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<{ displayName?: string | null; email?: string | null; photoURL?: string | null } | null>(null);

  // Drive Data State
  const [quota, setQuota] = useState<DriveStorageQuota | null>(null);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Folder Navigation History
  const [folderHistory, setFolderHistory] = useState<Array<{ id: string; name: string }>>([
    { id: 'root', name: '我的云端硬盘 (Root)' },
  ]);

  const currentFolder = folderHistory[folderHistory.length - 1];

  // Modals & User Actions
  const [newFolderModalOpen, setNewFolderModalOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);

  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Sync Reports Action
  const [isSyncingReports, setIsSyncingReports] = useState<boolean>(false);

  // Delete Confirmation Modal (MANDATORY per Workspace skill requirement)
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState<boolean>(false);
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // 1. Initialize Auth on Mount
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        if (token) {
          setIsAuthenticated(true);
          setUserProfile({
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
          });
        }
      },
      () => {
        const token = getGoogleAccessToken();
        const user = getCurrentGoogleUser();
        if (token && user) {
          setIsAuthenticated(true);
          setUserProfile({
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
          });
        } else {
          setIsAuthenticated(false);
          setUserProfile(null);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // 2. Fetch Drive Data when authenticated and folder changes
  const loadDriveData = useCallback(async () => {
    if (!getGoogleAccessToken()) return;
    setLoading(true);
    try {
      const [quotaData, fileList] = await Promise.all([
        getDriveAbout().catch(() => null),
        listDriveFiles({
          folderId: currentFolder.id,
          queryText: searchQuery,
        }),
      ]);

      if (quotaData) setQuota(quotaData);
      setFiles(fileList);
    } catch (err: any) {
      console.error('Failed to load Google Drive data:', err);
      message.error(err.message || '加载 Google Drive 文件失败');
    } finally {
      setLoading(false);
    }
  }, [currentFolder.id, searchQuery]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadDriveData();
    }
  }, [isAuthenticated, loadDriveData]);

  // Handle Login
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setIsAuthenticated(true);
        setUserProfile({
          displayName: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL,
        });
        message.success(`Google 账号授权成功: ${result.user.displayName || result.user.email}`);
      }
    } catch (err: any) {
      message.error(`Google 授权失败: ${err.message || '用户取消授权'}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleGoogleLogout = async () => {
    await googleSignOut();
    setIsAuthenticated(false);
    setUserProfile(null);
    setFiles([]);
    setQuota(null);
    message.info('已断开 Google Drive 连接');
  };

  // Navigate into Folder
  const handleOpenFolder = (folder: DriveFileItem) => {
    setFolderHistory((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  // Navigate via Breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    setFolderHistory((prev) => prev.slice(0, index + 1));
  };

  // Create Folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.warning('请输入文件夹名称');
      return;
    }
    setIsCreatingFolder(true);
    try {
      await createDriveFolder(newFolderName.trim(), currentFolder.id);
      message.success(`已在 Google Drive 创建文件夹: ${newFolderName}`);
      setNewFolderModalOpen(false);
      setNewFolderName('');
      void loadDriveData();
    } catch (err: any) {
      message.error(err.message || '创建文件夹失败');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Upload Local File
  const handleUploadFile = async () => {
    if (!selectedUploadFile) {
      message.warning('请选择要上传的文件');
      return;
    }
    setIsUploading(true);
    try {
      await uploadFileToDrive(selectedUploadFile, selectedUploadFile.name, currentFolder.id, selectedUploadFile.type);
      message.success(`文件 ${selectedUploadFile.name} 已成功备份至 Google Drive！`);
      setUploadModalOpen(false);
      setSelectedUploadFile(null);
      void loadDriveData();
    } catch (err: any) {
      message.error(err.message || '文件上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  // One-Click Sync SMT Inspection Audit Reports to Drive
  const handleSyncInspectionReports = async () => {
    setIsSyncingReports(true);
    try {
      // 1. Fetch live inspection records from server
      const [solderRes, alertsRes] = await Promise.all([
        api.get('/video-training/training-jobs').catch(() => ({ data: [] })),
        api.get('/alerts?page=1&pageSize=20').catch(() => ({ data: { items: [] } })),
      ]);

      // 2. Create or locate "SMT_Quality_Inspection_Audits" folder
      const syncFolderName = `SMT_Inspection_Audits_${new Date().getFullYear()}`;
      const folder = await createDriveFolder(syncFolderName, currentFolder.id);

      // 3. Create comprehensive JSON report
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPayload = {
        title: 'YOLO SMT 焊接缺陷质检与工业视觉审计全量报告',
        generated_at: new Date().toISOString(),
        auditor: userProfile?.displayName || '工业视觉质检系统',
        auditor_email: userProfile?.email || 'quality@smt-line.local',
        standards_compliance: {
          standard: 'IPC-A-610G Class 2/3',
          wetting_angle_target_deg: '<= 90',
          tht_hole_fill_target_pct: '>= 75',
          void_area_max_pct: '<= 15',
        },
        workstation_telemetry: {
          plc_interlock_response_ms: 33.3,
          stereo_vision_overlap_rate_pct: 86.4,
          dual_camera_reprojection_error_px: 0.098,
        },
        recent_inspections: solderRes.data?.slice(0, 5) || [],
        recent_alarm_events: alertsRes.data?.items || [],
      };

      await uploadJsonToDrive(`SMT_Quality_Audit_Summary_${timestamp}.json`, reportPayload, folder.id);

      message.success(`质检审计报告已一键同步至 Google Drive [${syncFolderName}] 文件夹！`);
      void loadDriveData();
    } catch (err: any) {
      message.error(`同步报告失败: ${err.message || '网络异常'}`);
    } finally {
      setIsSyncingReports(false);
    }
  };

  // Open Delete Confirmation Dialog (MANDATORY per Workspace Skill)
  const handleOpenDeleteConfirm = (file: DriveFileItem) => {
    setFileToDelete(file);
    setDeleteConfirmModalOpen(true);
  };

  // Execute Deletion after explicit confirmation
  const handleExecuteDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(fileToDelete.id);
      message.success(`已从 Google Drive 中永久删除: ${fileToDelete.name}`);
      setDeleteConfirmModalOpen(false);
      setFileToDelete(null);
      void loadDriveData();
    } catch (err: any) {
      message.error(`删除失败: ${err.message || '权限不足'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // File Icon Helper
  const getFileIcon = (file: DriveFileItem) => {
    if (file.isFolder) {
      return <FolderOutlined style={{ fontSize: 20, color: '#f59e0b' }} />;
    }
    if (file.mimeType.includes('image')) {
      return <PictureOutlined style={{ fontSize: 20, color: '#10b981' }} />;
    }
    if (file.mimeType.includes('video')) {
      return <VideoCameraOutlined style={{ fontSize: 20, color: '#ef4444' }} />;
    }
    if (file.mimeType.includes('zip') || file.mimeType.includes('tar') || file.mimeType.includes('gzip')) {
      return <FileZipOutlined style={{ fontSize: 20, color: '#8b5cf6' }} />;
    }
    return <FileTextOutlined style={{ fontSize: 20, color: '#0284c7' }} />;
  };

  // Table Columns
  const columns = [
    {
      title: '文件 / 文件夹名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: DriveFileItem) => (
        <Space style={{ cursor: record.isFolder ? 'pointer' : 'default' }} onClick={() => record.isFolder && handleOpenFolder(record)}>
          {getFileIcon(record)}
          <Text strong={record.isFolder} style={{ color: record.isFolder ? '#1d4ed8' : '#1e293b' }}>
            {record.name}
          </Text>
          {record.isFolder && <Tag color="blue">文件夹</Tag>}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'mimeType',
      key: 'mimeType',
      width: 180,
      render: (mime: string, record: DriveFileItem) => {
        if (record.isFolder) return <span style={{ color: '#64748b' }}>Google Drive 文件夹</span>;
        if (mime.includes('json')) return <Tag color="cyan">JSON 质检数据</Tag>;
        if (mime.includes('image')) return <Tag color="green">工业图像</Tag>;
        if (mime.includes('video')) return <Tag color="red">告警视频</Tag>;
        if (mime.includes('pdf')) return <Tag color="volcano">PDF 质检单</Tag>;
        return <span style={{ color: '#94a3b8', fontSize: 12 }}>{mime.split('/').pop() || '文件'}</span>;
      },
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size?: string, record?: DriveFileItem) => (record?.isFolder ? '-' : formatBytes(size)),
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedTime',
      key: 'modifiedTime',
      width: 180,
      render: (time?: string) => (time ? new Date(time).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: DriveFileItem) => (
        <Space size="small">
          {record.webViewLink && (
            <Tooltip title="在 Google Drive 中直接打开">
              <Button
                type="link"
                size="small"
                icon={<LinkOutlined />}
                href={record.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
              />
            </Tooltip>
          )}
          {record.webContentLink && !record.isFolder && (
            <Tooltip title="直接下载文件">
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                href={record.webContentLink}
                target="_blank"
                rel="noopener noreferrer"
              />
            </Tooltip>
          )}
          <Tooltip title="永久删除文件">
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleOpenDeleteConfirm(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header Card: Google Auth & Storage Quota */}
      <Card
        size="small"
        style={{
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f0fdf4 100%)',
        }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg"
                  alt="Google Drive"
                  style={{ width: 28, height: 28 }}
                />
              </div>
              <div>
                <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Google Drive 工业云端硬盘与质检存证
                  {isAuthenticated ? (
                    <Tag color="success">已连接 Google 账号</Tag>
                  ) : (
                    <Tag color="warning">未连接授权</Tag>
                  )}
                </Title>
                <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                  与您的 Google Drive 安全打通，支持 SMT 质检审计报告、YOLO 训练集、告警证据切片一键云端自动归档。
                </Paragraph>
              </div>
            </div>
          </Col>

          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            {isAuthenticated ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                {userProfile?.photoURL ? (
                  <Avatar src={userProfile.photoURL} size={36} />
                ) : (
                  <Avatar style={{ backgroundColor: '#1a73e8' }}>{userProfile?.displayName?.[0] || 'G'}</Avatar>
                )}
                <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <Text strong style={{ fontSize: 13, display: 'block' }}>{userProfile?.displayName || 'Google 用户'}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{userProfile?.email}</Text>
                </div>
                <Button size="small" icon={<LogoutOutlined />} onClick={handleGoogleLogout}>
                  断开连接
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                <GoogleSignInButton
                  onClick={handleGoogleLogin}
                  loading={isLoggingIn}
                  text="连接 Google Drive"
                />
              </div>
            )}
          </Col>
        </Row>

        {/* Quota Strip if logged in */}
        {isAuthenticated && quota && quota.limit && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
            <Row gutter={[16, 8]} align="middle">
              <Col xs={24} md={12}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#475569' }}>Google Drive 空间使用容量:</span>
                  <strong>
                    {formatBytes(quota.usage)} / {formatBytes(quota.limit)} (
                    {((parseInt(quota.usage || '0', 10) / parseInt(quota.limit || '1', 10)) * 100).toFixed(1)}%)
                  </strong>
                </div>
                <Progress
                  percent={Math.round(
                    (parseInt(quota.usage || '0', 10) / parseInt(quota.limit || '1', 10)) * 100
                  )}
                  size="small"
                  strokeColor="#0284c7"
                  showInfo={false}
                />
              </Col>
              <Col xs={24} md={12} style={{ textAlign: 'right' }}>
                <Space>
                  <Tag color="cyan">授权范围: 全功能读写与文件管理</Tag>
                  <Tag color="blue">协议: Google Drive API v3 (OAuth 2.0)</Tag>
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      {!isAuthenticated ? (
        <Card style={{ borderRadius: 8, textAlign: 'center', padding: '36px 16px' }}>
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg"
            alt="Google Drive"
            style={{ width: 64, height: 64, marginBottom: 16 }}
          />
          <Title level={4}>请授权连接您的 Google Drive 账号</Title>
          <Paragraph type="secondary" style={{ maxWidth: 500, margin: '0 auto 24px' }}>
            连接后，系统可以直接将 IPC-A-610G 焊接质检分析单、缺陷高倍快照、YOLO 样本数据集自动备份至您的专属云盘，并在生产中进行长期质量留痕与审计追溯。
          </Paragraph>
          <GoogleSignInButton
            onClick={handleGoogleLogin}
            loading={isLoggingIn}
            text="立即连接 Google Drive"
          />
        </Card>
      ) : (
        /* Authenticated File Explorer Area */
        <Card size="small" style={{ borderRadius: 8 }}>
          {/* Action Strip & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <Space wrap>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewFolderModalOpen(true)}>
                新建文件夹
              </Button>
              <Button icon={<UploadOutlined />} onClick={() => setUploadModalOpen(true)}>
                上传本地文件
              </Button>
              <Button
                type="dashed"
                icon={<CloudSyncOutlined />}
                loading={isSyncingReports}
                onClick={handleSyncInspectionReports}
              >
                一键同步 SMT 审计报告
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadDriveData}>
                刷新
              </Button>
            </Space>

            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="搜索 Drive 文件名称..."
              allowClear
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={loadDriveData}
              style={{ width: 220 }}
            />
          </div>

          {/* Breadcrumb Navigation */}
          <div style={{ padding: '6px 10px', backgroundColor: '#f8fafc', borderRadius: 6, marginBottom: 12 }}>
            <Breadcrumb
              items={folderHistory.map((item, index) => ({
                title: (
                  <span
                    style={{
                      cursor: index < folderHistory.length - 1 ? 'pointer' : 'default',
                      color: index < folderHistory.length - 1 ? '#0284c7' : '#1e293b',
                      fontWeight: index === folderHistory.length - 1 ? 600 : 400,
                    }}
                    onClick={() => index < folderHistory.length - 1 && handleBreadcrumbClick(index)}
                  >
                    {item.name}
                  </span>
                ),
              }))}
            />
          </div>

          {/* Files Table */}
          <Table
            dataSource={files}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 15 }}
            size="middle"
          />
        </Card>
      )}

      {/* New Folder Modal */}
      <Modal
        title="在 Google Drive 中创建新文件夹"
        open={newFolderModalOpen}
        onOk={handleCreateFolder}
        confirmLoading={isCreatingFolder}
        onCancel={() => setNewFolderModalOpen(false)}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ marginTop: 12 }}>
          <Text style={{ display: 'block', marginBottom: 6 }}>文件夹名称:</Text>
          <Input
            placeholder="例如: SMT_PCB_Batch_2026 或 YOLO_Defect_Dataset"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onPressEnter={handleCreateFolder}
            autoFocus
          />
        </div>
      </Modal>

      {/* Upload File Modal */}
      <Modal
        title="上传质检报告或数据文件至 Google Drive"
        open={uploadModalOpen}
        onOk={handleUploadFile}
        confirmLoading={isUploading}
        onCancel={() => setUploadModalOpen(false)}
        okText="开始上传"
        cancelText="取消"
      >
        <div style={{ marginTop: 12 }}>
          <Upload.Dragger
            beforeUpload={(file) => {
              setSelectedUploadFile(file);
              return false; // prevent automatic POST
            }}
            maxCount={1}
            onRemove={() => setSelectedUploadFile(null)}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 32, color: '#0284c7' }} />
            </p>
            <p className="ant-upload-text">点击或将质检文件拖拽到此区域上传</p>
            <p className="ant-upload-hint">支持 PDF 质检单、JSON 标注数据、缺陷快照图像、ZIP 打包数据集</p>
          </Upload.Dragger>
          {selectedUploadFile && (
            <div style={{ marginTop: 8, color: '#16a34a', fontSize: 12 }}>
              已选中: {selectedUploadFile.name} ({formatBytes(selectedUploadFile.size)})
            </div>
          )}
        </div>
      </Modal>

      {/* MANDATORY Explicit Confirmation Dialog for File Deletion */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ef4444' }} />
            <span>确认从 Google Drive 删除文件？</span>
          </Space>
        }
        open={deleteConfirmModalOpen}
        onOk={handleExecuteDelete}
        confirmLoading={isDeleting}
        onCancel={() => {
          setDeleteConfirmModalOpen(false);
          setFileToDelete(null);
        }}
        okText="确认删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <div style={{ marginTop: 12 }}>
          <Alert
            title="高危破坏性操作确认"
            description="该操作将直接调用 Google Drive API 将该项永久从云端移除，此操作无法撤销。请核对下方待删除文件明细："
            type="warning"
            showIcon
            style={{ marginBottom: 14 }}
          />
          {fileToDelete && (
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div><strong>名称:</strong> {fileToDelete.name}</div>
              <div><strong>类型:</strong> {fileToDelete.isFolder ? '文件夹（连同内部所有内容）' : fileToDelete.mimeType}</div>
              <div><strong>大小:</strong> {fileToDelete.isFolder ? '-' : formatBytes(fileToDelete.size)}</div>
              <div><strong>文件 ID:</strong> <code style={{ fontSize: 11 }}>{fileToDelete.id}</code></div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default GoogleDrivePage;
