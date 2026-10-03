import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert as MuiAlert,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  DataGrid,
  GridColDef,
} from '@mui/x-data-grid';
import {
  DesktopWindows,
  Refresh,
  Security,
  CheckCircle,
  Logout,
  DeviceHub,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface Session {
  id: number;
  jti: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string;
  last_accessed_at: string;
  is_current: boolean;
}

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [sessionToTerminate, setSessionToTerminate] = useState<Session | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { t } = useTranslation();

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/sessions');
      setSessions(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch {
      setToastMessage('加载在线会话列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleTerminate = async () => {
    if (!sessionToTerminate) return;
    try {
      await api.delete(`/auth/sessions/${sessionToTerminate.id}`);
      setToastMessage('会话已被强制下线');
      setTerminateDialogOpen(false);
      setSessionToTerminate(null);
      loadSessions();
    } catch {
      setToastMessage('终止会话操作失败');
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'device_info',
      headerName: t('sessions.device') || '设备终端类型',
      width: 180,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DesktopWindows fontSize="small" sx={{ color: '#1a73e8' }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.value || '工控机终端 / PC'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'ip_address',
      headerName: t('sessions.ip') || '客户端 IP',
      width: 140,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#1a73e8', fontWeight: 600 }}>
          {params.value || '127.0.0.1'}
        </Typography>
      ),
    },
    {
      field: 'user_agent',
      headerName: t('sessions.browser') || '系统与浏览器内核 (User-Agent)',
      flex: 1,
      minWidth: 260,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {params.value || 'Chrome/124.0 (Industrial Edge OS)'}
        </Typography>
      ),
    },
    {
      field: 'created_at',
      headerName: t('sessions.loginTime') || '会话建立时间',
      width: 180,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {new Date(params.value).toLocaleString()}
        </Typography>
      ),
    },
    {
      field: 'last_accessed_at',
      headerName: t('sessions.lastActive') || '最近心跳时间',
      width: 180,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#1e8e3e', fontWeight: 600 }}>
          {new Date(params.value).toLocaleString()}
        </Typography>
      ),
    },
    {
      field: 'is_current',
      headerName: t('sessions.status') || '会话状态',
      width: 130,
      renderCell: (params) => (
        <Chip
          icon={params.value ? <CheckCircle fontSize="small" /> : undefined}
          label={params.value ? '当前活跃本机' : '远端终端'}
          size="small"
          color={params.value ? 'success' : 'default'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'actions',
      headerName: t('sessions.action') || '安全管控',
      width: 120,
      sortable: false,
      renderCell: (params) => {
        const row = params.row as Session;
        if (row.is_current) {
          return <Typography variant="caption" color="text.secondary">本机受保护</Typography>;
        }
        return (
          <Button
            size="small"
            color="error"
            variant="outlined"
            startIcon={<Logout fontSize="small" />}
            onClick={() => {
              setSessionToTerminate(row);
              setTerminateDialogOpen(true);
            }}
            sx={{ py: 0.25, fontSize: '0.75rem' }}
          >
            {t('sessions.terminate') || '强退'}
          </Button>
        );
      },
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Session Security Overview */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">在线会话连接数</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: '#1a73e8' }}>
                    {sessions.length}
                  </Typography>
                </Box>
                <DesktopWindows sx={{ fontSize: 36, color: '#1a73e8' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">受保护登录终端</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#1e8e3e' }}>
                    当前工控机在线
                  </Typography>
                </Box>
                <CheckCircle sx={{ fontSize: 36, color: '#1e8e3e' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">安全鉴权机制</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#202124' }}>
                    JWT + 双令牌自刷新
                  </Typography>
                </Box>
                <Security sx={{ fontSize: 36, color: '#f29900' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Material DataGrid Card */}
      <Card>
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeviceHub sx={{ color: '#1a73e8' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t('sessions.title') || '在线会话管理与安全强退'}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadSessions}
            disabled={loading}
          >
            {t('common.refresh') || '刷新会话'}
          </Button>
        </Box>

        <Box sx={{ height: 480, width: '100%', px: 2, pb: 2 }}>
          <DataGrid
            rows={sessions}
            columns={columns}
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
      </Card>

      {/* Terminate Session Dialog */}
      <Dialog open={terminateDialogOpen} onClose={() => setTerminateDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 600 }}>安全强退确认</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            确定要强制终止远端 IP <strong>{sessionToTerminate?.ip_address}</strong> 的登录会话吗？终止后对方将立刻被踢出系统。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTerminateDialogOpen(false)}>取消</Button>
          <Button color="error" variant="contained" onClick={handleTerminate}>
            强制下线
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
