import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type System = 'hoz' | 'mwsal' | null

interface UserPermissions {
  canViewInventory: boolean
  canViewAlerts: boolean
  canViewExpiring: boolean
  canViewLifeSaving: boolean
  canViewVaccines: boolean
  canViewStrategic: boolean
  canViewSmoking: boolean
  canViewKidney: boolean
  canViewCentral: boolean
  canViewReports: boolean
  canViewHoz: boolean
  canViewMwsal: boolean
}

interface UserInfo {
  id: string
  name: string
  permissions: UserPermissions
}

interface AppState {
  selectedSystem: System
  showWelcome: boolean
  user: UserInfo | null
  isAuthenticated: boolean
  setSelectedSystem: (system: System) => void
  setShowWelcome: (show: boolean) => void
  resetWelcome: () => void
  setUser: (user: UserInfo | null) => void
  logout: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedSystem: null,
      showWelcome: true,
      user: null,
      isAuthenticated: false,
      setSelectedSystem: (s) => set({ selectedSystem: s, showWelcome: false }),
      setShowWelcome: (b) => set({ showWelcome: b }),
      resetWelcome: () => set({ showWelcome: true, selectedSystem: null }),
      setUser: (user) => set({ user, isAuthenticated: !!user, showWelcome: !user }),
      logout: () => set({ user: null, isAuthenticated: false, showWelcome: true, selectedSystem: null }),
    }),
    { name: 'inventory-storage' }
  )
)
