import { useEffect } from "react";
import {
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Cpu,
  HardDrive,
  Zap,
} from "lucide-react";
import { useStore } from "../store";
import type { Model } from "../types";
import clsx from "clsx";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatEta(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return "";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

interface ModelCardProps {
  model: Model;
  onDownload: () => void;
  onLoad: () => void;
}

function ModelCard({ model, onDownload, onLoad }: ModelCardProps) {
  const isDownloading = model.state === "downloading";
  const isLoading = model.state === "loading";
  const isReady = model.state === "ready";
  const isDownloaded = model.state === "downloaded";
  const hasError = model.state === "error";

  const progress = model.progress;
  const downloadPercent = progress?.percent ?? 0;

  return (
    <div
      className={clsx(
        "relative rounded-2xl border p-6 transition-all duration-300",
        isReady
          ? "border-green-500/50 bg-green-500/5"
          : hasError
          ? "border-red-500/50 bg-red-500/5"
          : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-hover)]"
      )}
    >
      {/* Status indicator */}
      <div className="absolute top-4 right-4">
        {isReady && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        {isLoading && (
          <Loader2 className="h-5 w-5 text-primary-500 animate-spin" />
        )}
        {isDownloading && (
          <Loader2 className="h-5 w-5 text-primary-500 animate-spin" />
        )}
        {hasError && <AlertCircle className="h-5 w-5 text-red-500" />}
      </div>

      <h3 className="text-xl font-semibold mb-2">{model.name}</h3>
      <p className="text-zinc-400 text-sm mb-4">{model.description}</p>

      {/* Model specs */}
      <div className="flex gap-4 mb-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {model.recommended_steps} steps
        </span>
        <span className="flex items-center gap-1">
          <HardDrive className="h-3 w-3" />
          {model.size_gb} GB
        </span>
      </div>

      {/* Progress bar for downloading */}
      {isDownloading && progress && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-zinc-400 mb-2">
            <span className="font-medium text-white">
              {downloadPercent.toFixed(1)}%
            </span>
            <span>
              {formatBytes(progress.downloaded_size)} / {formatBytes(progress.total_size)}
            </span>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-300"
              style={{ width: `${downloadPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-2">
            <span>
              {progress.files_completed} / {progress.total_files} files
            </span>
            <span className="flex items-center gap-2">
              {progress.speed > 0 && <span>{formatSpeed(progress.speed)}</span>}
              {progress.eta > 0 && <span>ETA: {formatEta(progress.eta)}</span>}
            </span>
          </div>
          {progress.current_file && (
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Downloading: {progress.current_file.split('/').pop()}
            </p>
          )}
        </div>
      )}

      {/* Loading progress */}
      {isLoading && (
        <div className="mb-4">
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 animate-shimmer" />
          </div>
          <p className="text-xs text-zinc-500 mt-1">Loading model into memory...</p>
        </div>
      )}

      {/* Error message */}
      {hasError && model.error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-xs text-red-400">{model.error}</p>
        </div>
      )}

      {/* Action button */}
      <div className="flex gap-2">
        {model.state === "not_downloaded" && (
          <button
            onClick={onDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-medium transition-colors"
          >
            <Download className="h-4 w-4" />
            Download Model
          </button>
        )}

        {isDownloaded && (
          <button
            onClick={onLoad}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-medium transition-colors"
          >
            <Play className="h-4 w-4" />
            Load Model
          </button>
        )}

        {isReady && (
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600/20 text-green-400 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Ready to Generate
          </div>
        )}

        {(isDownloading || isLoading) && (
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isDownloading ? "Downloading..." : "Loading..."}
          </div>
        )}

        {hasError && (
          <button
            onClick={onDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
          >
            <Download className="h-4 w-4" />
            Retry Download
          </button>
        )}
      </div>
    </div>
  );
}

export function InitPage() {
  const {
    systemInfo,
    models,
    isConnected,
    connectionError,
    downloadModel,
    loadModel,
    setCurrentView,
    fetchSystemInfo,
    fetchModels,
  } = useStore();

  useEffect(() => {
    fetchSystemInfo();
    fetchModels();
  }, [fetchSystemInfo, fetchModels]);

  const hasReadyModel = models.some((m) => m.state === "ready");

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-400 mb-6 animate-pulse-glow">
            <Zap className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Z-Image
          </h1>
          <p className="text-zinc-400 text-lg">
            Powerful local image generation with state-of-the-art AI models
          </p>
        </div>

        {/* Connection status */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div
            className={clsx(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )}
          />
          <span className="text-sm text-zinc-400">
            {isConnected ? "Connected to server" : connectionError || "Connecting..."}
          </span>
        </div>

        {/* System info */}
        {systemInfo && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Cpu className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Device</span>
              </div>
              <p className="font-medium">
                {systemInfo.device === "mps" ? "Apple Silicon" :
                 systemInfo.device === "cuda" ? "NVIDIA CUDA" :
                 systemInfo.device.toUpperCase()}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <HardDrive className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">GPU</span>
              </div>
              <p className="font-medium truncate">
                {systemInfo.gpu_info?.name ||
                 (systemInfo.device === "mps" ? "Apple GPU" : "N/A")}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Zap className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Memory</span>
              </div>
              <p className="font-medium">
                {systemInfo.gpu_info
                  ? formatBytes(systemInfo.gpu_info.memory_total)
                  : systemInfo.device === "mps" ? "Unified Memory" : "N/A"}
              </p>
            </div>
          </div>
        )}

        {/* Models */}
        <h2 className="text-xl font-semibold mb-4">Available Models</h2>
        <div className="space-y-4 mb-8">
          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              onDownload={() => downloadModel(model.id)}
              onLoad={() => loadModel(model.id)}
            />
          ))}
        </div>

        {/* Continue button */}
        {hasReadyModel && (
          <div className="text-center animate-fade-in">
            <button
              onClick={() => setCurrentView("generate")}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-semibold text-lg transition-all shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
            >
              <Zap className="h-5 w-5" />
              Start Generating
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
