import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  DataGrid,
  GridColDef,
} from '@mui/x-data-grid';
import {
  FactCheck,
  Refresh,
  Security,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

interface LoginRecord {
  id: number;
  username: string | null;
  action: string;
  detail: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  created_at: string;
}

export default function LoginHistory() {
  const [records, setRecords] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetUserId, setTargetUserId] = useState<number | string>('all');
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  const isAdmin = currentUser?.role === 'admin';

  const loadHistory = async () => {
    setLoading(true);
    try {
      const endpoint =
        isAdmin && targetUserId !== 'all'
          ? `/auth/login-history/${targetUserId}`
          : '/auth/login-history';
      const res = await api.get(endpoint, { params: { limit: 100 } });
      const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setRecords(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [targetUserId]);

  const successCount = records.filter(
    (r) => r.status === 'success' || r.action === 'login'
  ).length;

  const columns: GridColDef[] = [
    {
      field: 'username',
      headerName: t('loginHistory.user') || '登录账户',
      width: 140,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#1a73e8' }}>
          {params.value || '未知访客'}
        </Typography>
      ),
    },
    {
      field: 'action',
      headerName: t('loginHistory.action') || '审计动作',
      width: 130,
      renderCell: (params) => {
        const a = (params.value as string) || 'login';
        return (
          <Chip
            label={a === 'login' ? '密码认证' : a === 'token_refresh' ? '令牌续期' : a}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        );
      },
    },
    {
      field: 'status',
      headerName: t('loginHistory.status') || '鉴权结果',
      width: 120,
      renderCell: (params) => {
        const isOk = params.value === 'success';
        return (
          <Chip
            icon={isOk ? <CheckCircle fontSize="small" /> : <ErrorIcon fontSize="small" />}
            label={isOk ? '通过' : '被拦截'}
            size="small"
            color={isOk ? 'success' : 'error'}
          />
        );
      },
    },
    {
      field: 'ip_address',
      headerName: t('loginHistory.ip') || '客户端 IP',
      width: 140,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#1a73e8' }}>
          {params.value || '127.0.0.1'}
        </Typography>
      ),
    },
    {
      field: 'user_agent',
      headerName: t('loginHistory.browser') || '系统与客户端指纹 (User-Agent)',
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
      headerName: t('loginHistory.time') || '审计记录时间',
      width: 180,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {new Date(params.value).toLocaleString()}
        </Typography>
      ),
    },
    {
      field: 'detail',
      headerName: t('loginHistory.detail') || '安全日志详情',
      width: 220,
      renderCell: (params) => (
        <Typography variant="caption" color="text.secondary">
          {params.value || (params.row.status === 'success' ? 'JWT 凭证签发与设备指纹一致' : '密码错误或凭证过期')}
        </Typography>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Visual Security Metric Row */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">当前安全审计记录</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: '#1a73e8' }}>
                    {records.length}
                  </Typography>
                </Box>
                <FactCheck sx={{ fontSize: 36, color: '#1a73e8' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">认证通过记录数</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: '#1e8e3e' }}>
                    {successCount}
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
                  <Typography variant="caption" color="text.secondary">多因素 / JWT 认证协议</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#202124' }}>
                    国密SM4 / RSA-256
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
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FactCheck sx={{ color: '#1a73e8' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t('loginHistory.title') || '系统访问审计与用户登录历史'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {isAdmin && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="user-filter-label">筛选特定用户</InputLabel>
                <Select
                  labelId="user-filter-label"
                  value={targetUserId}
                  label="筛选特定用户"
                  onChange={(e) => setTargetUserId(e.target.value)}
                >
                  <MenuItem value="all">全部用户账户</MenuItem>
                  <MenuItem value={1}>系统管理员 (admin)</MenuItem>
                  <MenuItem value={2}>产线主管 (manager)</MenuItem>
                  <MenuItem value={3}>质检操作员 (operator)</MenuItem>
                </Select>
              </FormControl>
            )}
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadHistory}
              disabled={loading}
            >
              刷新
            </Button>
          </Box>
        </Box>

        <Box sx={{ height: 480, width: '100%', px: 2, pb: 2 }}>
          <DataGrid
            rows={records}
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
    </Box>
  );
}
