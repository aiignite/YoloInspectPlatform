import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import { CircularProgress, Box, Typography } from '@mui/material';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Cameras = lazy(() => import('./pages/Cameras'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Statistics = lazy(() => import('./pages/Statistics'));
const VideoLearning = lazy(() => import('./pages/VideoLearning'));
const LiveMonitor = lazy(() => import('./pages/LiveMonitor'));
const Users = lazy(() => import('./pages/Users'));
const MES = lazy(() => import('./pages/MES'));
const Settings = lazy(() => import('./pages/Settings'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const ModelManager = lazy(() => import('./pages/ModelManager'));
const VideoTraining = lazy(() => import('./pages/VideoTraining'));
const VideoTrainingEvaluation = lazy(() => import('./pages/VideoTrainingEvaluation'));
const BatchAnalysis = lazy(() => import('./pages/BatchAnalysis'));
const AlertWorkflow = lazy(() => import('./pages/AlertWorkflow'));
const StorageManage = lazy(() => import('./pages/StorageManage'));
const Sessions = lazy(() => import('./pages/Sessions'));
const LoginHistory = lazy(() => import('./pages/LoginHistory'));
const DatasetAudit = lazy(() => import('./pages/DatasetAudit'));
const ModelOptimizer = lazy(() => import('./pages/ModelOptimizer'));
const AdvancedImageLab = lazy(() => import('./pages/AdvancedImageLab'));
const SupervisionLab = lazy(() => import('./pages/SupervisionLab'));
const SolderInspectionLab = lazy(() => import('./pages/SolderInspectionLab'));
const WaveSolderInspectionLab = lazy(() => import('./pages/WaveSolderInspectionLab'));
const SopMonitor = lazy(() => import('./pages/SopMonitor'));
const SafetyFenceConfig = lazy(() => import('./pages/SafetyFenceConfig'));
const HandActionLab = lazy(() => import('./pages/HandActionLab'));
const GoldenStandardLab = lazy(() => import('./pages/GoldenStandard'));

function PageFallback() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
      <CircularProgress size={36} />
      <Typography variant="body2" color="text.secondary">
        模块加载中...
      </Typography>
    </Box>
  );
}

function ProtectedRoutes() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={44} />
      </Box>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <MainLayout />;
}


function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoutes />}>
              <Route index element={<Dashboard />} />
              <Route path="live-monitor" element={<LiveMonitor />} />
              <Route path="cameras" element={<Cameras />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="statistics" element={<Statistics />} />
              <Route path="video-learning" element={<VideoLearning />} />
              <Route path="golden-standard" element={<GoldenStandardLab />} />
              <Route path="sop-monitor" element={<SopMonitor />} />
              <Route path="users" element={<Users />} />
              <Route path="mes" element={<MES />} />
              <Route path="models" element={<ModelManager />} />
              <Route path="model-optimizer" element={<ModelOptimizer />} />
              <Route path="image-lab" element={<AdvancedImageLab />} />
              <Route path="supervision-lab" element={<SupervisionLab />} />
              <Route path="safety-fence" element={<SafetyFenceConfig />} />
              <Route path="hand-action-lab" element={<HandActionLab />} />
              <Route path="solder-lab" element={<SolderInspectionLab />} />
              <Route path="wave-solder-lab" element={<WaveSolderInspectionLab />} />
              <Route path="video-training" element={<VideoTraining />} />
              <Route path="video-training/evaluation" element={<VideoTrainingEvaluation />} />
              <Route path="batch-analysis" element={<BatchAnalysis />} />
              <Route path="dataset-audit" element={<DatasetAudit />} />
              <Route path="alert-workflow" element={<AlertWorkflow />} />
              <Route path="storage" element={<StorageManage />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="settings" element={<Settings />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="login-history" element={<LoginHistory />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
