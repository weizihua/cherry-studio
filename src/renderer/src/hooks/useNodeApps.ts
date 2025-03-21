import { NodeAppType } from '@renderer/types'
import { useCallback, useEffect, useState } from 'react'

export function useNodeApps() {
  const [apps, setApps] = useState<NodeAppType[]>([])
  const [loading, setLoading] = useState(true)

  // Load apps
  const loadApps = useCallback(async () => {
    try {
      setLoading(true)
      const result = await window.api.nodeapp.list()
      setApps(result || [])
    } catch (error) {
      console.error('Error loading node apps:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Add app
  const addApp = useCallback(async (app: NodeAppType) => {
    const result = await window.api.nodeapp.add(app)
    await loadApps()
    return result
  }, [loadApps])

  // Install app
  const installApp = useCallback(async (appId: string) => {
    const result = await window.api.nodeapp.install(appId)
    await loadApps()
    return result
  }, [loadApps])

  // Update app
  const updateApp = useCallback(async (appId: string) => {
    const result = await window.api.nodeapp.update(appId)
    await loadApps()
    return result
  }, [loadApps])

  // Start app
  const startApp = useCallback(async (appId: string) => {
    const result = await window.api.nodeapp.start(appId)
    await loadApps()
    return result
  }, [loadApps])

  // Stop app
  const stopApp = useCallback(async (appId: string) => {
    const result = await window.api.nodeapp.stop(appId)
    await loadApps()
    return result
  }, [loadApps])

  // Uninstall app
  const uninstallApp = useCallback(async (appId: string) => {
    const result = await window.api.nodeapp.uninstall(appId)
    await loadApps()
    return result
  }, [loadApps])

  // Initialize
  useEffect(() => {
    loadApps()

    // Subscribe to app updates
    const unsubscribe = window.api.nodeapp.onUpdated((updatedApps) => {
      setApps(updatedApps || [])
    })

    return () => {
      unsubscribe()
    }
  }, [loadApps])

  return {
    apps,
    loading,
    addApp,
    installApp,
    updateApp,
    startApp,
    stopApp,
    uninstallApp,
    refresh: loadApps
  }
}
