import { useState, useCallback, useRef } from "react";
import {
  Sparkles,
  Settings2,
  Image as ImageIcon,
  Loader2,
  ChevronDown,
  ArrowLeft,
  Download,
  Copy,
  Check,
  Trash2,
  Clock,
  Maximize2,
  Upload,
  X,
} from "lucide-react";
import { useStore } from "../store";
import { api } from "../api";
import type { GeneratedImage } from "../types";
import clsx from "clsx";

interface ImageModalProps {
  image: GeneratedImage;
  onClose: () => void;
}

function ImageModal({ image, onClose }: ImageModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(image.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${image.image_base64}`;
    link.download = `z-image-${image.image_id}.png`;
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full bg-[var(--card)] rounded-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col lg:flex-row">
          {/* Image */}
          <div className="flex-1 bg-zinc-900 flex items-center justify-center p-4">
            <img
              src={`data:image/png;base64,${image.image_base64}`}
              alt={image.prompt}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>

          {/* Details */}
          <div className="w-full lg:w-80 p-6 border-t lg:border-t-0 lg:border-l border-[var(--border)]">
            <h3 className="text-lg font-semibold mb-4">Image Details</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wide">
                  Prompt
                </label>
                <p className="text-sm mt-1">{image.prompt}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wide">
                    Size
                  </label>
                  <p className="text-sm mt-1">
                    {image.width} x {image.height}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wide">
                    Seed
                  </label>
                  <p className="text-sm mt-1 font-mono">{image.seed}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wide">
                  Generation Time
                </label>
                <p className="text-sm mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {image.generation_time.toFixed(2)}s
                </p>
              </div>

              <div className="flex gap-2 pt-4 border-t border-[var(--border)]">
                <button
                  onClick={handleCopyPrompt}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied!" : "Copy Prompt"}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-sm transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-4 px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-zinc-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type GenerationMode = "txt2img" | "img2img";

export function GeneratePage() {
  const {
    models,
    selectedModelId,
    setSelectedModel,
    isGenerating,
    setGenerating,
    generatedImages,
    addGeneratedImage,
    currentPrompt,
    setCurrentPrompt,
    generationError,
    setGenerationError,
    setCurrentView,
  } = useStore();

  const [mode, setMode] = useState<GenerationMode>("txt2img");
  const [showSettings, setShowSettings] = useState(false);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(8);
  const [guidance, setGuidance] = useState(0.0);
  const [seed, setSeed] = useState<string>("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [showModelSelect, setShowModelSelect] = useState(false);

  // Img2img state
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [imageStrength, setImageStrength] = useState(0.7);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const readyModels = models.filter((m) => m.state === "ready");

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceImage(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferencePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveReference = () => {
    setReferenceImage(null);
    setReferencePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!currentPrompt.trim() || !selectedModelId || isGenerating) return;
    if (mode === "img2img" && !referenceImage) return;

    setGenerating(true);
    setGenerationError(null);

    try {
      let result: GeneratedImage;

      if (mode === "img2img" && referenceImage) {
        result = await api.generateImg2Img(currentPrompt, referenceImage, {
          model_id: selectedModelId,
          num_inference_steps: steps,
          image_strength: imageStrength,
          seed: seed ? parseInt(seed) : undefined,
        });
      } else {
        result = await api.generateImage({
          prompt: currentPrompt,
          model_id: selectedModelId,
          width,
          height,
          num_inference_steps: steps,
          guidance_scale: guidance,
          seed: seed ? parseInt(seed) : undefined,
          negative_prompt: negativePrompt || undefined,
        });
      }

      addGeneratedImage(result);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [
    currentPrompt,
    selectedModelId,
    isGenerating,
    mode,
    referenceImage,
    width,
    height,
    steps,
    guidance,
    seed,
    negativePrompt,
    imageStrength,
    setGenerating,
    setGenerationError,
    addGeneratedImage,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleGenerate();
    }
  };

  const handleDeleteImage = (imageId: string) => {
    api.deleteImage(imageId).catch(console.error);
  };

  const canGenerate =
    currentPrompt.trim() &&
    !isGenerating &&
    selectedModelId &&
    (mode === "txt2img" || referenceImage);

  return (
    <div className="min-h-screen bg-[var(--background)] flex">
      {/* Sidebar with generated images */}
      <div className="w-80 border-r border-[var(--border)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <button
            onClick={() => setCurrentView("init")}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Setup</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Generated Images ({generatedImages.length})
          </h2>

          {generatedImages.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No images yet</p>
              <p className="text-xs mt-1">Start generating!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {generatedImages.map((image) => (
                <div
                  key={image.image_id}
                  className="group relative aspect-square rounded-lg overflow-hidden bg-zinc-800 cursor-pointer"
                  onClick={() => setSelectedImage(image)}
                >
                  <img
                    src={`data:image/png;base64,${image.image_base64}`}
                    alt={image.prompt}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(image);
                      }}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                    <button
                      className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(image.image_id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main generation area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Generate</h1>

            {/* Mode toggle */}
            <div className="flex rounded-lg bg-zinc-800 p-1">
              <button
                onClick={() => setMode("txt2img")}
                className={clsx(
                  "px-3 py-1 rounded-md text-sm transition-colors",
                  mode === "txt2img"
                    ? "bg-primary-600 text-white"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Text to Image
              </button>
              <button
                onClick={() => setMode("img2img")}
                className={clsx(
                  "px-3 py-1 rounded-md text-sm transition-colors",
                  mode === "img2img"
                    ? "bg-primary-600 text-white"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Image to Image
              </button>
            </div>

            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelSelect(!showModelSelect)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border-light)] transition-colors text-sm"
              >
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>{selectedModel?.name || "Select model"}</span>
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </button>

              {showModelSelect && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl z-10 animate-fade-in">
                  {readyModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setShowModelSelect(false);
                      }}
                      className={clsx(
                        "w-full px-4 py-2 text-left hover:bg-[var(--card-hover)] first:rounded-t-lg last:rounded-b-lg transition-colors",
                        model.id === selectedModelId && "bg-primary-600/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "w-2 h-2 rounded-full",
                            model.id === selectedModelId
                              ? "bg-primary-500"
                              : "bg-green-500"
                          )}
                        />
                        <span className="text-sm">{model.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors",
              showSettings
                ? "bg-primary-600/10 border-primary-500/50 text-primary-400"
                : "border-[var(--border)] hover:border-[var(--border-light)]"
            )}
          >
            <Settings2 className="h-4 w-4" />
            <span className="text-sm">Settings</span>
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="p-4 border-b border-[var(--border)] bg-[var(--card)] animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {mode === "txt2img" && (
                <>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Width</label>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(parseInt(e.target.value) || 1024)}
                      min={256}
                      max={2048}
                      step={64}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-[var(--border)] focus:border-primary-500 focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Height</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(parseInt(e.target.value) || 1024)}
                      min={256}
                      max={2048}
                      step={64}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-[var(--border)] focus:border-primary-500 focus:outline-none text-sm"
                    />
                  </div>
                </>
              )}
              {mode === "img2img" && (
                <div className="md:col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1">
                    Image Strength: {imageStrength.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    value={imageStrength}
                    onChange={(e) => setImageStrength(parseFloat(e.target.value))}
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    className="w-full accent-primary-500"
                  />
                  <div className="flex justify-between text-xs text-zinc-500 mt-1">
                    <span>Keep original</span>
                    <span>Full change</span>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Steps</label>
                <input
                  type="number"
                  value={steps}
                  onChange={(e) => setSteps(parseInt(e.target.value) || 8)}
                  min={1}
                  max={50}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-[var(--border)] focus:border-primary-500 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  Seed (optional)
                </label>
                <input
                  type="text"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="Random"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-[var(--border)] focus:border-primary-500 focus:outline-none text-sm"
                />
              </div>
              {mode === "txt2img" && (
                <>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">
                      Guidance Scale
                    </label>
                    <input
                      type="number"
                      value={guidance}
                      onChange={(e) => setGuidance(parseFloat(e.target.value) || 0)}
                      min={0}
                      max={20}
                      step={0.5}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-[var(--border)] focus:border-primary-500 focus:outline-none text-sm"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs text-zinc-500 mb-1">
                      Negative Prompt (optional)
                    </label>
                    <input
                      type="text"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="What to avoid..."
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-[var(--border)] focus:border-primary-500 focus:outline-none text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {/* Image upload for img2img */}
          {mode === "img2img" && (
            <div className="w-full max-w-2xl mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              {referencePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--card)]">
                  <img
                    src={referencePreview}
                    alt="Reference"
                    className="w-full max-h-64 object-contain"
                  />
                  <button
                    onClick={handleRemoveReference}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/50 text-xs">
                    Reference Image
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-12 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-primary-500 transition-colors flex flex-col items-center justify-center gap-2 text-zinc-400 hover:text-white"
                >
                  <Upload className="h-8 w-8" />
                  <span>Upload reference image</span>
                  <span className="text-xs text-zinc-500">Click or drag & drop</span>
                </button>
              )}
            </div>
          )}

          {/* Latest generated image or placeholder */}
          <div className="w-full max-w-2xl aspect-square rounded-2xl bg-[var(--card)] border border-[var(--border)] mb-8 overflow-hidden flex items-center justify-center">
            {isGenerating ? (
              <div className="text-center">
                <Loader2 className="h-16 w-16 text-primary-500 animate-spin mx-auto mb-4" />
                <p className="text-zinc-400">Generating your image...</p>
                <p className="text-zinc-500 text-sm mt-1">This may take a moment</p>
              </div>
            ) : generatedImages.length > 0 ? (
              <img
                src={`data:image/png;base64,${generatedImages[0].image_base64}`}
                alt={generatedImages[0].prompt}
                className="w-full h-full object-contain cursor-pointer"
                onClick={() => setSelectedImage(generatedImages[0])}
              />
            ) : (
              <div className="text-center">
                <Sparkles className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">Your image will appear here</p>
                <p className="text-zinc-500 text-sm mt-1">
                  {mode === "img2img"
                    ? "Upload an image and enter a prompt"
                    : "Enter a prompt and click Generate"}
                </p>
              </div>
            )}
          </div>

          {/* Error message */}
          {generationError && (
            <div className="w-full max-w-2xl mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in">
              {generationError}
            </div>
          )}

          {/* Prompt input */}
          <div className="w-full max-w-2xl">
            <div className="relative">
              <textarea
                value={currentPrompt}
                onChange={(e) => setCurrentPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === "img2img"
                    ? "Describe how to modify the image..."
                    : "Describe the image you want to create..."
                }
                rows={3}
                className="w-full px-4 py-3 pr-24 rounded-xl bg-[var(--card)] border border-[var(--border)] focus:border-primary-500 focus:outline-none resize-none text-base"
              />
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={clsx(
                  "absolute right-2 bottom-2 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                  canGenerate
                    ? "bg-primary-600 hover:bg-primary-500 text-white"
                    : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                )}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-2 text-center">
              Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">Cmd</kbd> +{" "}
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">Enter</kbd> to generate
            </p>
          </div>
        </div>
      </div>

      {/* Image modal */}
      {selectedImage && (
        <ImageModal image={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
}
