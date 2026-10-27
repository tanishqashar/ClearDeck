import { createContext, useContext } from 'react';

export const ThemeModeContext = createContext(null);

export function useThemeMode() {
    return useContext(ThemeModeContext);
}
