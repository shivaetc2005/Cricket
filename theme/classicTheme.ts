import { Theme } from 'expo-router';

export const ClassicTheme = {
  dark: true,
  colors: {
    primary: '#FFFFFF',
    background: '#000000',
    card: '#000000',
    text: '#FFFFFF',
    border: '#333333',
    notification: '#FF6200',
  },
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '900' as const,
    },
  },
} as Theme;