import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { NodeAppType } from '@renderer/types'

// Define featured Node.js apps - you can add more as needed
export const FEATURED_NODE_APPS: NodeAppType[] = [
  {
    id: 'writing-helper',
    name: 'Writing Helper',
    url: 'http://localhost:3000',
    type: 'node',
    repositoryUrl: 'https://github.com/GeekyWizKid/writing-helper',
    description: 'AI writing assistant supporting multiple LLM APIs with rich style customization features.',
    author: 'GeekyWizKid',
    homepage: 'https://github.com/GeekyWizKid/writing-helper',
    installCommand: 'npm install',
    startCommand: 'npm run dev',
    isInstalled: false,
    isRunning: false
  }
]

export interface NodeAppsState {
  apps: NodeAppType[]
  loading: boolean
  error: string | null
}

const initialState: NodeAppsState = {
  apps: [...FEATURED_NODE_APPS],
  loading: false,
  error: null
}

const nodeAppsSlice = createSlice({
  name: 'nodeApps',
  initialState,
  reducers: {
    setNodeApps: (state, action: PayloadAction<NodeAppType[]>) => {
      state.apps = action.payload
    },
    addNodeApp: (state, action: PayloadAction<NodeAppType>) => {
      state.apps.push(action.payload)
    },
    updateNodeApp: (state, action: PayloadAction<NodeAppType>) => {
      const index = state.apps.findIndex(app => app.id === action.payload.id)
      if (index !== -1) {
        state.apps[index] = action.payload
      }
    },
    removeNodeApp: (state, action: PayloadAction<string>) => {
      state.apps = state.apps.filter(app => app.id !== action.payload)
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    }
  }
})

export const {
  setNodeApps,
  addNodeApp,
  updateNodeApp,
  removeNodeApp,
  setLoading,
  setError
} = nodeAppsSlice.actions

export default nodeAppsSlice.reducer
