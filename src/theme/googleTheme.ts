import { createTheme } from '@mui/material/styles';

export const googleMuiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1a73e8', // Google Blue
      light: '#4285f4',
      dark: '#0d47a1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#34a853', // Google Green
      light: '#5bb974',
      dark: '#1e8e3e',
      contrastText: '#ffffff',
    },
    error: {
      main: '#ea4335', // Google Red
      light: '#f28b82',
      dark: '#c5221f',
    },
    warning: {
      main: '#fbbc04', // Google Yellow
      light: '#fdd663',
      dark: '#f29900',
    },
    info: {
      main: '#1a73e8',
    },
    success: {
      main: '#34a853',
    },
    background: {
      default: '#f8f9fa', // Google subtle gray surface
      paper: '#ffffff',
    },
    text: {
      primary: '#202124', // Google High-emphasis text
      secondary: '#5f6368', // Google Medium-emphasis text
    },
    divider: '#dadce0',
  },
  typography: {
    fontFamily: [
      'Google Sans',
      'Roboto',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Arial',
      'sans-serif',
    ].join(','),
    h4: {
      fontWeight: 600,
      letterSpacing: -0.5,
    },
    h5: {
      fontWeight: 600,
      letterSpacing: -0.25,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid #dadce0',
          boxShadow: '0 1px 2px 0 rgba(60,64,67,0.06), 0 2px 6px 2px rgba(60,64,67,0.04)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
  },
});
