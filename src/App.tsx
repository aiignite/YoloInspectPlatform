import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import { CircularProgress, Box, Typography } from '@mui/material';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { ErrorBoundary } from './components/ErrorBoundary';

const Login = lazyWithRetry(() => import('./pages/Login'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Cameras = lazyWithRetry(() => import('./pages/Cameras'));
const Alerts = lazyWithRetry(() => import('./pages/Alerts'));
const Statistics = lazyWithRetry(() => import('./pages/Statistics'));
const VideoLearning = lazyWithRetry(() => import('./pages/VideoLearning'));
const LiveMonitor = lazyWithRetry(() => import('./pages/LiveMonitor'));
const Users = lazyWithRetry(() => import('./pages/Users'));
const MES = lazyWithRetry(() => import('./pages/MES'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const AuditLogs = lazyWithRetry(() => import('./pages/AuditLogs'));
const ModelManager = lazyWithRetry(() => import('./pages/ModelManager'));
const VideoTraining = lazyWithRetry(() => import('./pages/VideoTraining'));
const VideoTrainingEvaluation = lazyWithRetry(() => import('./pages/VideoTrainingEvaluation'));
const BatchAnalysis = lazyWithRetry(() => import('./pages/BatchAnalysis'));
const AlertWorkflow = lazyWithRetry(() => import('./pages/AlertWorkflow'));
const StorageManage = lazyWithRetry(() => import('./pages/StorageManage'));
const Sessions = lazyWithRetry(() => import('./pages/Sessions'));
const LoginHistory = lazyWithRetry(() => import('./pages/LoginHistory'));
const DatasetAudit = lazyWithRetry(() => import('./pages/DatasetAudit'));
const ModelOptimizer = lazyWithRetry(() => import('./pages/ModelOptimizer'));
const AdvancedImageLab = lazyWithRetry(() => import('./pages/AdvancedImageLab'));
const SupervisionLab = lazyWithRetry(() => import('./pages/SupervisionLab'));
const SolderInspectionLab = lazyWithRetry(() => import('./pages/SolderInspectionLab'));
const WaveSolderInspectionLab = lazyWithRetry(() => import('./pages/WaveSolderInspectionLab'));
const SopMonitor = lazyWithRetry(() => import('./pages/SopMonitor'));
const SafetyFenceConfig = lazyWithRetry(() => import('./pages/SafetyFenceConfig'));
const HandActionLab = lazyWithRetry(() => import('./pages/HandActionLab'));
const GoldenStandardLab = lazyWithRetry(() => import('./pages/GoldenStandard'));
const DigitalTwin = lazyWithRetry(() => import('./pages/DigitalTwin'));
const GoogleDrive = lazyWithRetry(() => import('./pages/GoogleDrive'));

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
        <ErrorBoundary>
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
                <Route path="digital-twin" element={<DigitalTwin />} />
                <Route path="solder-lab" element={<SolderInspectionLab />} />
                <Route path="wave-solder-lab" element={<WaveSolderInspectionLab />} />
                <Route path="video-training" element={<VideoTraining />} />
                <Route path="video-training/evaluation" element={<VideoTrainingEvaluation />} />
                <Route path="batch-analysis" element={<BatchAnalysis />} />
                <Route path="dataset-audit" element={<DatasetAudit />} />
                <Route path="alert-workflow" element={<AlertWorkflow />} />
                <Route path="storage" element={<StorageManage />} />
                <Route path="google-drive" element={<GoogleDrive />} />
                <Route path="audit-logs" element={<AuditLogs />} />
                <Route path="settings" element={<Settings />} />
                <Route path="sessions" element={<Sessions />} />
                <Route path="login-history" element={<LoginHistory />} />
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
