import { useState, useEffect, useCallback } from 'react';
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
  Edit,
  Delete,
  People,
  AdminPanelSettings,
  Engineering,
  Person,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface User {
  id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [editing, setEditing] = useState<User | null>(null);

  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('operator');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { t } = useTranslation();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch {
      setToastMessage(t('pages.users.fetchFailed') || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => {
    setEditing(null);
    setFormUsername('');
    setFormPassword('');
    setFormDisplayName('');
    setFormEmail('');
    setFormRole('operator');
    setDialogOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setFormUsername(u.username);
    setFormPassword('');
    setFormDisplayName(u.display_name || '');
    setFormEmail(u.email || '');
    setFormRole(u.role || 'operator');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing && !formUsername.trim()) {
      setToastMessage('请输入用户名');
      return;
    }
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, {
          display_name: formDisplayName,
          email: formEmail,
          role: formRole,
        });
        setToastMessage(t('pages.users.updateSuccess') || '用户已更新');
      } else {
        await api.post('/users', {
          username: formUsername,
          password: formPassword || 'password123',
          display_name: formDisplayName,
          email: formEmail,
          role: formRole,
        });
        setToastMessage(t('pages.users.createSuccess') || '用户已创建');
      }
      setDialogOpen(false);
      fetchUsers();
    } catch {
      setToastMessage(editing ? '更新用户失败' : '创建用户失败');
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/users/${userToDelete.id}`);
      setToastMessage(t('pages.users.deleteSuccess') || '用户删除成功');
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch {
      setToastMessage(t('pages.users.deleteFailed') || '删除失败');
    }
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const managerCount = users.filter((u) => u.role === 'manager').length;
  const operatorCount = users.filter((u) => u.role === 'operator').length;

  const columns: GridColDef[] = [
    {
      field: 'username',
      headerName: t('auth.username') || '登录用户名',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#1a73e8' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'display_name',
      headerName: t('pages.users.displayName') || '姓名/昵称',
      width: 160,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {params.value || params.row.username}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'email',
      headerName: t('user.email') || '工作邮箱',
      flex: 1,
      minWidth: 180,
      renderCell: (params) => (
        <Typography variant="body2" color={params.value ? 'text.primary' : 'text.disabled'}>
          {params.value || '未设置'}
        </Typography>
      ),
    },
    {
      field: 'role',
      headerName: t('user.role') || '权限角色',
      width: 140,
      renderCell: (params) => {
        const r = params.value as string;
        const color = r === 'admin' ? 'error' : r === 'manager' ? 'primary' : 'success';
        return <Chip label={r.toUpperCase()} size="small" color={color} sx={{ fontWeight: 600 }} />;
      },
    },
    {
      field: 'is_active',
      headerName: t('common.status') || '账号状态',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? '正常活跃' : '已停用'}
          size="small"
          color={params.value ? 'success' : 'default'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'last_login',
      headerName: '最近活跃时间',
      width: 170,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {params.value ? new Date(params.value).toLocaleString() : '-'}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: t('common.actions') || '操作',
      width: 130,
      sortable: false,
      renderCell: (params) => {
        const u = params.row as User;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="编辑账户">
              <IconButton size="small" color="primary" onClick={() => openEdit(u)}>
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除账户">
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  setUserToDelete(u);
                  setDeleteConfirmOpen(true);
                }}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Metric Cards in Google Material Style */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">系统总账户数</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: '#1a73e8' }}>
                    {users.length}
                  </Typography>
                </Box>
                <People sx={{ fontSize: 36, color: '#1a73e8', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">系统管理员 (Admin)</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: '#d93025' }}>
                    {adminCount}
                  </Typography>
                </Box>
                <AdminPanelSettings sx={{ fontSize: 36, color: '#d93025', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">产线车间主管 (Manager)</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: '#1a73e8' }}>
                    {managerCount}
                  </Typography>
                </Box>
                <People sx={{ fontSize: 36, color: '#1a73e8', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <Card>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">工位操作员 (Operator)</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: '#1e8e3e' }}>
                    {operatorCount}
                  </Typography>
                </Box>
                <Engineering sx={{ fontSize: 36, color: '#1e8e3e', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Material DataGrid Card */}
      <Card>
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <People sx={{ color: '#1a73e8' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              用户与 RBAC 权限中心
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openCreate}
          >
            {t('pages.users.addUser') || '新增用户'}
          </Button>
        </Box>

        <Box sx={{ height: 480, width: '100%', px: 2, pb: 2 }}>
          <DataGrid
            rows={users}
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

      {/* Create / Edit Dialog in Google Material 3 Form */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editing ? '编辑用户配置' : '新增系统用户'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          {!editing && (
            <TextField
              label="登录用户名"
              required
              fullWidth
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              helperText="用于登录边缘计算节点的账号标识"
            />
          )}
          {!editing && (
            <TextField
              label="初始密码"
              type="password"
              fullWidth
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="默认 password123"
            />
          )}
          <TextField
            label="姓名 / 显示名称"
            fullWidth
            value={formDisplayName}
            onChange={(e) => setFormDisplayName(e.target.value)}
          />
          <TextField
            label="电子邮箱"
            type="email"
            fullWidth
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
          />
          <FormControl fullWidth>
            <InputLabel id="role-select-label">系统权限角色</InputLabel>
            <Select
              labelId="role-select-label"
              value={formRole}
              label="系统权限角色"
              onChange={(e) => setFormRole(e.target.value)}
            >
              <MenuItem value="admin">Administrator (最高系统管理员)</MenuItem>
              <MenuItem value="manager">Manager (产线车间主管)</MenuItem>
              <MenuItem value="operator">Operator (工位产线操作员)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave}>
            保存提交
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle sx={{ fontWeight: 600 }}>确认删除账户</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            您确定要彻底删除用户 <strong>{userToDelete?.username}</strong> 吗？删除后此账户将无法登录系统。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>取消</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>
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
