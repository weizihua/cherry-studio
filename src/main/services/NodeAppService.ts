import { exec, spawn } from 'child_process'
import log from 'electron-log'
import { app } from 'electron'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from 'events'
import { NodeAppType } from '@types'
import { getBinaryPath, isBinaryExists, runInstallScript } from '@main/utils/process'
import { getResourcePath } from '@main/utils'
import { configManager } from './ConfigManager'

const execAsync = promisify(exec)

/**
 * Service for managing Node.js applications in Cherry Studio
 */
export default class NodeAppService extends EventEmitter {
  private static instance: NodeAppService | null = null
  private nodeApps: NodeAppType[] = []
  private runningApps: Map<string, any> = new Map()
  private appsDir: string
  private initialized = false
  private nodePath: string = 'node'
  private npmPath: string = 'npm'
  private hasInternalNode: boolean = false

  constructor() {
    super()
    this.appsDir = path.join(app.getPath('userData'), 'node-apps')
    this.ensureAppDirectory()
    this.initializeNodeEnvironment()
  }

  /**
   * Get the singleton instance of NodeAppService
   */
  public static getInstance(): NodeAppService {
    if (!NodeAppService.instance) {
      NodeAppService.instance = new NodeAppService()
    }
    return NodeAppService.instance
  }

  /**
   * Ensure the apps directory exists
   */
  private ensureAppDirectory(): void {
    try {
      fs.ensureDirSync(this.appsDir)
      log.info(`[NodeAppService] Apps directory exists at: ${this.appsDir}`)
    } catch (err) {
      log.error('[NodeAppService] Failed to create apps directory:', err)
    }
  }

  /**
   * Initialize the service
   */
  public async init(): Promise<void> {
    if (this.initialized) return

    try {
      log.info('[NodeAppService] Initializing...')

      // Load installed apps
      await this.loadInstalledApps()

      this.initialized = true
      log.info('[NodeAppService] Initialization complete')
    } catch (err) {
      log.error('[NodeAppService] Initialization failed:', err)
      throw err
    }
  }

  /**
   * Load all installed Node.js apps
   */
  private async loadInstalledApps(): Promise<void> {
    try {
      const appDirs = await fs.readdir(this.appsDir)

      const loadPromises = appDirs.map(async (dirName) => {
        const appDir = path.join(this.appsDir, dirName)
        const stats = await fs.stat(appDir)

        if (stats.isDirectory()) {
          const metadataPath = path.join(appDir, 'metadata.json')

          if (await fs.pathExists(metadataPath)) {
            const metadata = await fs.readJson(metadataPath)
            return {
              ...metadata,
              isInstalled: true,
              isRunning: this.runningApps.has(metadata.id)
            } as NodeAppType
          }
        }
        return null
      })

      const loadedApps = (await Promise.all(loadPromises)).filter(Boolean) as NodeAppType[]
      this.nodeApps = loadedApps

      log.info(`[NodeAppService] Loaded ${loadedApps.length} installed apps`)
    } catch (err) {
      log.error('[NodeAppService] Failed to load installed apps:', err)
      throw err
    }
  }

  /**
   * Get all registered Node.js apps
   */
  public async getAllApps(): Promise<NodeAppType[]> {
    if (!this.initialized) {
      await this.init()
    }
    return this.nodeApps
  }

  /**
   * Add a new Node.js app from repository
   */
  public async addApp(app: NodeAppType): Promise<NodeAppType> {
    if (!this.initialized) {
      await this.init()
    }

    // Generate ID if not provided
    const newApp: NodeAppType = {
      ...app,
      id: app.id || uuidv4(),
      isInstalled: false,
      isRunning: false
    }

    // Add to the list
    this.nodeApps.push(newApp)

    // Notify of change
    this.emit('apps-updated', this.nodeApps)

    return newApp
  }

  /**
   * Install a Node.js app from repository
   */
  public async installApp(appId: string): Promise<NodeAppType | null> {
    if (!this.initialized) {
      await this.init()
    }

    const app = this.nodeApps.find(app => app.id === appId)
    if (!app || !app.repositoryUrl) {
      log.error(`[NodeAppService] App with ID ${appId} not found or missing repository URL`)
      return null
    }

    try {
      log.info(`[NodeAppService] Installing app ${app.name} from ${app.repositoryUrl}`)

      // Create app directory
      const appDir = path.join(this.appsDir, appId.toString())
      await fs.ensureDir(appDir)

      // Clone repository
      await execAsync(`git clone ${app.repositoryUrl} "${appDir}"`)

      // Run install command if specified, otherwise use default npm install
      const installCommand = app.installCommand || 'npm install'
      await execAsync(installCommand, { cwd: appDir })

      // Save metadata
      const metadata: NodeAppType = {
        ...app,
        isInstalled: true,
        isRunning: false
      }

      await fs.writeJson(path.join(appDir, 'metadata.json'), metadata, { spaces: 2 })

      // Update app in the list
      const appIndex = this.nodeApps.findIndex(a => a.id === appId)
      if (appIndex !== -1) {
        this.nodeApps[appIndex] = metadata
      }

      // Notify of change
      this.emit('apps-updated', this.nodeApps)

      log.info(`[NodeAppService] Successfully installed app ${app.name}`)
      return metadata
    } catch (err) {
      log.error(`[NodeAppService] Failed to install app ${app.name}:`, err)
      // Clean up failed installation
      try {
        const appDir = path.join(this.appsDir, appId.toString())
        await fs.remove(appDir)
      } catch (cleanupErr) {
        log.error('[NodeAppService] Failed to clean up after installation error:', cleanupErr)
      }
      throw err
    }
  }

