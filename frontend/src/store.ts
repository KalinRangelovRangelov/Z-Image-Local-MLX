import { create } from "zustand";
import type { Model, SystemInfo, GeneratedImage, AppView, ModelState, DownloadProgress } from "./types";
import { api } from "./api";

interface AppState {
  // System
  systemInfo: SystemInfo | null;
  isConnected: boolean;
  connectionError: string | null;

  // Models
  models: Model[];
  selectedModelId: string | null;

  // Generation
  isGenerating: boolean;
  generatedImages: GeneratedImage[];
  currentPrompt: string;
  generationError: string | null;

  // UI
  currentView: AppView;

  // Actions
  setSystemInfo: (info: SystemInfo) => void;
  setConnectionStatus: (connected: boolean, error?: string | null) => void;
  setModels: (models: Model[]) => void;
  updateModelStatus: (
    modelId: string,
    state: ModelState,
    progress?: DownloadProgress,
    error?: string | null
  ) => void;
  setSelectedModel: (modelId: string) => void;
  setCurrentView: (view: AppView) => void;
  setGenerating: (generating: boolean) => void;
  addGeneratedImage: (image: GeneratedImage) => void;
  setCurrentPrompt: (prompt: string) => void;
  setGenerationError: (error: string | null) => void;

  // Async actions
  fetchSystemInfo: () => Promise<void>;
  fetchModels: () => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  loadModel: (modelId: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  systemInfo: null,
  isConnected: false,
  connectionError: null,
  models: [],
  selectedModelId: null,
  isGenerating: false,
  generatedImages: [],
  currentPrompt: "",
  generationError: null,
  currentView: "init",

  // Actions
  setSystemInfo: (info) => set({ systemInfo: info }),

  setConnectionStatus: (connected, error = null) =>
    set({ isConnected: connected, connectionError: error }),

  setModels: (models) => {
    const readyModel = models.find((m) => m.state === "ready");
    const downloadedModel = models.find((m) => m.state === "downloaded");
    const currentSelected = get().selectedModelId;

    set({
      models,
      selectedModelId:
        currentSelected ||
        readyModel?.id ||
        downloadedModel?.id ||
        models[0]?.id ||
        null,
    });
  },

  updateModelStatus: (modelId, state, progress, error) => {
    set((s) => ({
      models: s.models.map((m) =>
        m.id === modelId
          ? {
              ...m,
              state,
              progress: progress ?? m.progress,
              error: error ?? m.error,
            }
          : m
      ),
    }));
  },

  setSelectedModel: (modelId) => set({ selectedModelId: modelId }),

  setCurrentView: (view) => set({ currentView: view }),

  setGenerating: (generating) => set({ isGenerating: generating }),

  addGeneratedImage: (image) =>
    set((s) => ({ generatedImages: [image, ...s.generatedImages] })),

  setCurrentPrompt: (prompt) => set({ currentPrompt: prompt }),

  setGenerationError: (error) => set({ generationError: error }),

  // Async actions
  fetchSystemInfo: async () => {
    try {
      const info = await api.getSystemInfo();
      set({ systemInfo: info });
    } catch (err) {
      console.error("Failed to fetch system info:", err);
    }
  },

  fetchModels: async () => {
    try {
      const { models } = await api.getModels();
      get().setModels(models);
    } catch (err) {
      console.error("Failed to fetch models:", err);
    }
  },

  downloadModel: async (modelId) => {
    try {
      await api.downloadModel(modelId);
    } catch (err) {
      console.error("Failed to start download:", err);
      get().updateModelStatus(modelId, "error", undefined, String(err));
    }
  },

  loadModel: async (modelId) => {
    try {
      await api.loadModel(modelId);
    } catch (err) {
      console.error("Failed to load model:", err);
      get().updateModelStatus(modelId, "error", undefined, String(err));
    }
  },
}));
