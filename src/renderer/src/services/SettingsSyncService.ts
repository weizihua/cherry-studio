/**
 * 设置同步服务
 * 负责在渲染进程和主进程之间同步设置
 */
import store from '@renderer/store'
import { 
  setTtsEnabled, 
  setTtsType,
  setTtsApiUrl, 
  setTtsApiKey, 
  setTtsModel, 
  setTtsVoice,
  setTtsPlayerType,
  setTtsEdgeRate,
  setTtsEdgeVolume,
  setTtsCustomModels,
  setTtsCustomVoices
} from '@renderer/store/settings'

/**
 * 从主进程加载TTS设置到Redux
 */
export async function loadTTSSettingsFromMain() {
  try {
    console.log('正在从主进程加载TTS设置...');
    
    // 从主进程获取TTS设置
    const ttsEnabled = await window.api.config.get('ttsEnabled');
    const ttsType = await window.api.config.get('ttsType');
    const ttsApiUrl = await window.api.config.get('ttsApiUrl');
    const ttsApiKey = await window.api.config.get('ttsApiKey');
    const ttsModel = await window.api.config.get('ttsModel');
    const ttsVoice = await window.api.config.get('ttsVoice');
    const ttsPlayerType = await window.api.config.get('ttsPlayerType');
    const ttsEdgeRate = await window.api.config.get('ttsEdgeRate');
    const ttsEdgeVolume = await window.api.config.get('ttsEdgeVolume');
    const ttsCustomModels = await window.api.config.get('ttsCustomModels');
    const ttsCustomVoices = await window.api.config.get('ttsCustomVoices');
    
    console.log('从主进程获取到TTS设置:', { 
      ttsEnabled, 
      ttsType,
      ttsApiUrl: ttsApiUrl?.substring(0, 10) + '...', 
      apiKeyExists: !!ttsApiKey,
      ttsModel, 
      ttsVoice,
      ttsPlayerType,
      ttsEdgeRate,
      ttsEdgeVolume,
      hasCustomModels: !!ttsCustomModels,
      hasCustomVoices: !!ttsCustomVoices
    });
    
    // 更新Redux状态
    const reduxState = store.getState().settings;
    
    // 只有当主进程有值且与Redux不同时才更新
    if (ttsEnabled !== undefined && ttsEnabled !== reduxState.ttsEnabled) {
      store.dispatch(setTtsEnabled(ttsEnabled));
    }
    
    if (ttsType && ttsType !== reduxState.ttsType) {
      store.dispatch(setTtsType(ttsType));
    }
    
    if (ttsApiUrl && ttsApiUrl !== reduxState.ttsApiUrl) {
      store.dispatch(setTtsApiUrl(ttsApiUrl));
    }
    
    if (ttsApiKey && ttsApiKey !== reduxState.ttsApiKey) {
      store.dispatch(setTtsApiKey(ttsApiKey));
    }
    
    if (ttsModel && ttsModel !== reduxState.ttsModel) {
      store.dispatch(setTtsModel(ttsModel));
    }
    
    if (ttsVoice && ttsVoice !== reduxState.ttsVoice) {
      store.dispatch(setTtsVoice(ttsVoice));
    }
    
    if (ttsPlayerType && ttsPlayerType !== reduxState.ttsPlayerType) {
      store.dispatch(setTtsPlayerType(ttsPlayerType));
    }
    
    if (ttsEdgeRate && ttsEdgeRate !== reduxState.ttsEdgeRate) {
      store.dispatch(setTtsEdgeRate(ttsEdgeRate));
    }
    
    if (ttsEdgeVolume && ttsEdgeVolume !== reduxState.ttsEdgeVolume) {
      store.dispatch(setTtsEdgeVolume(ttsEdgeVolume));
    }
    
    if (ttsCustomModels && JSON.stringify(ttsCustomModels) !== JSON.stringify(reduxState.ttsCustomModels)) {
      store.dispatch(setTtsCustomModels(ttsCustomModels));
    }
    
    if (ttsCustomVoices && JSON.stringify(ttsCustomVoices) !== JSON.stringify(reduxState.ttsCustomVoices)) {
      store.dispatch(setTtsCustomVoices(ttsCustomVoices));
    }
    
    // 如果Redux有值而主进程没有，同步到主进程
    if (!ttsEnabled && reduxState.ttsEnabled !== undefined) {
      window.api.config.set('ttsEnabled', reduxState.ttsEnabled);
    }
    
    if (!ttsType && reduxState.ttsType) {
      window.api.config.set('ttsType', reduxState.ttsType);
    }
    
    if (!ttsApiUrl && reduxState.ttsApiUrl) {
      window.api.config.set('ttsApiUrl', reduxState.ttsApiUrl);
    }
    
    if (!ttsApiKey && reduxState.ttsApiKey) {
      window.api.config.set('ttsApiKey', reduxState.ttsApiKey);
    }
    
    if (!ttsModel && reduxState.ttsModel) {
      window.api.config.set('ttsModel', reduxState.ttsModel);
    }
    
    if (!ttsVoice && reduxState.ttsVoice) {
      window.api.config.set('ttsVoice', reduxState.ttsVoice);
    }
    
    if (!ttsPlayerType && reduxState.ttsPlayerType) {
      window.api.config.set('ttsPlayerType', reduxState.ttsPlayerType);
    }
    
    if (!ttsEdgeRate && reduxState.ttsEdgeRate) {
      window.api.config.set('ttsEdgeRate', reduxState.ttsEdgeRate);
    }
    
    if (!ttsEdgeVolume && reduxState.ttsEdgeVolume) {
      window.api.config.set('ttsEdgeVolume', reduxState.ttsEdgeVolume);
    }
    
    if (!ttsCustomModels && reduxState.ttsCustomModels && reduxState.ttsCustomModels.length > 0) {
      window.api.config.set('ttsCustomModels', reduxState.ttsCustomModels);
    }
    
    if (!ttsCustomVoices && reduxState.ttsCustomVoices && reduxState.ttsCustomVoices.length > 0) {
      window.api.config.set('ttsCustomVoices', reduxState.ttsCustomVoices);
    }
    
    console.log('TTS设置同步完成');
    
    // 检查TTS是否可用
    try {
      const isAvailable = await window.api.tts.isAvailable();
      console.log('TTS服务可用性:', isAvailable);
    } catch (e) {
      console.error('检查TTS可用性失败:', e);
    }
    
    return true;
  } catch (error) {
    console.error('加载TTS设置失败:', error);
    return false;
  }
}

