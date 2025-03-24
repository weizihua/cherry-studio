import { app } from 'electron'
import { EventEmitter } from 'events'
import fetch from 'node-fetch'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import { configManager } from './ConfigManager'

/**
 * TTS（Text-to-Speech）服务
 * 处理文本转语音请求，支持OpenAI兼容的TTS API和Microsoft Edge TTS
 */
export default class TTSService extends EventEmitter {
  private isPlaying: boolean = false
  private ffmpegProcess: any = null; // 存储ffmpeg进程引用
  private tempAudioPath: string = '';
  private ffplayAvailable: boolean = false; // 是否有ffplay可用
  // OpenAI TTS 默认声音
  private openaiVoices: string[] = [
    'alloy',
    'echo',
    'fable',
    'onyx',
    'nova',
    'shimmer'
  ]
  
  // Edge TTS 声音列表 (将在运行时从API获取完整列表)
  private edgeTtsVoices: { name: string; locale: string; gender: string }[] = []
  
  // 获取当前可用的声音列表
  private availableVoices: string[] = []

  constructor() {
    super()
    // 确保临时目录存在
    this.tempAudioPath = path.join(app.getPath('temp'), 'cherry-studio-tts')
    if (!fs.existsSync(this.tempAudioPath)) {
      fs.mkdirSync(this.tempAudioPath, { recursive: true })
    }
    
    // 检测ffplay是否可用
    this.checkFfplayAvailability();
    
    // 初始化可用声音列表
    this.updateAvailableVoices();
    
    // 尝试获取 Edge TTS 声音列表
    this.fetchEdgeTtsVoices();
  }
  
  /**
   * 更新可用声音列表
   */
  private updateAvailableVoices(): void {
    const ttsType = configManager.get('ttsType') || 'openai';
    
    if (ttsType === 'edge') {
      // 如果已经获取到了Edge TTS声音列表
      if (this.edgeTtsVoices.length > 0) {
        this.availableVoices = this.edgeTtsVoices.map(voice => voice.name);
      } else {
        // 默认提供一些常用的Edge TTS声音作为备选
        this.availableVoices = [
          'zh-CN-XiaoxiaoNeural',
          'zh-CN-YunxiNeural',
          'zh-CN-YunyangNeural',
          'en-US-AriaNeural',
          'en-US-GuyNeural'
        ];
      }
    } else {
      // 默认使用OpenAI TTS声音
      this.availableVoices = this.openaiVoices;
    }
  }
  
  /**
   * 获取Edge TTS支持的声音列表
   */
  private async fetchEdgeTtsVoices(): Promise<void> {
    try {
      // 由于无法直接调用npx，使用预定义的Edge TTS声音列表
      this.edgeTtsVoices = [
        { name: 'zh-CN-XiaoxiaoNeural', locale: 'zh-CN', gender: 'Female' },
        { name: 'zh-CN-XiaoyiNeural', locale: 'zh-CN', gender: 'Female' },
        { name: 'zh-CN-YunjianNeural', locale: 'zh-CN', gender: 'Male' },
        { name: 'zh-CN-YunxiNeural', locale: 'zh-CN', gender: 'Male' },
        { name: 'zh-CN-YunyangNeural', locale: 'zh-CN', gender: 'Male' },
        { name: 'zh-CN-liaoning-XiaobeiNeural', locale: 'zh-CN-liaoning', gender: 'Female' },
        { name: 'zh-CN-shaanxi-XiaoniNeural', locale: 'zh-CN-shaanxi', gender: 'Female' },
        { name: 'zh-HK-HiuGaaiNeural', locale: 'zh-HK', gender: 'Female' },
        { name: 'zh-HK-HiuMaanNeural', locale: 'zh-HK', gender: 'Female' },
        { name: 'zh-HK-WanLungNeural', locale: 'zh-HK', gender: 'Male' },
        { name: 'zh-TW-HsiaoChenNeural', locale: 'zh-TW', gender: 'Female' },
        { name: 'zh-TW-YunJheNeural', locale: 'zh-TW', gender: 'Male' },
        { name: 'en-US-AnaNeural', locale: 'en-US', gender: 'Female' },
        { name: 'en-US-AriaNeural', locale: 'en-US', gender: 'Female' },
        { name: 'en-US-ChristopherNeural', locale: 'en-US', gender: 'Male' },
        { name: 'en-US-EricNeural', locale: 'en-US', gender: 'Male' },
        { name: 'en-US-GuyNeural', locale: 'en-US', gender: 'Male' },
        { name: 'en-US-JennyNeural', locale: 'en-US', gender: 'Female' },
        { name: 'en-US-MichelleNeural', locale: 'en-US', gender: 'Female' },
        { name: 'en-US-RogerNeural', locale: 'en-US', gender: 'Male' },
        { name: 'en-US-SteffanNeural', locale: 'en-US', gender: 'Male' }
      ];
      
      console.log(`预设了${this.edgeTtsVoices.length}个Edge TTS声音`);
      
      // 更新可用声音列表
      this.updateAvailableVoices();
    } catch (error) {
      console.error('设置Edge TTS声音列表失败:', error);
    }
  }