import { createContext, useContext } from 'react';

export const KeyboardVisibilityContext = createContext(false);

export function useKeyboardVisibility() {
  return useContext(KeyboardVisibilityContext);
}
