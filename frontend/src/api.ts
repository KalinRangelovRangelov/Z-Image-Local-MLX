import type {
  Model,
  SystemInfo,
  GenerationRequest,
  GeneratedImage,
  ImageInfo,
} from "./types";

const API_BASE = "http://localhost:8000";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getSystemInfo(): Promise<SystemInfo> {
    return this.request<SystemInfo>("/api/system");
  }

  async getModels(): Promise<{ models: Model[] }> {
    return this.request<{ models: Model[] }>("/api/models");
  }

  async getModel(modelId: string): Promise<Model> {
    return this.request<Model>(`/api/models/${modelId}`);
  }

  async downloadModel(modelId: string): Promise<{ message: string; model_id: string }> {
    return this.request(`/api/models/${modelId}/download`, { method: "POST" });
  }

  async loadModel(modelId: string): Promise<{ message: string; model_id: string }> {
    return this.request(`/api/models/${modelId}/load`, { method: "POST" });
  }

  async unloadModel(modelId: string): Promise<{ message: string; model_id: string }> {
    return this.request(`/api/models/${modelId}/unload`, { method: "POST" });
  }

  async generateImage(request: GenerationRequest): Promise<GeneratedImage> {
    return this.request<GeneratedImage>("/api/generate", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getImages(): Promise<{ images: ImageInfo[] }> {
    return this.request<{ images: ImageInfo[] }>("/api/images");
  }

  async deleteImage(imageId: string): Promise<{ message: string; image_id: string }> {
    return this.request(`/api/images/${imageId}`, { method: "DELETE" });
  }

  getImageUrl(imageId: string): string {
    return `${this.baseUrl}/api/images/${imageId}`;
  }

  getWebSocketUrl(): string {
    const wsBase = this.baseUrl.replace("http", "ws");
    return `${wsBase}/ws`;
  }
}

export const api = new ApiClient();
