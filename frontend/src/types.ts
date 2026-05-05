import type { ReactNode } from 'react'

export interface ActiveJob {
  jobId: string
  phase: 'processing' | 'embedding'
  status: string
  processProgress?: number
  processStep?: string
  embedProgress?: number
  embedStep?: string
  files?: string[]
}

export interface AIModel {
  id: string
  name: string
  api_key: string
  model: string
}

export interface SavedCreds {
  [key: string]: unknown
  ai_models?: AIModel[]
  supabase?: { url: string; service_key: string }
  n8n?: { url: string; api_key: string }
  waha?: { url: string; api_key?: string }
}

export interface ProcessConfig {
  useAI: boolean
  chunkSize: number
  overlap: number
  modelId: string | null
  selectedAIId?: string
  _aiKey?: string
  _aiModel?: string
}

export interface ProcessResult {
  filename: string
  status: string
  chunks?: number
  pages?: number
  time?: number
  embedded?: number
  embed_error?: string
}

export interface CredField {
  key: string
  label: string
  placeholder: string
  type: 'text' | 'password'
  hint?: string
}

export interface CredDef {
  id: string
  name: string
  description: string
  color: string
  keys: string[]
  isList?: boolean
  icon: ReactNode
}

export interface ModelSuggestion {
  id: string
  provider: string
  label: string
}

export interface ToastState {
  ok: boolean
  text: string
}

export interface RuntimeCreds {
  gemini_key: string
  supabase_url: string
  supabase_key: string
  chat_model_id: string | null
  embed_model_id: string | null
  ai_list: AIModel[]
}

export interface DashboardMetrics {
  total: number
  human: number
  ai: number
  uniqueSessions: number
  avgPerUser: number
  pesanHariIni: number
  userHariIni: number
}

export interface UserContact {
  session_id: string
  display_name?: string
  phone_number?: string
  last_seen?: string
  message_count?: number
  pesan: number
  terakhir: string
  isNew: boolean
}

export interface ChatRow {
  id: number
  session: string
  tipe: string
  pesan: string
}

export interface DashboardData {
  metrics: DashboardMetrics
  kbChunks: number
  users: UserContact[]
}

export interface Step {
  id: string
  title: string
}
