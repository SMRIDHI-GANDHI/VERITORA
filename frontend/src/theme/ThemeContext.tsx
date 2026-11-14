import { createContext } from 'react'

export type Theme = 'light' | 'dark' | 'system'

export type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolved: 'light' | 'dark'
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)