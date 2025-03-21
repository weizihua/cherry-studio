export interface NodeAppType {
  id: string
  name: string
  type: string
  description?: string
  author?: string
  homepage?: string
  repositoryUrl?: string
  port?: number
  installCommand?: string
  buildCommand?: string
  startCommand?: string
  isInstalled: boolean
  isRunning: boolean
  url?: string
}
