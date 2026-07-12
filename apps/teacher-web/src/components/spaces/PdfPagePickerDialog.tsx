/**
 * PdfPagePickerDialog — CC-6 Approach B.
 *
 * Teacher loads a PDF or images, selects pages from a thumbnail grid, and
 * attaches them to the current item via v1.autograde.requestUploadUrl
 * (kind: 'item-media'). The returned storage paths are passed to
 * `onPagesAttached` and appended to item.attachments[] in the caller.
 *
 * Only uploads JPEG page renders — no PDF binary reaches item-media storage.
 * 14MB budget per page is not a concern in practice (JPEG renders ≤ ~1–2 MB).
 */
import { useState, useRef } from "react";
import { convertPdfToImages, fileToBase64 } from "@levelup/shared-utils";
import { useUploadImage } from "@levelup/query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Checkbox,
  sonnerToast,
} from "@levelup/shared-ui";
import { Upload, Loader2, FileImage } from "lucide-react";

interface PageInfo {
  index: number;
  dataUrl: string;
  name: string;
}

export interface AttachedPageResult {
  url: string;
  name: string;
  sizeBytes: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  itemId: string;
  onPagesAttached: (pages: AttachedPageResult[]) => void;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const header = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const contentType = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: contentType });
}

export default function PdfPagePickerDialog({
  open,
  onOpenChange,
  spaceId,
  itemId,
  onPagesAttached,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadImage = useUploadImage();

  function reset() {
    setPages([]);
    setSelected(new Set());
    setLoading(false);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    if (loading || uploading) return;
    reset();
    onOpenChange(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    setLoading(true);
    setPages([]);
    setSelected(new Set());
    try {
      const newPages: PageInfo[] = [];
      for (const file of files) {
        if (file.type === "application/pdf") {
          const dataUrls = await convertPdfToImages(file);
          const baseName = file.name.replace(/\.pdf$/i, "");
          for (let i = 0; i < dataUrls.length; i++) {
            newPages.push({
              index: newPages.length,
              dataUrl: dataUrls[i],
              name: dataUrls.length === 1 ? baseName : `${baseName} — Page ${i + 1}`,
            });
          }
        } else if (file.type.startsWith("image/")) {
          const dataUrl = await fileToBase64(file);
          newPages.push({
            index: newPages.length,
            dataUrl,
            name: file.name.replace(/\.[^.]+$/, ""),
          });
        }
      }
      setPages(newPages);
      setSelected(new Set(newPages.map((p) => p.index)));
    } catch (err) {
      sonnerToast.error(err instanceof Error ? err.message : "Failed to load file");
    } finally {
      setLoading(false);
    }
  }

  function togglePage(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleAttach() {
    const toAttach = pages.filter((p) => selected.has(p.index));
    if (!toAttach.length) return;
    setUploading(true);
    const results: AttachedPageResult[] = [];
    try {
      for (const page of toAttach) {
        const blob = dataUrlToBlob(page.dataUrl);
        const path = (await uploadImage.mutateAsync({
          kind: "item-media",
          spaceId,
          itemId,
          contentType: "image/jpeg",
          body: blob,
        })) as string;
        results.push({ url: path, name: page.name, sizeBytes: blob.size });
      }
      onPagesAttached(results);
      sonnerToast.success(`Attached ${results.length} page${results.length === 1 ? "" : "s"}`);
      reset();
      onOpenChange(false);
    } catch (err) {
      sonnerToast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const selectedCount = selected.size;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            Pick pages to attach
          </DialogTitle>
          <DialogDescription>
            Load a PDF or images. Select the pages you want to attach to this item.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {pages.length === 0 && !loading && (
            <button
              type="button"
              className="border-subtle hover:bg-muted/30 flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-12 text-center transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="text-muted-foreground h-10 w-10" />
              <div>
                <p className="font-medium">Click to load a PDF or images</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  PDF pages will be rendered as images
                </p>
              </div>
            </button>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="text-brand h-10 w-10 animate-spin" />
              <p className="text-muted-foreground text-sm">Rendering pages…</p>
            </div>
          )}

          {!loading && pages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {pages.length} page{pages.length !== 1 ? "s" : ""} loaded
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    Load different file
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(new Set(pages.map((p) => p.index)))}
                    disabled={uploading}
                  >
                    Select all
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(new Set())}
                    disabled={uploading}
                  >
                    Deselect all
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {pages.map((page) => (
                  <button
                    key={page.index}
                    type="button"
                    className={`relative cursor-pointer overflow-hidden rounded-lg border-2 transition-colors ${
                      selected.has(page.index) ? "border-primary" : "border-subtle"
                    }`}
                    onClick={() => togglePage(page.index)}
                    disabled={uploading}
                  >
                    <img
                      src={page.dataUrl}
                      alt={page.name}
                      className="h-auto w-full object-cover"
                      style={{ aspectRatio: "3/4" }}
                    />
                    <div className="absolute left-2 top-2">
                      <Checkbox
                        checked={selected.has(page.index)}
                        onCheckedChange={() => togglePage(page.index)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${page.name}`}
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                      <p className="truncate text-xs text-white">{page.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <Button variant="outline" onClick={handleClose} disabled={loading || uploading}>
            Cancel
          </Button>
          <Button onClick={handleAttach} disabled={selectedCount === 0 || loading || uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Attaching…
              </>
            ) : (
              <>
                <FileImage className="h-4 w-4" />
                {selectedCount > 0
                  ? `Attach ${selectedCount} page${selectedCount !== 1 ? "s" : ""}`
                  : "Select pages to attach"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
