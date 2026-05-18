import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { Area } from 'react-easy-crop';
import { X, Check, RefreshCw } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onCropped: (blob: Blob) => void;
  aspect?: number;
  title?: string;
  output?: { width: number; height: number; mime?: string; quality?: number };
}

async function getCroppedBlob(
  imageSrc: string,
  area: Area,
  output: { width: number; height: number; mime?: string; quality?: number },
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.drawImage(
    img,
    area.x, area.y, area.width, area.height,
    0, 0, output.width, output.height,
  );
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Crop failed'))),
      output.mime || 'image/jpeg',
      output.quality ?? 0.9,
    );
  });
}

export default function ImageCropModal({
  isOpen, file, onClose, onCropped,
  aspect = 1, title = 'Crop Photo',
  output = { width: 512, height: 512, mime: 'image/jpeg', quality: 0.9 },
}: ImageCropModalProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!file) { setSrc(null); return; }
    const reader = new FileReader();
    reader.onload = () => setSrc(reader.result as string);
    reader.readAsDataURL(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
  }, [file]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const handleSave = async () => {
    if (!src || !area) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(src, area, output);
      onCropped(blob);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen || !file) return null;

  const node = (
    <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-background/85 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md my-auto glass-strong rounded-3xl border border-border shadow-card overflow-hidden flex flex-col"
           style={{ maxHeight: 'calc(100dvh - 1.5rem)' }}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="relative bg-black" style={{ height: 'min(60vh, 360px)' }}>
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Zoom</label>
            <input
              type="range" min={1} max={3} step={0.05} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-border rounded-xl text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button onClick={handleSave} disabled={busy || !area}
              className="flex-1 gradient-primary text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
              <span>Use Photo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}
