import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ScanLine, ZoomIn, ZoomOut, X, Square } from 'lucide-react';

import { ImageUpload } from '@/components/ImageUpload';
import { TranslationPanel } from '@/components/TranslationPanel';
import SelectionCanvas from '@/components/SelectionCanvas';

import { translateImage, type TranslationResult } from '@/services/gemini';
import { applySafetyFilter } from '@/lib/imageProcessor';

function mergeResults(
  prev: TranslationResult | null,
  next: TranslationResult
): TranslationResult {

  if (!prev) return next;

  if (!prev.items) return next;

  return {
    ...prev,
    items: [
      ...prev.items,
      ...(next.items || [])
    ]
  };
}

export default function App() {

  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [result, setResult] = useState<TranslationResult | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");

  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);

  /**
   * ⭐ 翻譯任務控制器
   */
  const abortRef = useRef<AbortController | null>(null);

  /**
   * ⭐ Ctrl+V 貼圖支援
   */
  useEffect(() => {

    const handlePaste = (event: ClipboardEvent) => {

      const items = event.clipboardData?.items;

      if (!items) return;

      for (const item of items) {

        if (item.type.startsWith("image/")) {

          const file = item.getAsFile();

          if (file) {
            handleImageSelect(file);
          }

          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };

  }, []);

  const stopCurrentTranslation = () => {

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    setIsLoading(false);
    setLoadingStatus("");
  };

  const handleImageSelect = (file: File) => {

    stopCurrentTranslation();

    const reader = new FileReader();

    reader.onload = (e) => {

      if (!e.target?.result) return;

      const base64String = e.target.result as string;

      const matches = base64String.match(/^data:(.+);base64,(.+)$/);

      if (!matches) return;

      setMimeType(matches[1]);
      setImage(base64String);

      setResult(null);
      setError(null);
      setZoom(1);

      handleTranslate(matches[2], matches[1]);
    };

    reader.readAsDataURL(file);
  };

  const handleTranslate = async (base64Data: string, mime: string) => {

    abortRef.current = new AbortController();

    setIsLoading(true);
    setLoadingStatus("ANALYZING EVIDENCE...");
    setError(null);

    try {

      const data = await translateImage(
        base64Data,
        mime,
        undefined,
        undefined,
        abortRef.current.signal
      );

      setResult(prev => mergeResults(prev, data));

    } catch (err: any) {

      if (err?.name === "AbortError") return;

      console.error(err);

      if (
        err.message.includes("blocked") ||
        err.message.includes("PROHIBITED") ||
        err.message.includes("safety filters")
      ) {

        try {

          setLoadingStatus("APPLYING SAFETY FILTER...");

          const safeImageBase64Full =
            await applySafetyFilter(`data:${mime};base64,${base64Data}`);

          const matches = safeImageBase64Full.match(/^data:(.+);base64,(.+)$/);

          if (matches) {

            setLoadingStatus("RE-ANALYZING FILTERED IMAGE...");

            const safeData = await translateImage(
              matches[2],
              matches[1],
              undefined,
              "gemini-2.5-pro",
              abortRef.current?.signal
            );

            setResult(prev => mergeResults(prev, safeData));
            return;
          }

        } catch (filterErr) {

          console.error("Filter failed:", filterErr);
        }
      }

      const errorMessage =
        err instanceof Error
          ? err.message
          : "Translation process failed.";

      setError(errorMessage);

    } finally {

      setIsLoading(false);
      setLoadingStatus("");
    }
  };

  /**
   * ⭐ 框選翻譯
   */
  const handleManualCrops = async (crops: string[]) => {

    stopCurrentTranslation();

    setIsLoading(true);
    setLoadingStatus("ANALYZING SELECTED AREAS...");
    setError(null);

    try {

      const results: TranslationResult[] = [];

      for (const crop of crops) {

        const data = await translateImage(crop, "image/png");
        results.push(data);
      }

      if (results.length === 0) return;

      const merged: TranslationResult = {
        ...results[0],
        items: results.flatMap(r => r.items || [])
      };

      setResult(merged);

    } catch (err: any) {

      setError(err.message || "Manual translation failed");

    } finally {

      setIsLoading(false);
      setLoadingStatus("");
    }
  };

  const handleReset = () => {

    stopCurrentTranslation();

    setImage(null);
    setResult(null);
    setZoom(1);
    setError(null);
  };

  const toggleSelectionMode = () => {

    stopCurrentTranslation();

    setSelectionMode(v => !v);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-indigo-500/30 overflow-hidden">

      <header className="h-14 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-6">

        <div className="flex items-center gap-3">

          <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-indigo-400" />
          </div>

          <h1 className="text-sm text-zinc-200 uppercase tracking-wide">
            Manga Translator
          </h1>

        </div>

      </header>

      <main className="flex flex-1 overflow-hidden">

        <div className="flex-1 flex flex-col relative bg-zinc-950">

          {!image ? (

            <div className="flex-1 flex items-center justify-center">

              <ImageUpload
                onImageSelect={handleImageSelect}
                className="max-w-md w-full"
              />

            </div>

          ) : (

            <>

              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded">

                <button
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="p-2 text-zinc-400 hover:text-white"
                >
                  <ZoomOut size={16} />
                </button>

                <span className="text-xs text-zinc-300 px-2">
                  {Math.round(zoom * 100)}%
                </span>

                <button
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="p-2 text-zinc-400 hover:text-white"
                >
                  <ZoomIn size={16} />
                </button>

                <button
                  onClick={toggleSelectionMode}
                  className={`p-2 ${
                    selectionMode ? "text-indigo-400" : "text-zinc-400"
                  }`}
                >
                  <Square size={16} />
                </button>

                <button
                  onClick={handleReset}
                  className="p-2 text-red-400"
                >
                  <X size={16} />
                </button>

              </div>

              <div className="flex-1 flex items-center justify-center p-8 overflow-auto">

                {selectionMode ? (

                  <SelectionCanvas
                    imageSrc={image}
                    onCropAll={handleManualCrops}
                  />

                ) : (

                  <motion.div
                    animate={{ scale: zoom }}
                    className="shadow-xl"
                  >

                    <img
                      src={image}
                      alt="Evidence"
                      className="max-h-[85vh] object-contain"
                    />

                  </motion.div>

                )}

              </div>

            </>

          )}

        </div>

        <div className="w-[420px] border-l border-zinc-800 bg-zinc-900 flex flex-col">

          {error ? (

            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">

              <X className="text-red-400 mb-4" />

              <p className="text-sm text-zinc-400 mb-4">
                {error}
              </p>

              <button
                onClick={() => {
                  if (!image) return;

                  const matches = image.match(/^data:(.+);base64,(.+)$/);
                  if (matches) handleTranslate(matches[2], matches[1]);
                }}
                className="px-4 py-2 bg-zinc-100 text-black rounded text-sm"
              >
                Retry
              </button>

            </div>

          ) : (

            <TranslationPanel
              result={result}
              isLoading={isLoading}
              loadingStatus={loadingStatus}
            />

          )}

        </div>

      </main>
    </div>
  );
}