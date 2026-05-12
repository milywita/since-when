import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import {
  type AppTheme,
  createAppTheme,
  midnightMinimalPalette,
  pastelLightPalette,
} from './themes';

const darkTheme = createAppTheme(midnightMinimalPalette);
const lightTheme = createAppTheme(pastelLightPalette);

type ThemeContextValue = {
  theme: AppTheme;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  // null = follow system, 'light' | 'dark' = manual override
  const [manualScheme, setManualScheme] = useState<'light' | 'dark' | null>(null);

  const resolvedScheme = manualScheme ?? systemScheme ?? 'dark';
  const isDark = resolvedScheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = useCallback(() => {
    setManualScheme(prev => {
      const current = prev ?? systemScheme ?? 'dark';
      return current === 'dark' ? 'light' : 'dark';
    });
  }, [systemScheme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): AppTheme {
  return useContext(ThemeContext).theme;
}

export function useThemeToggle(): { isDark: boolean; toggleTheme: () => void } {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  return { isDark, toggleTheme };
}
