import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { RefreshOutlined, WarningAmberOutlined } from '@mui/icons-material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isDynamicImportError =
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Failed to fetch');

      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
            p: 3,
          }}
        >
          <Paper
            elevation={2}
            sx={{
              p: 4,
              maxWidth: 500,
              textAlign: 'center',
              borderRadius: 3,
              border: '1px solid #fecaca',
              bgcolor: '#fff5f5',
            }}
          >
            <WarningAmberOutlined sx={{ fontSize: 52, color: '#ef4444', mb: 1.5 }} />
            <Typography variant="h6" sx={{ color: '#991b1b', fontWeight: 600, mb: 1 }}>
              {isDynamicImportError ? '页面模块更新中' : '页面加载遇到问题'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#7f1d1d', mb: 3 }}>
              {isDynamicImportError
                ? '检测到系统模块或网络临时重连，请点击下方按钮重新加载该页面。'
                : this.state.error?.message || '发生了未预期的错误，请尝试刷新页面。'}
            </Typography>
            <Button
              variant="contained"
              color="error"
              startIcon={<RefreshOutlined />}
              onClick={this.handleReset}
              sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
            >
              刷新并重新加载
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
