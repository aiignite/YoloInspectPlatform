import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert as MuiAlert,
  IconButton,
  Tooltip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  DataGrid,
  GridColDef,
} from '@mui/x-data-grid';
import {
  Add,
  Delete,
  Settings as SettingsIcon,
  Cable,
  CheckCircle,
  Refresh,
  Speed,
  Memory,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface SystemConfig {
  id: number;
  category: string;
  key: string;
  value: string | null;
  description: string | null;
}

interface CameraDriver {
  id: number;
  name: string;
  protocol: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Settings() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [drivers, setDrivers] = useState<CameraDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  // Modal states
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'config' | 'driver'; id: number; name: string } | null>(null);

  // Form states for config
  const [configCategory, setConfigCategory] = useState('general');
  const [configKey, setConfigKey] = useState('');
  const [configValue, setConfigValue] = useState('');
  const [configDesc, setConfigDesc] = useState('');

  // Form states for driver
  const [driverName, setDriverName] = useState('');
  const [driverProtocol, setDriverProtocol] = useState('rtsp');
  const [driverDesc, setDriverDesc] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { t } = useTranslation();

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await api.get('/system/configs');
      setConfigs(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch {
      // ignore
    }
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await api.get('/system/drivers');
      setDrivers(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch {
      // ignore
    }
  }, []);

  const reloadAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchConfigs(), fetchDrivers()]).finally(() => setLoading(false));
  }, [fetchConfigs, fetchDrivers]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  const handleCreateConfig = async () => {
    if (!configKey.trim()) {
      setToastMessage('配置键名不能为空');
      return;
    }
    try {
      await api.post('/system/configs', {
        category: configCategory,
        key: configKey,
        value: configValue,
        description: configDesc,
      });
      setToastMessage(t('pages.settings.configSaved') || '配置项已保存');
      setConfigModalOpen(false);
      setConfigKey('');
      setConfigValue('');
      setConfigDesc('');
      fetchConfigs();
    } catch {
      setToastMessage('保存配置失败');
    }
  };

  const handleCreateDriver = async () => {
    if (!driverName.trim()) {
      setToastMessage('驱动名称不能为空');
      return;
    }
    try {
      await api.post('/system/drivers', {
        name: driverName,
        protocol: driverProtocol,
        description: driverDesc,
      });
      setToastMessage(t('pages.settings.driverAdded') || '工业驱动协议已装载');
      setDriverModalOpen(false);
      setDriverName('');
      setDriverDesc('');
      fetchDrivers();
    } catch {
      setToastMessage('添加驱动失败');
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'config') {
        await api.delete(`/system/configs/${itemToDelete.id}`);
        setToastMessage(t('pages.settings.configDeleted') || '配置项已删除');
        fetchConfigs();
      } else {
        await api.delete(`/system/drivers/${itemToDelete.id}`);
        setToastMessage(t('pages.settings.driverDeleted') || '驱动已卸载');
        fetchDrivers();
      }
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    } catch {
      setToastMessage('删除操作失败');
    }
  };

  const configColumns: GridColDef[] = [
    {
      field: 'category',
      headerName: t('pages.settings.category') || '分类类别',
      width: 140,
      renderCell: (params) => {
        const cat = (params.value as string) || 'general';
        const color = cat === 'detection' ? 'primary' : cat === 'storage' ? 'secondary' : cat === 'notification' ? 'warning' : 'default';
        return <Chip label={cat.toUpperCase()} size="small" color={color as any} sx={{ fontWeight: 600 }} />;
      },
    },
    {
      field: 'key',
      headerName: t('pages.settings.configKey') || '配置参数名 (Key)',
      width: 250,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#1a73e8' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'value',
      headerName: t('pages.settings.configValue') || '当前运行参数值 (Value)',
      width: 220,
      renderCell: (params) => (
        <Box sx={{ fontFamily: 'monospace', bgcolor: '#f1f3f4', px: 1, py: 0.5, borderRadius: 1, border: '1px solid #dadce0', fontSize: '0.85rem' }}>
          {params.value ?? '-'}
        </Box>
      ),
    },
    {
      field: 'description',
      headerName: t('pages.settings.description') || '配置说明',
      flex: 1,
      minWidth: 220,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: t('common.actions') || '操作',
      width: 90,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="删除配置项">
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              setItemToDelete({ type: 'config', id: params.row.id, name: params.row.key });
              setDeleteConfirmOpen(true);
            }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const driverColumns: GridColDef[] = [
    {
      field: 'name',
      headerName: t('pages.settings.driverName') || '工业驱动名称',
      width: 280,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'protocol',
      headerName: t('pages.settings.protocol') || '网络传输协议',
      width: 140,
      renderCell: (params) => (
        <Chip
          label={((params.value as string) || 'RTSP').toUpperCase()}
          size="small"
          variant="outlined"
          color="info"
          sx={{ fontFamily: 'monospace', fontWeight: 600 }}
        />
      ),
    },
    {
      field: 'description',
      headerName: t('pages.settings.description') || '协议特性与适配硬件说明',
      flex: 1,
      minWidth: 260,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'is_active',
      headerName: t('common.status') || '驱动状态',
      width: 140,
      renderCell: (params) => (
        <Chip
          icon={<CheckCircle fontSize="small" />}
          label={params.value ? '已装载激活' : '未挂载'}
          size="small"
          color={params.value ? 'success' : 'default'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'actions',
      headerName: t('common.actions') || '操作',
      width: 90,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="卸载驱动协议">
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              setItemToDelete({ type: 'driver', id: params.row.id, name: params.row.name });
              setDeleteConfirmOpen(true);
            }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Metric Cards in Google Material Style */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">活动系统全局配置项</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: '#1a73e8' }}>
                    {configs.length}
                  </Typography>
                </Box>
                <SettingsIcon sx={{ fontSize: 36, color: '#1a73e8', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">工业相机驱动协议适配</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: '#1e8e3e' }}>
                    {drivers.length}
                  </Typography>
                </Box>
                <Cable sx={{ fontSize: 36, color: '#1e8e3e', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">边缘推理运行时</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#202124' }}>
                    TensorRT INT8 加速
                  </Typography>
                </Box>
                <Speed sx={{ fontSize: 36, color: '#f29900', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Google Material Tabs Card */}
      <Card>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #dadce0', flexWrap: 'wrap', gap: 1.5 }}>
          <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)}>
            <Tab
              icon={<SettingsIcon fontSize="small" />}
              iconPosition="start"
              label={t('pages.settings.systemConfig') || '系统全局参数'}
              sx={{ fontWeight: 600, textTransform: 'none' }}
            />
            <Tab
              icon={<Memory fontSize="small" />}
              iconPosition="start"
              label={t('pages.settings.cameraDrivers') || '工业相机与硬件驱动协议'}
              sx={{ fontWeight: 600, textTransform: 'none' }}
            />
          </Tabs>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={reloadAll}
            >
              {t('common.refresh') || '刷新'}
            </Button>
            {tabIndex === 0 ? (
              <Button
                variant="contained"
                size="small"
                startIcon={<Add />}
                onClick={() => setConfigModalOpen(true)}
              >
                {t('pages.settings.addConfig') || '新增配置项'}
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                startIcon={<Add />}
                onClick={() => setDriverModalOpen(true)}
              >
                {t('pages.settings.addDriver') || '装载相机驱动'}
              </Button>
            )}
          </Box>
        </Box>

        {/* Tab 0: System Config DataGrid */}
        {tabIndex === 0 && (
          <Box sx={{ height: 480, width: '100%', p: 2 }}>
            <DataGrid
              rows={configs}
              columns={configColumns}
              loading={loading}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 10, page: 0 },
                },
              }}
              pageSizeOptions={[10, 20]}
              disableRowSelectionOnClick
              sx={{
                border: '1px solid #dadce0',
                borderRadius: 2,
                '& .MuiDataGrid-columnHeaders': {
                  bgcolor: '#f8f9fa',
                  fontWeight: 700,
                },
              }}
            />
          </Box>
        )}

        {/* Tab 1: Camera Driver DataGrid */}
        {tabIndex === 1 && (
          <Box sx={{ height: 480, width: '100%', p: 2 }}>
            <DataGrid
              rows={drivers}
              columns={driverColumns}
              loading={loading}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 10, page: 0 },
                },
              }}
              pageSizeOptions={[10, 20]}
              disableRowSelectionOnClick
              sx={{
                border: '1px solid #dadce0',
                borderRadius: 2,
                '& .MuiDataGrid-columnHeaders': {
                  bgcolor: '#f8f9fa',
                  fontWeight: 700,
                },
              }}
            />
          </Box>
        )}
      </Card>

      {/* Add Config Dialog */}
      <Dialog open={configModalOpen} onClose={() => setConfigModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {t('pages.settings.addConfig') || '新增系统全局配置参数'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="category-select-label">{t('pages.settings.category') || '分类类别'}</InputLabel>
            <Select
              labelId="category-select-label"
              value={configCategory}
              label={t('pages.settings.category') || '分类类别'}
              onChange={(e) => setConfigCategory(e.target.value)}
            >
              <MenuItem value="general">General (系统通用设置)</MenuItem>
              <MenuItem value="detection">Detection (视觉推理与加速参数)</MenuItem>
              <MenuItem value="storage">Storage (存储与生命周期)</MenuItem>
              <MenuItem value="notification">Notification (预警与推送渠道)</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label={t('pages.settings.configKey') || '配置项参数键 (Key)'}
            required
            fullWidth
            value={configKey}
            onChange={(e) => setConfigKey(e.target.value)}
            placeholder="例: default_confidence_threshold"
          />
          <TextField
            label={t('pages.settings.configValue') || '参数值 (Value)'}
            fullWidth
            value={configValue}
            onChange={(e) => setConfigValue(e.target.value)}
            placeholder="例: 0.65"
          />
          <TextField
            label={t('pages.settings.description') || '配置说明'}
            fullWidth
            multiline
            rows={2}
            value={configDesc}
            onChange={(e) => setConfigDesc(e.target.value)}
            placeholder="说明此运行参数在边缘算力端的生效范围"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfigModalOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreateConfig}>
            保存应用
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Driver Dialog */}
      <Dialog open={driverModalOpen} onClose={() => setDriverModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {t('pages.settings.addDriver') || '装载工业相机协议驱动'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <TextField
            label={t('pages.settings.driverName') || '驱动组件名称'}
            required
            fullWidth
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="例: GenICam GigE Vision 驱动 (Basler/大恒/海康)"
          />
          <FormControl fullWidth>
            <InputLabel id="protocol-select-label">{t('pages.settings.protocol') || '网络传输协议'}</InputLabel>
            <Select
              labelId="protocol-select-label"
              value={driverProtocol}
              label={t('pages.settings.protocol') || '网络传输协议'}
              onChange={(e) => setDriverProtocol(e.target.value)}
            >
              <MenuItem value="rtsp">RTSP (实时流协议 / H.264 / H.265)</MenuItem>
              <MenuItem value="gigE">GigE Vision (千兆网工业高速相机)</MenuItem>
              <MenuItem value="usb">USB3.0 (工控机免驱 UVC 接口)</MenuItem>
              <MenuItem value="http">HTTP / WebRTC 实时流协议</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label={t('pages.settings.description') || '驱动特性说明'}
            fullWidth
            multiline
            rows={3}
            value={driverDesc}
            onChange={(e) => setDriverDesc(e.target.value)}
            placeholder="驱动参数及硬件特异性说明，如 Jumbo Frames、零拷贝缓冲支持"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDriverModalOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreateDriver}>
            装载驱动
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle sx={{ fontWeight: 600 }}>确认删除操作</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            您确定要删除 <strong>{itemToDelete?.name}</strong> 吗？此操作将立即在边缘计算端生效。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>取消</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            确认删除
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toastMessage}
        autoHideDuration={3000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MuiAlert onClose={() => setToastMessage(null)} severity="info" sx={{ width: '100%' }}>
          {toastMessage}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
}
