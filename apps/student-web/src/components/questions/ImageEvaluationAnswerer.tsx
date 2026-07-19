import { useState, useRef } from "react";
import type { ImageEvaluationData } from "@levelup/shared-types";
import { Upload, X } from "lucide-react";

interface ImageEvaluationAnswererProps {
  data: ImageEvaluationData;
  value?: File[];
  onChange: (value: File[]) => void;
  disabled?: boolean;
}

export default function ImageEvaluationAnswerer({
  data,
  value = [],
  onChange,
  disabled,
}: ImageEvaluationAnswererProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    const maxImages = data.maxImages ?? 5;
    const remaining = maxImages - value.length;
    const newFiles = Array.from(files).slice(0, remaining);

    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
    onChange([...value, ...newFiles]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]!);
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    onChange(value.filter((_, i) => i !== index));
  };

  const maxImages = data.maxImages ?? 5;

  return (
    <div>
      <p className="mb-2 text-sm">{data.instructions}</p>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {previews.map((url, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded border">
            <img
              src={url}
              alt={`Upload ${i + 1}`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {value.length < maxImages && !disabled && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="border-input text-muted-foreground hover:border-primary hover:text-primary flex w-full items-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm"
        >
          <Upload className="h-5 w-5" />
          Upload image ({value.length}/{maxImages})
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