  /**
   * Update an existing app
   */
  public async updateApp(appId: string): Promise<NodeAppType | null> {
    if (!this.initialized) {
      await this.init()
    }

    const app = this.nodeApps.find(app => app.id === appId)
    if (!app || !app.isInstalled) {
      log.error(`[NodeAppService] App with ID ${appId} not found or not installed`)
      return null
    }

    try {
      log.info(`[NodeAppService] Updating app ${app.name}`)

      const appDir = path.join(this.appsDir, appId.toString())

      // Pull latest changes
      await execAsync('git pull', { cwd: appDir })

      // Update dependencies
      const installCommand = app.installCommand || 'npm install'
      await execAsync(installCommand, { cwd: appDir })

      log.info(`[NodeAppService] Successfully updated app ${app.name}`)
      return app
    } catch (err) {
      log.error(`[NodeAppService] Failed to update app ${app.name}:`, err)
      throw err
    }
  }

  /**
   * Start a Node.js app
   */
  public async startApp(appId: string): Promise<{ port: number; url: string } | null> {
    if (!this.initialized) {
      await this.init()
    }

    const app = this.nodeApps.find(app => app.id === appId)
    if (!app || !app.isInstalled) {
      log.error(`[NodeAppService] App with ID ${appId} not found or not installed`)
      return null
    }

    if (this.runningApps.has(appId)) {
      log.warn(`[NodeAppService] App ${app.name} is already running`)
      const existingApp = this.runningApps.get(appId)
      return {
        port: existingApp.port,
        url: `http://localhost:${existingApp.port}`
      }
    }

    try {
      log.info(`[NodeAppService] Starting app ${app.name}`)

      const appDir = path.join(this.appsDir, appId.toString())

      // Determine port to use
      const port = app.port || await this.findAvailablePort(3000)

      // Set environment variables for the app
      const env: any = {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'production'
      }

      // Start command (default to npm start if not specified)
      const startCommand = app.startCommand || 'npm start'
      const [cmd, ...args] = startCommand.split(' ')

      // Start the process
      const childProcess = spawn(cmd, args, {
        cwd: appDir,
        env,
        shell: true
      })

      // Log output
      childProcess.stdout.on('data', (data) => {
        log.info(`[${app.name}] ${data.toString().trim()}`)
      })

      childProcess.stderr.on('data', (data) => {
        log.error(`[${app.name}] ${data.toString().trim()}`)
      })

      // Handle process exit
      childProcess.on('close', (code) => {
        log.info(`[NodeAppService] App ${app.name} exited with code ${code}`)
        this.runningApps.delete(appId)

        // Update the app status
        const appIndex = this.nodeApps.findIndex(a => a.id === appId)
        if (appIndex !== -1) {
          this.nodeApps[appIndex] = {
            ...this.nodeApps[appIndex],
            isRunning: false
          }
        }

        this.emit('apps-updated', this.nodeApps)
      })

      // Store the running app information
      this.runningApps.set(appId, {
        process: childProcess,
        port
      })

      // Update the app status
      const appIndex = this.nodeApps.findIndex(a => a.id === appId)
      if (appIndex !== -1) {
        this.nodeApps[appIndex] = {
          ...this.nodeApps[appIndex],
          isRunning: true
        }
      }

      // Notify of status change
      this.emit('apps-updated', this.nodeApps)

      // Wait for app to start by checking the port
      await this.waitForPortToBeReady(port, 30)

      log.info(`[NodeAppService] App ${app.name} started on port ${port}`)
      return {
        port,
        url: `http://localhost:${port}`
      }
    } catch (err) {
      log.error(`[NodeAppService] Failed to start app ${app.name}:`, err)

      // Clean up if process was started
      if (this.runningApps.has(appId)) {
        const runningApp = this.runningApps.get(appId)
        if (runningApp.process) {
          runningApp.process.kill()
        }
        this.runningApps.delete(appId)
      }

      throw err
    }
  }

  /**
   * Stop a running Node.js app
   */
  public async stopApp(appId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.init()
    }

    const app = this.nodeApps.find(app => app.id === appId)
    if (!app) {
      log.error(`[NodeAppService] App with ID ${appId} not found`)
      return false
    }

    if (!this.runningApps.has(appId)) {
      log.warn(`[NodeAppService] App ${app.name} is not running`)
      return false
    }

