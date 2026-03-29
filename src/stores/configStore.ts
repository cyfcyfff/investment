import { create } from 'zustand'
import { DEFAULT_REBALANCE_CONFIG, DEFAULT_APP_CONFIG } from '../types'
import type { RebalanceConfig, AppConfig } from '../types'

const STORAGE_KEY_CONFIG = 'permport_rebalance_config'
const STORAGE_KEY_APP = 'permport_app_config'

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

interface ConfigState {
  rebalanceConfig: RebalanceConfig
  appConfig: AppConfig
  updateRebalanceConfig: (updates: Partial<RebalanceConfig>) => void
  updateAppConfig: (updates: Partial<AppConfig>) => void
  resetToDefaults: () => void
}

export const useConfigStore = create<ConfigState>((set) => ({
  rebalanceConfig: loadFromStorage(STORAGE_KEY_CONFIG, DEFAULT_REBALANCE_CONFIG),
  appConfig: loadFromStorage(STORAGE_KEY_APP, DEFAULT_APP_CONFIG),
  updateRebalanceConfig: (updates) => {
    set(state => {
      const next = { ...state.rebalanceConfig, ...updates }
      saveToStorage(STORAGE_KEY_CONFIG, next)
      return { rebalanceConfig: next }
    })
  },
  updateAppConfig: (updates) => {
    set(state => {
      const next = { ...state.appConfig, ...updates }
      saveToStorage(STORAGE_KEY_APP, next)
      return { appConfig: next }
    })
  },
  resetToDefaults: () => {
    saveToStorage(STORAGE_KEY_CONFIG, DEFAULT_REBALANCE_CONFIG)
    saveToStorage(STORAGE_KEY_APP, DEFAULT_APP_CONFIG)
    set({ rebalanceConfig: DEFAULT_REBALANCE_CONFIG, appConfig: DEFAULT_APP_CONFIG })
  },
}))
