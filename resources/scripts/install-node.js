const fs = require('fs')
const path = require('path')
const os = require('os')
const https = require('https')
const { execSync } = require('child_process')

// 配置
const NODE_VERSION = process.env.NODE_VERSION || '18.18.0' // 默认版本
const NODE_RELEASE_BASE_URL = 'https://nodejs.org/dist'

// 平台映射
const NODE_PACKAGES = {
  'darwin-arm64': `node-v${NODE_VERSION}-darwin-arm64.tar.gz`,
  'darwin-x64': `node-v${NODE_VERSION}-darwin-x64.tar.gz`,
  'win32-x64': `node-v${NODE_VERSION}-win32-x64.zip`,
  'win32-ia32': `node-v${NODE_VERSION}-win32-x86.zip`,
  'linux-x64': `node-v${NODE_VERSION}-linux-x64.tar.gz`,
  'linux-arm64': `node-v${NODE_VERSION}-linux-arm64.tar.gz`,
}

// 辅助函数 - 递归复制目录
function copyFolderRecursiveSync(source, target) {
  // 检查目标目录是否存在，不存在则创建
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  // 读取源目录中的所有文件和文件夹
  const files = fs.readdirSync(source);

  // 循环处理每个文件/文件夹
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);

    // 检查是文件还是文件夹
    if (fs.statSync(sourcePath).isDirectory()) {
      // 如果是文件夹，递归复制
      copyFolderRecursiveSync(sourcePath, targetPath);
    } else {
      // 如果是文件，直接复制
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// 二进制文件存放目录
const binariesDir = path.join(os.homedir(), '.cherrystudio', 'bin')

// 创建二进制文件存放目录
async function createBinariesDir() {
  if (!fs.existsSync(binariesDir)) {
    console.log(`Creating binaries directory at ${binariesDir}`)
    fs.mkdirSync(binariesDir, { recursive: true })
  }
}

// 获取当前平台对应的包名
function getPackageForPlatform() {
  const platform = os.platform()
  const arch = os.arch()
  const key = `${platform}-${arch}`

  console.log(`Current platform: ${platform}, architecture: ${arch}`)

  if (!NODE_PACKAGES[key]) {
    throw new Error(`Unsupported platform/architecture: ${key}`)
  }

  return NODE_PACKAGES[key]
}

// 下载 Node.js
async function downloadNodeJs() {
  const packageName = getPackageForPlatform()
  const downloadUrl = `${NODE_RELEASE_BASE_URL}/v${NODE_VERSION}/${packageName}`
  const tempFilePath = path.join(os.tmpdir(), packageName)

  console.log(`Downloading Node.js v${NODE_VERSION} from ${downloadUrl}`)
  console.log(`Temp file path: ${tempFilePath}`)

  // 如果临时文件已存在，先删除
  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath)
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempFilePath)

    https.get(downloadUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`))
        return
      }

      console.log(`Download started, status code: ${response.statusCode}`)

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        console.log('Download completed')
        resolve(tempFilePath)
      })

      file.on('error', (err) => {
        fs.unlinkSync(tempFilePath)
        reject(err)
      })
    }).on('error', (err) => {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath)
      }
      reject(err)
    })
  })
}

// 解压 Node.js 包
async function extractNodeJs(filePath) {
  const platform = os.platform()
  const extractDir = path.join(os.tmpdir(), `node-v${NODE_VERSION}-extract`)

  if (fs.existsSync(extractDir)) {
    console.log(`Removing existing extract directory: ${extractDir}`)
    fs.rmSync(extractDir, { recursive: true, force: true })
  }

  console.log(`Creating extract directory: ${extractDir}`)
  fs.mkdirSync(extractDir, { recursive: true })

  console.log(`Extracting to ${extractDir}`)

  if (platform === 'win32') {
    // Windows 使用内置的解压工具
    try {
      const AdmZip = require('adm-zip')
      console.log(`Using adm-zip to extract ${filePath}`)
      const zip = new AdmZip(filePath)
      zip.extractAllTo(extractDir, true)
      console.log(`Extraction completed using adm-zip`)
    } catch (error) {
      console.error(`Error using adm-zip: ${error}`)
      throw error
    }
  } else {
    // Linux/Mac 使用 tar
    try {
      console.log(`Using tar to extract ${filePath} to ${extractDir}`)
      execSync(`tar -xzf "${filePath}" -C "${extractDir}"`, { stdio: 'inherit' })
      console.log(`Extraction completed using tar`)
    } catch (error) {
      console.error(`Error using tar: ${error}`)
      throw error
    }
  }

  return extractDir
}

// 安装 Node.js
async function installNodeJs(extractDir) {
  const platform = os.platform()
  console.log(`Finding extracted Node.js directory in ${extractDir}`)

  const items = fs.readdirSync(extractDir)
  console.log(`Found items in extract directory: ${items.join(', ')}`)

  // 找到包含"node-v"的目录名
  const folderName = items.find(item => item.startsWith('node-v'))

  if (!folderName) {
    throw new Error(`Could not find Node.js directory in ${extractDir}`)
  }

  console.log(`Found Node.js directory: ${folderName}`)
  const nodeBinPath = path.join(extractDir, folderName, 'bin')

  console.log(`Node.js bin path: ${nodeBinPath}`)

  // 复制 node 和 npm
  if (platform === 'win32') {
    // Windows
    console.log('Installing Node.js binaries for Windows')
    fs.copyFileSync(
      path.join(extractDir, folderName, 'node.exe'),
      path.join(binariesDir, 'node.exe')
    )
    console.log(`Copied node.exe to ${path.join(binariesDir, 'node.exe')}`)

    fs.copyFileSync(
      path.join(extractDir, folderName, 'npm.cmd'),
      path.join(binariesDir, 'npm.cmd')
    )
    console.log(`Copied npm.cmd to ${path.join(binariesDir, 'npm.cmd')}`)

    fs.copyFileSync(
      path.join(extractDir, folderName, 'npx.cmd'),
      path.join(binariesDir, 'npx.cmd')
    )
    console.log(`Copied npx.cmd to ${path.join(binariesDir, 'npx.cmd')}`)
  } else {
    // Linux/Mac
    console.log('Installing Node.js binaries for Linux/Mac')
    fs.copyFileSync(
      path.join(nodeBinPath, 'node'),
      path.join(binariesDir, 'node')
    )
    console.log(`Copied node to ${path.join(binariesDir, 'node')}`)

    // 创建npm脚本，指向正确路径
    const npmScript = `#!/usr/bin/env node
require("./node_modules/npm/lib/cli.js")(process)`;
    fs.writeFileSync(path.join(binariesDir, 'npm'), npmScript);
    console.log(`Created npm script at ${path.join(binariesDir, 'npm')}`);

    // 创建npx脚本，指向正确路径
    const npxScript = `#!/usr/bin/env node
require("./node_modules/npm/bin/npx-cli.js")`;
    fs.writeFileSync(path.join(binariesDir, 'npx'), npxScript);
    console.log(`Created npx script at ${path.join(binariesDir, 'npx')}`);

    // 设置执行权限
    execSync(`chmod +x "${path.join(binariesDir, 'node')}"`)
    execSync(`chmod +x "${path.join(binariesDir, 'npm')}"`)
    execSync(`chmod +x "${path.join(binariesDir, 'npx')}"`)
    console.log('Set executable permissions for Node.js binaries')
  }

  // 复制 npm 相关文件和目录
  const npmDir = path.join(binariesDir, 'node_modules', 'npm')
  fs.mkdirSync(npmDir, { recursive: true })
  console.log(`Created npm directory at ${npmDir}`)

  // 复制 npm 目录的内容
  const srcNpmDir = path.join(extractDir, folderName, 'lib', 'node_modules', 'npm')
  console.log(`Copying npm files from ${srcNpmDir} to ${npmDir}`)

  const files = fs.readdirSync(srcNpmDir)

  for (const file of files) {
    const srcPath = path.join(srcNpmDir, file)
    const destPath = path.join(npmDir, file)

    if (fs.lstatSync(srcPath).isDirectory()) {
      // 使用自定义函数代替fs.cpSync，确保兼容性
      console.log(`Copying directory: ${file}`)
      copyFolderRecursiveSync(srcPath, destPath)
    } else {
      console.log(`Copying file: ${file}`)
      fs.copyFileSync(srcPath, destPath)
    }
  }

  console.log('Node.js installation completed successfully')
}

// 清理临时文件
async function cleanup(filePath, extractDir) {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`Cleaning up temp file: ${filePath}`)
      fs.unlinkSync(filePath)
    }

    if (fs.existsSync(extractDir)) {
      console.log(`Cleaning up extract directory: ${extractDir}`)
      fs.rmSync(extractDir, { recursive: true, force: true })
    }

    console.log('Cleaned up temporary files')
  } catch (error) {
    console.error('Error during cleanup:', error)
  }
}

// 主安装函数
async function install() {
  try {
    console.log(`Starting Node.js v${NODE_VERSION} installation...`)

    await createBinariesDir()
    console.log('Binary directory created/verified')

    const filePath = await downloadNodeJs()
    console.log(`Downloaded Node.js to ${filePath}`)

    const extractDir = await extractNodeJs(filePath)
    console.log(`Extracted Node.js to ${extractDir}`)

    await installNodeJs(extractDir)
    console.log('Installed Node.js binaries')

    await cleanup(filePath, extractDir)
    console.log('Cleanup completed')

    console.log(`Node.js v${NODE_VERSION} has been installed successfully at ${binariesDir}`)
    return true
  } catch (error) {
    console.error('Installation failed:', error)
    throw error
  }
}

// 执行安装
install()
  .then(() => {
    console.log('Installation process completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error during installation:', error)
    process.exit(1)
  })
