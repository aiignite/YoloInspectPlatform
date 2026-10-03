import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Alert as MuiAlert,
  Tooltip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  DataGrid,
  GridColDef,
} from '@mui/x-data-grid';
import {
  Error as ErrorIcon,
  CheckCircle,
  AccessTime,
  FlashOn,
  FileDownload,
  Person,
  NotificationsActive,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

interface AlertItem {
  id: number;
  severity: string;
  message: string;
  camera_id: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  status: string;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface AlertStatsData {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
  pending: number;
  investigating: number;
  resolved: number;
}

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState<AlertStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { t } = useTranslation();
  const { user } = useAuth();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (filterSeverity !== 'all') params.severity = filterSeverity;
      if (filterStatus !== 'all') params.status = filterStatus;
      const [alertsRes, statsRes] = await Promise.all([
        api.get('/alerts', { params }),
        api.get('/alerts/stats'),
      ]);
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : alertsRes.data?.items || []);
      setStats(statsRes.data);
    } catch {
      setToastMessage(t('pages.alerts.fetchFailed') || '获取告警列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterSeverity, filterStatus]);

  const handleClaim = async (id: number) => {
    try {
      await api.put(`/alerts/${id}/claim`, { assigned_to: user?.username || 'admin' });
      setToastMessage(t('pages.alerts.claimed') || '已成功接单');
      fetchData();
    } catch {
      setToastMessage(t('pages.alerts.actionFailed') || '操作失败');
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await api.put(`/alerts/${id}/resolve`, {});
      setToastMessage(t('pages.alerts.resolved') || '告警已闭环处理');
      fetchData();
    } catch {
      setToastMessage(t('pages.alerts.actionFailed') || '操作失败');
    }
  };

  const handleClaimAll = async () => {
    try {
      await api.post('/alerts/claim-all');
      setToastMessage(t('pages.alerts.claimAllSuccess') || '一键认领成功');
      fetchData();
    } catch {
      setToastMessage(t('pages.alerts.actionFailed') || '操作失败');
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/alerts/export/csv', { responseType: 'blob' });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `alerts_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setToastMessage(t('pages.alerts.exportFailed') || '导出失败');
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'severity',
      headerName: t('pages.alerts.level') || '级别',
      width: 120,
      renderCell: (params) => {
        const s = (params.value as string) || 'info';
        const color = s === 'critical' ? 'error' : s === 'warning' ? 'warning' : 'info';
        return <Chip label={s.toUpperCase()} size="small" color={color} sx={{ fontWeight: 600 }} />;
      },
    },
    {
      field: 'message',
      headerName: t('alert.message') || '报警详情',
      flex: 1,
      minWidth: 260,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 500, color: '#202124' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'camera_id',
      headerName: t('pages.alerts.camera') || '工位相机',
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
          sx={{ fontFamily: 'monospace', bgcolor: '#f1f3f4', borderColor: '#dadce0' }}
        />
      ),
    },
    {
      field: 'status',
      headerName: t('common.status') || '处置状态',
      width: 140,
      renderCell: (params) => {
        const st = (params.value as string) || 'pending';
        if (st === 'resolved') {
          return (
            <Chip
              icon={<CheckCircle fontSize="small" />}
              label="已闭环"
              size="small"
              color="success"
              variant="outlined"
            />
          );
        }
        if (st === 'investigating') {
          return (
            <Chip
              icon={<AccessTime fontSize="small" />}
              label="排查中"
              size="small"
              color="warning"
              variant="outlined"
            />
          );
        }
        return (
          <Chip
            icon={<ErrorIcon fontSize="small" />}
            label="待响应"
            size="small"
            color="error"
            variant="outlined"
          />
        );
      },
    },
    {
      field: 'assigned_to',
      headerName: t('pages.alerts.assignee') || '处理人',
      width: 130,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Person fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="body2">{params.value || '-'}</Typography>
        </Box>
      ),
    },
    {
      field: 'created_at',
      headerName: t('pages.alerts.time') || '发生时间',
      width: 170,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {new Date(params.value).toLocaleString()}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: t('common.actions') || '操作',
      width: 140,
      sortable: false,
      renderCell: (params) => {
        const item = params.row as AlertItem;
        const st = item.status || 'pending';
        if (st === 'pending') {
          return (
            <Button
              size="small"
              variant="contained"
              onClick={() => handleClaim(item.id)}
              sx={{ py: 0.25, fontSize: '0.75rem' }}
            >
              {t('pages.alerts.claim') || '认领'}
            </Button>
          );
        }
        if (st === 'investigating') {
          return (
            <Button
              size="small"
              variant="outlined"
              color="success"
              onClick={() => handleResolve(item.id)}
              sx={{ py: 0.25, fontSize: '0.75rem' }}
            >
              {t('pages.alerts.resolve') || '办结'}
            </Button>
          );
        }
        return <Typography variant="caption" color="text.secondary">已归档</Typography>;
      },
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Visual Metric Cards */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">总告警量</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#1a73e8' }}>
                {stats?.total ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">紧急 (Critical)</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#d93025' }}>
                {stats?.critical ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">警告 (Warning)</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#f29900' }}>
                {stats?.warning ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">待认领</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#ea4335' }}>
                {stats?.pending ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">调查中</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#fbbc04' }}>
                {stats?.investigating ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">已闭环</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#1e8e3e' }}>
                {stats?.resolved ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Google Material DataGrid Card */}
      <Card>
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsActive sx={{ color: '#ea4335' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              产线缺陷与安防预警工单中心
            </Typography>
            <Chip label="Google Material M3 DataGrid" size="small" color="primary" variant="outlined" />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="severity-label">级别筛选</InputLabel>
              <Select
                labelId="severity-label"
                value={filterSeverity}
                label="级别筛选"
                onChange={(e) => setFilterSeverity(e.target.value)}
              >
                <MenuItem value="all">全部级别</MenuItem>
                <MenuItem value="critical">Critical (严重)</MenuItem>
                <MenuItem value="warning">Warning (警告)</MenuItem>
                <MenuItem value="info">Info (提示)</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="status-label">处置状态</InputLabel>
              <Select
                labelId="status-label"
                value={filterStatus}
                label="处置状态"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">全部状态</MenuItem>
                <MenuItem value="pending">待响应</MenuItem>
                <MenuItem value="investigating">排查中</MenuItem>
                <MenuItem value="resolved">已闭环</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title="一键将待办工单批量指派至当前账户">
              <Button
                variant="outlined"
                size="small"
                startIcon={<FlashOn />}
                onClick={handleClaimAll}
              >
                一键认领
              </Button>
            </Tooltip>

            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownload />}
              onClick={handleExportCsv}
            >
              导出报表
            </Button>
          </Box>
        </Box>

        {/* DataGrid Component */}
        <Box sx={{ height: 520, width: '100%', px: 2, pb: 2 }}>
          <DataGrid
            rows={alerts}
            columns={columns}
            loading={loading}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10, page: 0 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
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
};

export default Alerts;
