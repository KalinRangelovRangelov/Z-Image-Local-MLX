export type ModelState =
  | "not_downloaded"
  | "downloading"
  | "downloaded"
  | "loading"
  | "ready"
  | "error";

export interface DownloadProgress {
  total_size: number;
  downloaded_size: number;
  current_file: string;
  files_completed: number;
  total_files: number;
  speed: number;
  eta: number;
  percent: number;
}

export interface Model {
  id: string;
  name: string;
  description: string;
  recommended_steps: number;
  recommended_guidance: number;
  size_gb: number;
  state: ModelState;
  progress: DownloadProgress | null;
  error: string | null;
  is_current: boolean;
}

export interface SystemInfo {
  device: string;
  cuda_available: boolean;
  mps_available: boolean;
  gpu_info: {
    name: string;
    memory_total: number;
    memory_allocated: number;
    memory_cached: number;
  } | null;
  torch_version: string;
}

export interface GenerationRequest {
  prompt: string;
  model_id: string;
  width: number;
  height: number;
  num_inference_steps: number;
  guidance_scale: number;
  seed?: number;
  negative_prompt?: string;
}

export interface GeneratedImage {
  image_id: string;
  image_url: string;
  image_base64?: string;
  prompt: string;
  model_id: string;
  width: number;
  height: number;
  seed: number;
  generation_time: number;
}

export interface ImageInfo {
  id: string;
  url: string;
  created_at: string;
  size: number;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface ModelStatusMessage extends WebSocketMessage {
  type: "model_status";
  model_id: string;
  state: ModelState;
  progress: DownloadProgress;
  error: string | null;
}

export interface GenerationStartMessage extends WebSocketMessage {
  type: "generation_start";
  prompt: string;
  model_id: string;
}

export interface GenerationCompleteMessage extends WebSocketMessage {
  type: "generation_complete";
  image_id: string;
  prompt: string;
  generation_time: number;
}

export interface GenerationErrorMessage extends WebSocketMessage {
  type: "generation_error";
  error: string;
}

export interface InitialStateMessage extends WebSocketMessage {
  type: "initial_state";
  models: Array<{
    model_id: string;
    state: ModelState;
    progress: DownloadProgress | null;
  }>;
  current_model: string | null;
}

export type AppView = "init" | "generate" | "gallery";
