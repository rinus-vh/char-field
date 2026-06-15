import { createContext, useContext } from 'react'

export const CharFieldContext = createContext(null)

export function useCharFieldContext() {
  const ctx = useContext(CharFieldContext)
  if (!ctx) throw new Error('useCharFieldContext must be used within CharFieldContextProvider')
  return ctx
}
