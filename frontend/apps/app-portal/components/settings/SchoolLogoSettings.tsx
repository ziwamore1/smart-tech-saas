'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { schoolApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permission-context';

const OUTPUT_SIZE = 512;
const TO_RADIANS = Math.PI / 180;

function initialsOf(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

function drawCropped(image: HTMLImageElement, crop: PixelCrop, rotationDeg: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported in this browser');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
  ctx.rotate((rotationDeg * TO_RADIANS));
  ctx.scale(1, 1);
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    -OUTPUT_SIZE / 2,
    -OUTPUT_SIZE / 2,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );
  ctx.restore();
  return canvas;
}

export function SchoolLogoSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const readOnly = permissions.isReadOnly('settings.edit');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [selectedSrc, setSelectedSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotation, setRotation] = useState(0);
  const [showCropper, setShowCropper] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { data: branding, isLoading } = useQuery({
    queryKey: ['school-branding'],
    queryFn: () => schoolApi.getBranding().then((res) => res.data?.data || res.data),
    staleTime: 30_000,
  });

  useEffect(() => () => { if (selectedSrc) URL.revokeObjectURL(selectedSrc); }, [selectedSrc]);

  const uploadMutation = useMutation({
    mutationFn: async (blob: Blob) => {
      const formData = new FormData();
      formData.append('logo', blob, 'school-logo.png');
      return schoolApi.uploadLogo(formData);
    },
    onSuccess: () => {
      closeCropper();
      queryClient.invalidateQueries({ queryKey: ['school-branding'] });
      queryClient.invalidateQueries({ queryKey: ['school-profile'] });
      queryClient.invalidateQueries({ queryKey: ['school', user?.schoolId] });
      setLogoError(null);
    },
    onError: (err: any) => {
      setLogoError(err?.response?.data?.message || 'Failed to upload logo. Please try again.');
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => schoolApi.deleteLogo(),
    onSuccess: () => {
      setConfirmRemove(false);
      queryClient.invalidateQueries({ queryKey: ['school-branding'] });
      queryClient.invalidateQueries({ queryKey: ['school-profile'] });
      queryClient.invalidateQueries({ queryKey: ['school', user?.schoolId] });
    },
    onError: () => setLogoError('Failed to remove logo. Please try again.'),
  });

  const logoUrl: string | null = branding?.logoUrl || null;
  const schoolName: string = branding?.name || '';

  const openFilePicker = () => {
    setLogoError(null);
    fileInputRef.current?.click();
  };

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Image is larger than 5MB. Please choose a smaller file.');
      return;
    }
    if (!/^image\/(jpeg|png|webp|svg\+xml)$/.test(file.type)) {
      setLogoError('Please choose a JPEG, PNG, WEBP or SVG image.');
      return;
    }
    if (selectedSrc) URL.revokeObjectURL(selectedSrc);
    const url = URL.createObjectURL(file);
    setSelectedSrc(url);
    setRotation(0);
    setShowCropper(true);
    setLogoError(null);
  };

  const onImageLoaded = (img: HTMLImageElement) => {
    imageRef.current = img;
    setCrop(centerAspectCrop(img.width, img.height));
  };

  const closeCropper = () => {
    setShowCropper(false);
    setSelectedSrc(null);
    setCompletedCrop(undefined);
    setRotation(0);
  };

  const applyCrop = async () => {
    const img = imageRef.current;
    if (!img || !completedCrop || completedCrop.width < 8 || completedCrop.height < 8) {
      setLogoError('Drag a selection area over the image first.');
      return;
    }
    try {
      const canvas = drawCropped(img, completedCrop, rotation);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      );
      if (!blob) {
        setLogoError('Could not process the image. Try another file.');
        return;
      }
      uploadMutation.mutate(blob);
    } catch {
      setLogoError('Could not process the image. Try another file.');
    }
  };

  const rotateBy = (delta: number) => setRotation((r) => (((r + delta) % 360) + 360) % 360);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={onFileChosen}
      />

      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            School Logo
            <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
              School branding
            </span>
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Shown next to your school name on the dashboard and on report cards.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Preview */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          {isLoading ? (
            <div className="h-24 w-24 rounded-2xl bg-gray-100 animate-pulse" />
          ) : logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${schoolName} logo`}
              className="h-24 w-24 rounded-2xl object-cover ring-1 ring-gray-200 shadow-sm"
            />
          ) : (
            <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-inner">
              <span className="text-white text-2xl font-bold tracking-wider">{initialsOf(schoolName)}</span>
            </div>
          )}
          <span className="text-[11px] text-gray-400 font-medium">512 × 512 px</span>
        </div>

        {/* Actions */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openFilePicker}
              disabled={readOnly}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" />
              </svg>
              {logoUrl ? 'Replace Logo' : 'Upload Logo'}
            </button>
            {logoUrl && (
              <button
                onClick={() => setConfirmRemove(true)}
                disabled={readOnly}
                className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove
              </button>
            )}
          </div>

          <p className="mt-3 text-xs text-gray-500 leading-relaxed">
            PNG, JPG, WEBP or SVG &middot; up to 5MB &middot; square images work best.
            You can crop and rotate after selecting a file.
          </p>

          <div className="mt-4 flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <svg className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-gray-500 leading-relaxed">
              This is <span className="font-medium text-gray-700">your school&apos;s own logo</span> — it is
              completely separate from the SmartTech platform logo, which stays the same for everyone.
              Each school only ever sees and manages its own logo.
            </p>
          </div>

          {logoError && (
            <div className="mt-3 px-3 py-2 bg-red-50 text-red-700 text-sm border border-red-200 rounded-lg">
              {logoError}
            </div>
          )}
        </div>
      </div>

      {/* Remove confirmation */}
      {confirmRemove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmRemove(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-semibold text-gray-900">Remove school logo?</h4>
            <p className="text-sm text-gray-500 mt-2">
              The dashboard will fall back to your school&apos;s initials. You can upload a new logo at any time.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setConfirmRemove(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => removeMutation.mutate()}
                disabled={removeMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {removeMutation.isPending ? 'Removing...' : 'Yes, remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {showCropper && selectedSrc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">Adjust your logo</h4>
              <p className="text-xs text-gray-500 mt-0.5">Drag to position, then apply. It will be saved as a clean square image.</p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <div className="rounded-lg bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#ffffff_0%_50%)] bg-[length:20px_20px] p-2">
                  <div style={{ maxHeight: '360px' }} className="mx-auto w-fit">
                    <ReactCrop
                      crop={crop}
                      onChange={(_, percentCrop) => setCrop(percentCrop)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={1}
                      circularCrop
                      minWidth={40}
                      minHeight={40}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedSrc}
                        alt="Crop source"
                        onLoad={(e) => onImageLoaded(e.currentTarget)}
                        style={{ maxHeight: '340px', maxWidth: '100%', touchAction: 'none' }}
                      />
                    </ReactCrop>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => rotateBy(-90)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                      title="Rotate left"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v3M3 10l4-4M3 10l4 4" /></svg>
                      Left
                    </button>
                    <button
                      onClick={() => rotateBy(90)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                      title="Rotate right"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v3m15-8l-4-4m4 4l-4 4" /></svg>
                      Right
                    </button>
                    <span className="text-xs text-gray-400 ml-1">Rotation: {rotation}°</span>
                  </div>
                  <button onClick={() => { if (imageRef.current) setCrop(centerAspectCrop(imageRef.current.width, imageRef.current.height)); }} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    Reset selection
                  </button>
                </div>
              </div>

              <div className="md:col-span-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Preview</p>
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 flex items-center justify-center">
                  {completedCrop ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <canvas
                      ref={(canvas) => {
                        const img = imageRef.current;
                        if (canvas && img && completedCrop) {
                          const cropped = drawCropped(img, completedCrop, rotation);
                          canvas.width = cropped.width;
                          canvas.height = cropped.height;
                          canvas.getContext('2d')?.drawImage(cropped, 0, 0);
                        }
                      }}
                      className="h-28 w-28 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-28 w-28 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">
                      <span className="text-xs">Preview</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-2 text-center">How it appears on the dashboard</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-400 hidden sm:block">Exports at 512 × 512 px PNG</span>
              <div className="flex gap-2 ml-auto">
                <button onClick={closeCropper} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={applyCrop}
                  disabled={uploadMutation.isPending}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Uploading...
                    </>
                  ) : (
                    'Apply & Upload'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
