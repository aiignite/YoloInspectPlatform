import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Chip,
  Button,
  Select,
  MenuItem,
  Menu,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Videocam,
  Science,
  Security,
  GppGood,
  PanTool,
  Build,
  Waves,
  Speed,
  PhotoCamera,
  Notifications,
  BarChart,
  CalendarToday,
  Memory,
  Movie,
  PlayCircleFilled,
  Assessment,
  CloudQueue,
  FactCheck,
  TaskAlt,
  Storage,
  People,
  DeviceHub,
  History,
  Settings as SettingsIcon,
  ExpandLess,
  ExpandMore,
  AccountCircle,
  ExitToApp,
  Language,
} from '@mui/icons-material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const DRAWER_WIDTH = 260;

const roleColors: Record<string, 'error' | 'primary' | 'success'> = {
  admin: 'error',
  manager: 'primary',
  operator: 'success',
};

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    vision_lab: true,
    production: true,
    training: false,
    settings: false,
  });

  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isCurrent = (path: string) => location.pathname === path;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8f9fa' }}>
      {/* Google Cloud Style Persistent Sidebar Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#ffffff',
            borderRight: '1px solid #dadce0',
          },
        }}
      >
        {/* Brand & Logo Header */}
        <Box
          sx={{
            height: 64,
            px: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: '1px solid #dadce0',
          }}
        >
          <img src="/favicon.svg" alt="logo" style={{ width: 30, height: 30 }} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#202124', lineHeight: 1.2 }}>
              {t('app.title') || 'YOLO 工业质检平台'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#1a73e8', fontWeight: 600 }}>
              Google Material Edition
            </Typography>
          </Box>
        </Box>

        <List sx={{ px: 1, py: 1.5, overflowY: 'auto' }}>
          {/* Main Level 1 Items */}
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={isCurrent('/')}
              onClick={() => navigate('/')}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': { bgcolor: '#e8f0fe', color: '#1a73e8' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: isCurrent('/') ? '#1a73e8' : '#5f6368' }}>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {t('menu.dashboard') || '仪表盘态势'}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={isCurrent('/live-monitor')}
              onClick={() => navigate('/live-monitor')}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': { bgcolor: '#e8f0fe', color: '#1a73e8' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: isCurrent('/live-monitor') ? '#1a73e8' : '#5f6368' }}>
                <Videocam />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {t('menu.liveMonitor') || '实时多路监控'}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>

          <Divider sx={{ my: 1 }} />

          {/* Section 1: Vision Lab */}
          <ListItem disablePadding>
            <ListItemButton onClick={() => toggleSection('vision_lab')} sx={{ borderRadius: 2 }}>
              <ListItemIcon sx={{ minWidth: 38, color: '#f57c00' }}>
                <Science />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    视觉算法与质检实验室
                  </Typography>
                }
              />
              {openSections.vision_lab ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          <Collapse in={openSections.vision_lab} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ pl: 2 }}>
              <ListItemButton selected={isCurrent('/solder-lab')} onClick={() => navigate('/solder-lab')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32, color: '#f57c00' }}><Build fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>SMT 焊接质量质检</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/wave-solder-lab')} onClick={() => navigate('/wave-solder-lab')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32, color: '#0288d1' }}><Waves fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>波峰焊接质量评价</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/image-lab')} onClick={() => navigate('/image-lab')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32, color: '#2e7d32' }}><Science fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>图像增强与 SAHI 切片</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/supervision-lab')} onClick={() => navigate('/supervision-lab')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32, color: '#7b1fa2' }}><Security fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>Supervision 业务流</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/safety-fence')} onClick={() => navigate('/safety-fence')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32, color: '#e53935' }}><GppGood fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13, fontWeight: isCurrent('/safety-fence') ? 600 : 400 }}>电子安全围栏与标定</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/hand-action-lab')} onClick={() => navigate('/hand-action-lab')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32, color: '#0284c7' }}><PanTool fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13, fontWeight: isCurrent('/hand-action-lab') ? 600 : 400 }}>手部微动作识别与标定</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/model-optimizer')} onClick={() => navigate('/model-optimizer')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32, color: '#ed6c02' }}><Speed fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>模型响应加速超频</Typography>} />
              </ListItemButton>
            </List>
          </Collapse>

          {/* Section 2: Production & Alerts */}
          <ListItem disablePadding sx={{ mt: 1 }}>
            <ListItemButton onClick={() => toggleSection('production')} sx={{ borderRadius: 2 }}>
              <ListItemIcon sx={{ minWidth: 38, color: '#1a73e8' }}>
                <PhotoCamera />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    产线监控与工单闭环
                  </Typography>
                }
              />
              {openSections.production ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          <Collapse in={openSections.production} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ pl: 2 }}>
              <ListItemButton selected={isCurrent('/cameras')} onClick={() => navigate('/cameras')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><PhotoCamera fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.cameras') || '工位相机管理'}</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/alerts')} onClick={() => navigate('/alerts')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32, color: '#ea4335' }}><Notifications fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.alerts') || '告警事件中心'}</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/alert-workflow')} onClick={() => navigate('/alert-workflow')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><Notifications fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.alertWorkflow') || '告警流转工作流'}</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/statistics')} onClick={() => navigate('/statistics')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><BarChart fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.statistics') || '生产质检统计'}</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/mes')} onClick={() => navigate('/mes')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><CalendarToday fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.mes') || 'MES 生产批次'}</Typography>} />
              </ListItemButton>
            </List>
          </Collapse>

          {/* Section 3: AI Training */}
          <ListItem disablePadding sx={{ mt: 1 }}>
            <ListItemButton onClick={() => toggleSection('training')} sx={{ borderRadius: 2 }}>
              <ListItemIcon sx={{ minWidth: 38, color: '#34a853' }}>
                <Memory />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    算法训练与数据闭环
                  </Typography>
                }
              />
              {openSections.training ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          <Collapse in={openSections.training} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ pl: 2 }}>
              <ListItemButton selected={isCurrent('/models')} onClick={() => navigate('/models')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><Memory fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.models') || '模型权重仓库'}</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/video-learning')} onClick={() => navigate('/video-learning')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><Movie fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>SOP动作分解与标定</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/sop-monitor')} onClick={() => navigate('/sop-monitor')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32, color: '#1a73e8' }}><TaskAlt fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>生产SOP合规实时监控</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/video-training')} onClick={() => navigate('/video-training')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><PlayCircleFilled fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.videoTraining') || '模型自动微调'}</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/video-training/evaluation')} onClick={() => navigate('/video-training/evaluation')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><Assessment fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.videoTrainingEvaluation') || '模型指标评估'}</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/batch-analysis')} onClick={() => navigate('/batch-analysis')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><CloudQueue fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.batchAnalysis') || '批量图片离线推断'}</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/dataset-audit')} onClick={() => navigate('/dataset-audit')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><FactCheck fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>数据集健康体检</Typography>} />
              </ListItemButton>
            </List>
          </Collapse>

          {/* Section 4: System */}
          <ListItem disablePadding sx={{ mt: 1 }}>
            <ListItemButton onClick={() => toggleSection('settings')} sx={{ borderRadius: 2 }}>
              <ListItemIcon sx={{ minWidth: 38, color: '#5f6368' }}>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    系统配置与安全
                  </Typography>
                }
              />
              {openSections.settings ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          <Collapse in={openSections.settings} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ pl: 2 }}>
              <ListItemButton selected={isCurrent('/storage')} onClick={() => navigate('/storage')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><Storage fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.storage') || '存储与配额'}</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/users')} onClick={() => navigate('/users')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><People fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.users') || '用户与角色'}</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/sessions')} onClick={() => navigate('/sessions')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><DeviceHub fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>在线设备与会话</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/login-history')} onClick={() => navigate('/login-history')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><History fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>登录审计追踪</Typography>} />
              </ListItemButton>
              <ListItemButton selected={isCurrent('/settings')} onClick={() => navigate('/settings')} sx={{ borderRadius: 2, mb: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}><SettingsIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary={<Typography variant="body2" sx={{ fontSize: 13 }}>{t('menu.settings') || '系统全局设置'}</Typography>} />
              </ListItemButton>
            </List>
          </Collapse>
        </List>
      </Drawer>

      {/* Main Content Area with Google Cloud Console Top Bar */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: '#ffffff',
            color: '#202124',
            borderBottom: '1px solid #dadce0',
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', px: 3, minHeight: '64px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#202124' }}>
                {t('app.subtitle') || '工业级边缘 AI 视觉质量检测系统'}
              </Typography>
              <Chip
                label="● 边缘就绪 / TensorRT 加速"
                size="small"
                sx={{
                  bgcolor: '#e6f4ea',
                  color: '#137333',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Language Selector */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Language fontSize="small" sx={{ color: 'text.secondary' }} />
                <Select
                  size="small"
                  value={i18n.language?.startsWith('zh') ? 'zh' : 'en'}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  sx={{ height: 32, fontSize: 13 }}
                >
                  <MenuItem value="zh">简体中文</MenuItem>
                  <MenuItem value="en">English</MenuItem>
                </Select>
              </Box>

              {/* User Profile Pill */}
              {user && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                    startIcon={<AccountCircle sx={{ color: '#1a73e8' }} />}
                    sx={{
                      borderColor: '#dadce0',
                      color: '#202124',
                      textTransform: 'none',
                      bgcolor: '#f8f9fa',
                    }}
                  >
                    {user.display_name || user.username}
                    <Chip
                      label={user.role}
                      size="small"
                      color={roleColors[user.role] || 'primary'}
                      sx={{ ml: 1, height: 20, fontSize: 10, fontWeight: 700 }}
                    />
                  </Button>
                  <Menu
                    anchorEl={userMenuAnchor}
                    open={Boolean(userMenuAnchor)}
                    onClose={() => setUserMenuAnchor(null)}
                  >
                    <MenuItem onClick={() => { setUserMenuAnchor(null); logout(); }}>
                      <ListItemIcon><ExitToApp fontSize="small" /></ListItemIcon>
                      <ListItemText primary={t('auth.logout') || '退出登录'} />
                    </MenuItem>
                  </Menu>
                </Box>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: '#f8f9fa', overflowY: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;