/**
 * 立即同步当前Redux中的TTS设置到主进程
 */
export function syncTTSSettingsToMain() {
  try {
    const { 
      ttsEnabled, 
      ttsType,
      ttsApiUrl, 
      ttsApiKey, 
      ttsModel, 
      ttsVoice,
      ttsPlayerType,
      ttsEdgeRate,
      ttsEdgeVolume,
      ttsCustomModels,
      ttsCustomVoices
    } = store.getState().settings;
    
    console.log('同步TTS设置到主进程:', { 
      ttsEnabled, 
      ttsType,
      ttsApiUrl: ttsApiUrl?.substring(0, 10) + '...', 
      apiKeyExists: !!ttsApiKey,
      ttsModel, 
      ttsVoice,
      ttsPlayerType,
      ttsEdgeRate,
      ttsEdgeVolume,
      hasCustomModels: !!ttsCustomModels && ttsCustomModels.length > 0,
      hasCustomVoices: !!ttsCustomVoices && ttsCustomVoices.length > 0,
    });
    
    window.api.config.set('ttsEnabled', ttsEnabled);
    window.api.config.set('ttsType', ttsType);
    window.api.config.set('ttsApiUrl', ttsApiUrl);
    window.api.config.set('ttsApiKey', ttsApiKey);
    window.api.config.set('ttsModel', ttsModel);
    window.api.config.set('ttsVoice', ttsVoice);
    window.api.config.set('ttsPlayerType', ttsPlayerType);
    window.api.config.set('ttsEdgeRate', ttsEdgeRate);
    window.api.config.set('ttsEdgeVolume', ttsEdgeVolume);
    window.api.config.set('ttsCustomModels', ttsCustomModels);
    window.api.config.set('ttsCustomVoices', ttsCustomVoices);
    
    return true;
  } catch (error) {
    console.error('同步TTS设置失败:', error);
    return false;
  }
}