    try {
      log.info(`[NodeAppService] Stopping app ${app.name}`)

      const runningApp = this.runningApps.get(appId)

      if (runningApp && runningApp.process) {
        // Kill the process
        runningApp.process.kill()
        this.runningApps.delete(appId)

        // Update the app status
        const appIndex = this.nodeApps.findIndex(a => a.id === appId)
        if (appIndex !== -1) {
          this.nodeApps[appIndex] = {
            ...this.nodeApps[appIndex],
            isRunning: false
          }
        }

        // Notify of status change
        this.emit('apps-updated', this.nodeApps)

        log.info(`[NodeAppService] Successfully stopped app ${app.name}`)
        return true
      }

      return false
    } catch (err) {
      log.error(`[NodeAppService] Failed to stop app ${app.name}:`, err)
      throw err
    }
  }

  /**
   * Uninstall a Node.js app
   */
  public async uninstallApp(appId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.init()
    }

    const app = this.nodeApps.find(app => app.id === appId)
    if (!app || !app.isInstalled) {
      log.error(`[NodeAppService] App with ID ${appId} not found or not installed`)
      return false
    }

    try {
      log.info(`[NodeAppService] Uninstalling app ${app.name}`)

      // Stop the app if it's running
      if (app.isRunning) {
        await this.stopApp(appId)
      }

      // Remove the app directory
      const appDir = path.join(this.appsDir, appId.toString())
      await fs.remove(appDir)

      // Update the app in the list or remove it
      const appIndex = this.nodeApps.findIndex(a => a.id === appId)
      if (appIndex !== -1) {
        this.nodeApps.splice(appIndex, 1)
      }

      // Notify of change
      this.emit('apps-updated', this.nodeApps)

      log.info(`[NodeAppService] Successfully uninstalled app ${app.name}`)
      return true
    } catch (err) {
      log.error(`[NodeAppService] Failed to uninstall app ${app.name}:`, err)
      throw err
    }
  }

  /**
   * Find an available port starting from the given port
   */
  private async findAvailablePort(startPort: number): Promise<number> {
    const isPortAvailable = async (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const net = require('net')
        const server = net.createServer()

        server.once('error', () => {
          resolve(false)
        })

        server.once('listening', () => {
          server.close()
          resolve(true)
        })

        server.listen(port)
      })
    }

    let port = startPort
    while (!(await isPortAvailable(port))) {
      port++
    }

    return port
  }

  /**
   * Wait for a port to be ready (app to start)
   */
  private waitForPortToBeReady(port: number, maxAttempts = 30): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const checkPort = async (attemptsLeft: number) => {
        if (attemptsLeft <= 0) {
          return reject(new Error(`Timeout waiting for port ${port} to be ready`))
        }

        try {
          const net = require('net')
          const socket = new net.Socket()

          const onError = () => {
            socket.destroy()
            setTimeout(() => checkPort(attemptsLeft - 1), 500)
          }

          socket.once('error', onError)
          socket.once('connect', () => {
            socket.destroy()
            resolve()
          })

          socket.connect(port, '127.0.0.1')
        } catch (err) {
          setTimeout(() => checkPort(attemptsLeft - 1), 500)
        }
      }

      checkPort(maxAttempts)
    })
  }

  /**
   * Clean up all running apps when shutting down
   */
  public async cleanup(): Promise<void> {
    log.info('[NodeAppService] Cleaning up running apps')

    const stopPromises = Array.from(this.runningApps.keys()).map(appId =>
      this.stopApp(appId).catch(err => {
        log.error(`[NodeAppService] Error stopping app ${appId} during cleanup:`, err)
      })
    )

    await Promise.all(stopPromises)

    log.info('[NodeAppService] Cleanup complete')
  }

  /**
   * Deploy a Node.js app from a ZIP file
   * @param zipFile Path to the ZIP file containing Node.js app code
   * @param options Optional configuration for the app
   */
  public async deployFromZip(zipFile: string, options?: {
    name?: string;
    port?: number;
    startCommand?: string;
    installCommand?: string;
    buildCommand?: string;
  }): Promise<{ port: number; url: string } | null> {
    try {
      log.info(`[NodeAppService] Deploying app from ZIP file: ${zipFile}`)

      // Generate a unique app ID
      const appId = `app-${Date.now()}`
      const appName = options?.name || `App-${appId}`

      // Create app directory
      const appDir = path.join(this.appsDir, appId)
      await fs.ensureDir(appDir)

      // Extract ZIP content
      const extract = require('extract-zip')
      await new Promise((resolve, reject) => {
        extract(zipFile, { dir: appDir }, (err) => {
          if (err) {
            reject(err)
          } else {
            resolve(null)
          }
        })
      })

      log.info(`[NodeAppService] Extracted ZIP to ${appDir}`)

      // Check if the ZIP contains a single top-level directory (common in GitHub downloads)
      const items = await fs.readdir(appDir)
      if (items.length === 1) {
        const firstItem = path.join(appDir, items[0])
        const stats = await fs.stat(firstItem)

        if (stats.isDirectory()) {
          log.info(`[NodeAppService] ZIP contains a single top-level directory: ${items[0]}`)

          // Move all contents from the subdirectory to the app directory
          const subDirContents = await fs.readdir(firstItem)

          for (const item of subDirContents) {
            const sourcePath = path.join(firstItem, item)
            const destPath = path.join(appDir, item)
            await fs.move(sourcePath, destPath)
          }

          // Remove the now-empty directory
          await fs.remove(firstItem)

          log.info(`[NodeAppService] Moved contents from subdirectory to root app directory`)
        }
      }

      // Check if package.json exists, if not create a simple one
      const packageJsonPath = path.join(appDir, 'package.json')
      let packageJson: any;

      if (!await fs.pathExists(packageJsonPath)) {
        packageJson = {
          name: appName.toLowerCase().replace(/\s+/g, '-'),
          version: '1.0.0',
          description: 'Deployed Node.js app',
          main: 'index.js',
          scripts: {
            start: 'node index.js'
          }
        }

        await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
        log.info(`[NodeAppService] Created package.json as it was missing`)
      } else {
        // Load existing package.json
        packageJson = await fs.readJson(packageJsonPath);

        // Check and fix potential ES modules issues
        try {
          // If we find any .js files using ES module syntax but package.json doesn't have type: "module",
          // add it to help prevent ES module errors
          const jsFiles = await this.findJavaScriptFiles(appDir)
          for (const file of jsFiles) {
            const content = await fs.readFile(file, 'utf8')
            if (content.includes('export default') || content.includes('import ') && !content.includes('require(')) {
              // This file appears to use ES module syntax
              if (!packageJson.type) {
                packageJson.type = "module"
                await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
                log.info(`[NodeAppService] Added "type": "module" to package.json to support ES modules`)
                break
              }
            }
          }
        } catch (error) {
          log.warn(`[NodeAppService] Error checking for ES modules compatibility: ${error}`)
        }

        // Check for Next.js and ensure start script is correct if needed
        if (packageJson.dependencies && (packageJson.dependencies.next || packageJson.devDependencies?.next)) {
          log.info(`[NodeAppService] Detected Next.js application`)

          // Ensure scripts has required commands
          packageJson.scripts = packageJson.scripts || {};
          if (!packageJson.scripts.build) {
            packageJson.scripts.build = "next build";
            log.info(`[NodeAppService] Added 'next build' script to package.json`);
          }
          if (!packageJson.scripts.start) {
            packageJson.scripts.start = "next start";
            log.info(`[NodeAppService] Added 'next start' script to package.json`);
          }

          // 强制添加构建命令，如果是Next.js应用必须先构建
          if (!options?.buildCommand) {
            options = options || {};
            options.buildCommand = "npm run build";
            log.info(`[NodeAppService] Automatically added 'npm run build' step for Next.js application`);
          }

          // 检查next.config.js文件，查看是否使用了standalone输出
          const nextConfigPath = path.join(appDir, 'next.config.js');
          let isStandaloneOutput = false;

          if (fs.existsSync(nextConfigPath)) {
            try {
              const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
              // 简单检测是否包含standalone配置
              isStandaloneOutput = nextConfigContent.includes('output:') &&
                                   nextConfigContent.includes('standalone');

              if (isStandaloneOutput) {
                log.info(`[NodeAppService] Detected Next.js with 'output: standalone' configuration`);
                // 针对standalone模式修改启动命令
                options.startCommand = "node .next/standalone/server.js";
                log.info(`[NodeAppService] Using 'node .next/standalone/server.js' for standalone mode`);
              }
            } catch (error) {
              log.error(`[NodeAppService] Error checking Next.js config:`, error);
            }
          }

          // Save the updated package.json
          await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
        }
      }

      // Check if main file (index.js) exists
      const indexJsPath = path.join(appDir, 'index.js')
      if (!await fs.pathExists(indexJsPath) && !packageJson.dependencies?.next) {
        // Look for any .js file to use as main
        const files = await fs.readdir(appDir)
        const jsFiles = files.filter(file => file.endsWith('.js'))

        if (jsFiles.length > 0) {
          // Update package.json to use the first JS file as main
          packageJson.main = jsFiles[0]
          packageJson.scripts = packageJson.scripts || {}
          packageJson.scripts.start = `node ${jsFiles[0]}`
          await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
          log.info(`[NodeAppService] Updated package.json to use ${jsFiles[0]} as main`)
        } else {
          // No JS files found, create a simple index.js
          const defaultCode = `const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>App deployed from ZIP</h1>');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`

          await fs.writeFile(indexJsPath, defaultCode)
          log.info(`[NodeAppService] Created default index.js as no JS files were found`)
        }
      }

      // Run install command if specified or default
      const installCommand = options?.installCommand || 'npm install'
      log.info(`[NodeAppService] Running install command: ${installCommand}`)

      try {
        if (installCommand.startsWith('npm ')) {
          const npmArgs = installCommand.substring(4).trim()
          await this.runNpmCommand(npmArgs, appDir)
        } else {
          await execAsync(installCommand, { cwd: appDir })
        }
      } catch (error) {
        log.error(`[NodeAppService] Error running install command: ${error}`)
        // Continue despite install error
      }

      // Run build command if specified
      if (options?.buildCommand) {
        log.info(`[NodeAppService] Running build command: ${options.buildCommand}`)
        try {
          // 为Next.js应用设置标准环境变量
          const buildEnv = { ...process.env };

          if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
            log.info(`[NodeAppService] Setting standard environment for Next.js build`);
            buildEnv.NODE_ENV = 'production';
            buildEnv.NEXT_TELEMETRY_DISABLED = '1';
          }

          if (options.buildCommand.startsWith('npm ')) {
            const npmArgs = options.buildCommand.substring(4).trim()
            await this.runNpmCommand(npmArgs, appDir, buildEnv)
          } else {
            await execAsync(options.buildCommand, { cwd: appDir, env: buildEnv })
          }
          log.info(`[NodeAppService] Build completed successfully`)
        } catch (error) {
          log.error(`[NodeAppService] Error running build command: ${error}`)
          // 处理构建失败的情况，特别是Next.js应用
          if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
            // 检查.next目录是否存在且包含必要文件
            const nextDir = path.join(appDir, '.next');
            const prerenderFile = path.join(nextDir, 'prerender-manifest.json');

            if (!await fs.pathExists(prerenderFile)) {
              log.error(`[NodeAppService] Next.js build failed: prerender-manifest.json not found`);
              throw new Error('App build failed. Please fix the code issues and try again.');
            }
          }
        }
      }

      // 针对Next.js应用，在启动前额外检查构建产物
      if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
        const nextDir = path.join(appDir, '.next');

        if (!await fs.pathExists(nextDir)) {
          log.error(`[NodeAppService] Next.js build artifacts not found. Run build first.`);
          throw new Error('Next.js application must be built before starting. Run "npm run build" first.');
        }

        // 检查关键文件
        const prerenderFile = path.join(nextDir, 'prerender-manifest.json');
        if (!await fs.pathExists(prerenderFile)) {
          log.error(`[NodeAppService] prerender-manifest.json not found. Build may have failed.`);
          throw new Error('Next.js build appears to be incomplete. Check for errors in your code.');
        }
      }

      // Determine port to use
      const port = options?.port || await this.findAvailablePort(3000)

      // Set environment variables for the app
      const env: any = {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'production'
      }

      // 为Next.js应用设置特定环境变量
      if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
        env.NEXT_TELEMETRY_DISABLED = '1';

        // 对于standalone模式，设置特定环境变量
        if (options?.startCommand && options.startCommand.includes('.next/standalone/server.js')) {
          env.PORT = port.toString();
          env.HOSTNAME = '0.0.0.0'; // 允许外部访问
        }
      }

      // Start command (default to npm start if not specified)
      const startCommand = options?.startCommand || 'npm start'

      // Special handling for npm commands
      let cmd: string, args: string[]

      if (startCommand.startsWith('npm ')) {
        const npmArgs = startCommand.substring(4).trim()
        cmd = this.hasInternalNode ? this.npmPath : 'npm'
        args = npmArgs.split(' ')
      } else if (startCommand.startsWith('node ')) {
        const nodeArgs = startCommand.substring(5).trim()
        cmd = this.hasInternalNode ? this.nodePath : 'node'
        args = nodeArgs.split(' ')
      } else {
        // Custom command
        const parts = startCommand.split(' ')
        cmd = parts[0]
        args = parts.slice(1)
      }

      log.info(`[NodeAppService] Starting app with command: ${cmd} ${args.join(' ')}`)

      // Start the process
      const childProcess = spawn(cmd, args, {
        cwd: appDir,
        env,
        shell: true
      })

      // Log output
      childProcess.stdout.on('data', (data) => {
        log.info(`[${appName}] ${data.toString().trim()}`)
      })

      childProcess.stderr.on('data', (data) => {
        log.error(`[${appName}] ${data.toString().trim()}`)
      })

      // Generate a metadata file for the app
      const metadata: NodeAppType = {
        id: appId,
        name: appName,
        type: 'node',
        isInstalled: true,
        isRunning: true,
        installCommand,
        buildCommand: options?.buildCommand,
        startCommand,
        port,
        url: `http://localhost:${port}`
      }

      await fs.writeJson(path.join(appDir, 'metadata.json'), metadata, { spaces: 2 })

      // Store the running app information
      this.runningApps.set(appId, {
        process: childProcess,
        port,
        directory: appDir
      })

      // Add to the list of apps
      this.nodeApps.push(metadata)

      // Handle process exit
      childProcess.on('close', (code) => {
        log.info(`[NodeAppService] App ${appName} exited with code ${code}`)
        this.runningApps.delete(appId)

        // Update the app status
        const appIndex = this.nodeApps.findIndex(a => a.id === appId)
        if (appIndex !== -1) {
          this.nodeApps[appIndex] = {
            ...this.nodeApps[appIndex],
            isRunning: false
          }
        }

        this.emit('apps-updated', this.nodeApps)
      })

      // Notify of app creation and status
      this.emit('apps-updated', this.nodeApps)

      // Wait for app to start by checking the port
      await this.waitForPortToBeReady(port, 30)

      log.info(`[NodeAppService] App ${appName} deployed and started on port ${port}`)
      return {
        port,
        url: `http://localhost:${port}`
      }
    } catch (err: any) {
      log.error(`[NodeAppService] Failed to deploy app from ZIP:`, err)

      // 提供更友好的错误信息
      if (err.message && (
          err.message.includes('Next.js') ||
          err.message.includes('prerender-manifest.json') ||
          err.message.includes('build failed')
      )) {
        // 这是一个Next.js构建错误
        throw new Error(`Next.js应用构建失败: ${err.message}. 请修复代码中的错误后重试。常见问题: 1) <Html>元素错误使用 2) 缺少依赖 3) 代码语法错误`);
      }

      return null;
    }
  }

  /**
   * Deploy a Node.js app from a Git repository URL
   * @param repoUrl Git repository URL (e.g. https://github.com/user/repo)
   * @param options Optional configuration for the app
   */
  public async deployFromGit(repoUrl: string, options?: {
    name?: string;
    port?: number;
    startCommand?: string;
    installCommand?: string;
    buildCommand?: string;
  }): Promise<{ port: number; url: string } | null> {
    try {
      log.info(`[NodeAppService] Deploying app from Git repository: ${repoUrl}`)

      // Generate a unique app ID
      const appId = `app-${Date.now()}`

      // Extract repo name from URL for better naming
      let appName = options?.name;
      if (!appName) {
        try {
          // Try to extract name from URL
          const urlParts = repoUrl.split('/');
          const repoName = urlParts[urlParts.length - 1].replace('.git', '') ||
                         urlParts[urlParts.length - 2] ||
                         `App-${appId}`;
          appName = repoName;
        } catch (e) {
          appName = `App-${appId}`;
        }
      }

      // Create app directory
      const appDir = path.join(this.appsDir, appId)
      await fs.ensureDir(appDir)

      // Clone the repository
      log.info(`[NodeAppService] Cloning repository to ${appDir}`)
      await execAsync(`git clone ${repoUrl} "${appDir}"`)

      // Check if package.json exists
      const packageJsonPath = path.join(appDir, 'package.json')
      let packageJson: any;

      if (!await fs.pathExists(packageJsonPath)) {
        log.error(`[NodeAppService] package.json not found in the repository`)
        throw new Error('Repository does not contain a package.json file');
      } else {
        // Load existing package.json
        packageJson = await fs.readJson(packageJsonPath);

        // Check for Next.js and ensure start script is correct if needed
        if (packageJson.dependencies && (packageJson.dependencies.next || packageJson.devDependencies?.next)) {
          log.info(`[NodeAppService] Detected Next.js application`)

          // Ensure scripts has required commands
          packageJson.scripts = packageJson.scripts || {};
          if (!packageJson.scripts.build) {
            packageJson.scripts.build = "next build";
            log.info(`[NodeAppService] Added 'next build' script to package.json`);
          }
          if (!packageJson.scripts.start) {
            packageJson.scripts.start = "next start";
            log.info(`[NodeAppService] Added 'next start' script to package.json`);
          }

          // 强制添加构建命令，如果是Next.js应用必须先构建
          if (!options?.buildCommand) {
            options = options || {};
            options.buildCommand = "npm run build";
            log.info(`[NodeAppService] Automatically added 'npm run build' step for Next.js application`);
          }

          // 检查next.config.js文件，查看是否使用了standalone输出
          const nextConfigPath = path.join(appDir, 'next.config.js');
          let isStandaloneOutput = false;

          if (fs.existsSync(nextConfigPath)) {
            try {
              const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
              // 简单检测是否包含standalone配置
              isStandaloneOutput = nextConfigContent.includes('output:') &&
                                   nextConfigContent.includes('standalone');

              if (isStandaloneOutput) {
                log.info(`[NodeAppService] Detected Next.js with 'output: standalone' configuration`);
                // 针对standalone模式修改启动命令
                options.startCommand = "node .next/standalone/server.js";
                log.info(`[NodeAppService] Using 'node .next/standalone/server.js' for standalone mode`);
              }
            } catch (error) {
              log.error(`[NodeAppService] Error checking Next.js config:`, error);
            }
          }

          // Save the updated package.json
          await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
        }
      }

      // Run install command if specified or default
      const installCommand = options?.installCommand || 'npm install'
      log.info(`[NodeAppService] Running install command: ${installCommand}`)

      try {
        if (installCommand.startsWith('npm ')) {
          const npmArgs = installCommand.substring(4).trim()
          await this.runNpmCommand(npmArgs, appDir)
        } else {
          await execAsync(installCommand, { cwd: appDir })
        }
      } catch (error) {
        log.error(`[NodeAppService] Error running install command: ${error}`)
        // Continue despite install error
      }

      // Run build command if specified
      if (options?.buildCommand) {
        log.info(`[NodeAppService] Running build command: ${options.buildCommand}`)
        try {
          // 为Next.js应用设置标准环境变量
          const buildEnv = { ...process.env };

          if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
            log.info(`[NodeAppService] Setting standard environment for Next.js build`);
            buildEnv.NODE_ENV = 'production';
            buildEnv.NEXT_TELEMETRY_DISABLED = '1';
          }

          if (options.buildCommand.startsWith('npm ')) {
            const npmArgs = options.buildCommand.substring(4).trim()
            await this.runNpmCommand(npmArgs, appDir, buildEnv)
          } else {
            await execAsync(options.buildCommand, { cwd: appDir, env: buildEnv })
          }
          log.info(`[NodeAppService] Build completed successfully`)
        } catch (error) {
          log.error(`[NodeAppService] Error running build command: ${error}`)
          // 处理构建失败的情况，特别是Next.js应用
          if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
            // 检查.next目录是否存在且包含必要文件
            const nextDir = path.join(appDir, '.next');
            const prerenderFile = path.join(nextDir, 'prerender-manifest.json');

            if (!await fs.pathExists(prerenderFile)) {
              log.error(`[NodeAppService] Next.js build failed: prerender-manifest.json not found`);
              throw new Error('App build failed. Please fix the code issues and try again.');
            }
          }
        }
      }

      // 针对Next.js应用，在启动前额外检查构建产物
      if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
        const nextDir = path.join(appDir, '.next');

        if (!await fs.pathExists(nextDir)) {
          log.error(`[NodeAppService] Next.js build artifacts not found. Run build first.`);
          throw new Error('Next.js application must be built before starting. Run "npm run build" first.');
        }

        // 检查关键文件
        const prerenderFile = path.join(nextDir, 'prerender-manifest.json');
        if (!await fs.pathExists(prerenderFile)) {
          log.error(`[NodeAppService] prerender-manifest.json not found. Build may have failed.`);
          throw new Error('Next.js build appears to be incomplete. Check for errors in your code.');
        }
      }

      // Determine port to use
      const port = options?.port || await this.findAvailablePort(3000)

      // Set environment variables for the app
      const env: any = {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'production'
      }

      // 为Next.js应用设置特定环境变量
      if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
        env.NEXT_TELEMETRY_DISABLED = '1';

        // 对于standalone模式，设置特定环境变量
        if (options?.startCommand && options.startCommand.includes('.next/standalone/server.js')) {
          env.PORT = port.toString();
          env.HOSTNAME = '0.0.0.0'; // 允许外部访问
        }
      }

      // Start command (default to npm start if not specified)
      const startCommand = options?.startCommand || 'npm start'

      // Special handling for npm commands
      let cmd: string, args: string[]

      if (startCommand.startsWith('npm ')) {
        const npmArgs = startCommand.substring(4).trim()
        cmd = this.hasInternalNode ? this.npmPath : 'npm'
        args = npmArgs.split(' ')
      } else if (startCommand.startsWith('node ')) {
        const nodeArgs = startCommand.substring(5).trim()
        cmd = this.hasInternalNode ? this.nodePath : 'node'
        args = nodeArgs.split(' ')
      } else {
        // Custom command
        const parts = startCommand.split(' ')
        cmd = parts[0]
        args = parts.slice(1)
      }

      log.info(`[NodeAppService] Starting app with command: ${cmd} ${args.join(' ')}`)

      // Start the process
      const childProcess = spawn(cmd, args, {
        cwd: appDir,
        env,
        shell: true
      })

      // Log output
      childProcess.stdout.on('data', (data) => {
        log.info(`[${appName}] ${data.toString().trim()}`)
      })

      childProcess.stderr.on('data', (data) => {
        log.error(`[${appName}] ${data.toString().trim()}`)
      })

      // Generate a metadata file for the app
      const metadata: NodeAppType = {
        id: appId,
        name: appName,
        type: 'node',
        isInstalled: true,
        isRunning: true,
        repositoryUrl: repoUrl, // 记录仓库URL，以便后续更新
        installCommand,
        buildCommand: options?.buildCommand,
        startCommand,
        port,
        url: `http://localhost:${port}`
      }

      await fs.writeJson(path.join(appDir, 'metadata.json'), metadata, { spaces: 2 })

      // Store the running app information
      this.runningApps.set(appId, {
        process: childProcess,
        port,
        directory: appDir
      })

      // Add to the list of apps
      this.nodeApps.push(metadata)

      // Handle process exit
      childProcess.on('close', (code) => {
        log.info(`[NodeAppService] App ${appName} exited with code ${code}`)
        this.runningApps.delete(appId)

        // Update the app status
        const appIndex = this.nodeApps.findIndex(a => a.id === appId)
        if (appIndex !== -1) {
          this.nodeApps[appIndex] = {
            ...this.nodeApps[appIndex],
            isRunning: false
          }
        }

        this.emit('apps-updated', this.nodeApps)
      })

      // Notify of app creation and status
      this.emit('apps-updated', this.nodeApps)

      // Wait for app to start by checking the port
      await this.waitForPortToBeReady(port, 30)

      log.info(`[NodeAppService] App ${appName} deployed from Git and started on port ${port}`)
      return {
        port,
        url: `http://localhost:${port}`
      }
    } catch (err: any) {
      log.error(`[NodeAppService] Failed to deploy app from Git:`, err)

      // 提供更友好的错误信息
      if (err.message && (
          err.message.includes('Next.js') ||
          err.message.includes('prerender-manifest.json') ||
          err.message.includes('build failed')
      )) {
        // 这是一个Next.js构建错误
        throw new Error(`Next.js应用构建失败: ${err.message}. 请修复代码中的错误后重试。常见问题: 1) <Html>元素错误使用 2) 缺少依赖 3) 代码语法错误`);
      }

      if (err.message && err.message.includes('git clone')) {
        throw new Error(`Git仓库克隆失败: ${err.message}. 请检查仓库地址是否正确，以及是否为公开仓库。`);
      }

      return null;
    }
  }

  /**
   * Find JavaScript files in a directory recursively
   */
  private async findJavaScriptFiles(dir: string): Promise<string[]> {
    let results: string[] = []
    const items = await fs.readdir(dir)

    for (const item of items) {
      const itemPath = path.join(dir, item)
      const stats = await fs.stat(itemPath)

      if (stats.isDirectory()) {
        // Skip node_modules
        if (item === 'node_modules') {
          continue
        }
        const subDirResults = await this.findJavaScriptFiles(itemPath)
        results = results.concat(subDirResults)
      } else if (item.endsWith('.js') || item.endsWith('.mjs')) {
        results.push(itemPath)
      }
    }

    return results
  }

  /**
   * Initialize the Node.js environment
   * Check if internal Node.js exists, if not, use system Node.js
   */
  private async initializeNodeEnvironment(): Promise<void> {
    try {
      // Try to get internal Node.js path
      const hasNode = await isBinaryExists('node')
      const hasNpm = await isBinaryExists('npm')

      if (hasNode) {
        this.nodePath = await getBinaryPath('node')
        log.info(`[NodeAppService] Using internal Node.js: ${this.nodePath}`)
        this.hasInternalNode = true
      } else {
        log.info(`[NodeAppService] Internal Node.js not found, using system Node.js`)
      }

      if (hasNpm) {
        this.npmPath = await getBinaryPath('npm')
        log.info(`[NodeAppService] Using internal npm: ${this.npmPath}`)
      } else {
        log.info(`[NodeAppService] Internal npm not found, using system npm`)
      }

      // If no internal Node.js, check system Node.js
      if (!this.hasInternalNode) {
        try {
          await execAsync('node --version')
          log.info(`[NodeAppService] System Node.js is available`)
        } catch (error) {
          log.error(`[NodeAppService] No Node.js available in system`)
          // TODO: Show error to user or try to install Node.js
        }
      }
    } catch (error) {
      log.error(`[NodeAppService] Error initializing Node.js environment:`, error)
    }
  }

  /**
   * Install internal Node.js if not exists
   */
  public async installNodeJs(): Promise<boolean> {
    try {
      log.info(`[NodeAppService] Installing internal Node.js`)

      // 从配置中获取要安装的Node.js版本
      const nodeVersion = configManager.get('NODE_VERSION') || '18.18.0' // 默认版本

      // 使用环境变量传递版本信息
      const env = {
        ...process.env,
        NODE_VERSION: String(nodeVersion)
      }

      // 运行安装脚本
      await runInstallScript('install-node.js', env)

      // 将当前安装的版本保存到配置中
      configManager.set('NODE_VERSION', nodeVersion)

      // 检查安装是否成功
      const hasNode = await isBinaryExists('node')
      if (hasNode) {
        this.nodePath = await getBinaryPath('node')
        this.hasInternalNode = true
        log.info(`[NodeAppService] Internal Node.js v${nodeVersion} installed successfully: ${this.nodePath}`)
        return true
      } else {
        log.error(`[NodeAppService] Failed to install internal Node.js v${nodeVersion}`)
        return false
      }
    } catch (error) {
      log.error(`[NodeAppService] Error installing internal Node.js:`, error)
      return false
    }
  }

  private async runNpmCommand(command: string, cwd: string, env?: any): Promise<string> {
    try {
      // Use the appropriate npm path
      const npmCmd = this.hasInternalNode ? this.npmPath : 'npm'

      const { stdout, stderr } = await execAsync(`"${npmCmd}" ${command}`, { cwd, env })
      if (stderr) {
        log.warn(`[NodeAppService] npm command warning: ${stderr}`)
      }
      return stdout
    } catch (error) {
      log.error(`[NodeAppService] Error running npm command: ${error}`)
      throw error
    }
  }
}
