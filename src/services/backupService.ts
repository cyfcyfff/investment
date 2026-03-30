import { db } from '../db'
import type { AssetHolding, Transaction, PortfolioSnapshot, AppConfig, RebalanceConfig } from '../types'
import { DEFAULT_REBALANCE_CONFIG, DEFAULT_APP_CONFIG } from '../types'

const BACKUP_VERSION = '1.0'

export interface BackupData {
  version: string
  exportDate: string
  holdings: AssetHolding[]
  transactions: Transaction[]
  snapshots: PortfolioSnapshot[]
  appConfig: AppConfig
  rebalanceConfig: RebalanceConfig
}

/**
 * Collect all data from IndexedDB and localStorage into a backup object.
 */
export async function exportAllToJson(): Promise<BackupData> {
  const [holdings, transactions, snapshots] = await Promise.all([
    db.holdings.toArray(),
    db.transactions.toArray(),
    db.snapshots.toArray(),
  ])

  const appConfig = loadConfigFromStorage('permport_app_config', DEFAULT_APP_CONFIG)
  const rebalanceConfig = loadConfigFromStorage('permport_rebalance_config', DEFAULT_REBALANCE_CONFIG)

  return {
    version: BACKUP_VERSION,
    exportDate: new Date().toISOString(),
    holdings,
    transactions,
    snapshots,
    appConfig,
    rebalanceConfig,
  }
}

/**
 * Import backup data into IndexedDB and localStorage.
 * Clears existing data before importing.
 */
export async function importFromData(data: BackupData): Promise<void> {
  if (!data.version) {
    throw new Error('无效的备份文件：缺少 version 字段')
  }

  // Clear existing data
  await db.holdings.clear()
  await db.transactions.clear()
  await db.snapshots.clear()

  // Import holdings
  if (Array.isArray(data.holdings)) {
    for (const h of data.holdings) {
      if (h.id && h.ticker) {
        await db.holdings.add(h)
      }
    }
  }

  // Import transactions
  if (Array.isArray(data.transactions)) {
    for (const t of data.transactions) {
      if (t.id) {
        await db.transactions.add(t)
      }
    }
  }

  // Import snapshots
  if (Array.isArray(data.snapshots)) {
    for (const s of data.snapshots) {
      if (s.id) {
        await db.snapshots.add(s)
      }
    }
  }

  // Import configs
  if (data.appConfig) {
    saveConfigToStorage('permport_app_config', data.appConfig)
  }
  if (data.rebalanceConfig) {
    saveConfigToStorage('permport_rebalance_config', data.rebalanceConfig)
  }
}

/**
 * Request a file handle from the user for saving backup.
 */
export async function requestBackupFileHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const [handle] = await (window as any).showSaveFilePicker({
      suggestedName: `permport-backup-${new Date().toISOString().slice(0, 10)}.json`,
      types: [{
        description: 'JSON 文件',
        accept: { 'application/json': ['.json'] },
      }],
    })
    return handle
  } catch {
    return null
  }
}

/**
 * Write backup data to an existing file handle.
 */
export async function writeToExistingHandle(handle: FileSystemFileHandle, data: BackupData): Promise<boolean> {
  try {
    const json = JSON.stringify(data, null, 2)
    const writable = await handle.createWritable()
    const writer = writable.getWriter()
    await writer.write(json)
    await writer.close()
    return true
  } catch (e) {
    console.warn('[Backup] 写入文件失败:', e)
    return false
  }
}

/**
 * Save backup data to a file chosen by the user.
 */
export async function saveToFile(data: BackupData): Promise<boolean> {
  try {
    const handle = await requestBackupFileHandle()
    if (!handle) return false
    return await writeToExistingHandle(handle, data)
  } catch (e) {
    console.warn('[Backup] 保存失败:', e)
    return false
  }
}

/**
 * Load backup data from a file chosen by the user.
 */
export async function loadFromFile(): Promise<BackupData | null> {
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{
        description: 'JSON 文件',
        accept: { 'application/json': ['.json'] },
      }],
    })
    const file = await handle.getFile()
    const text = await file.text()
    const data = JSON.parse(text) as BackupData
    return data
  } catch (e) {
    console.warn('[Backup] 读取文件失败:', e)
    return null
  }
}

/**
 * Fallback: download backup as a file using traditional approach.
 */
export function downloadBackup(data: BackupData): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `permport-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// -- helpers --

function loadConfigFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function saveConfigToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}
