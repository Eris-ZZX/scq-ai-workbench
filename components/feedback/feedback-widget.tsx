'use client';

/* eslint-disable @next/next/no-img-element */
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, MessageSquarePlus, Send, X } from 'lucide-react';
import {
  FEEDBACK_APPLICATIONS,
  FEEDBACK_IMAGE_TYPES,
  FEEDBACK_MAX_ATTACHMENTS,
  FEEDBACK_MAX_CONTENT_LENGTH,
  FEEDBACK_MAX_FILE_SIZE_BYTES,
  FEEDBACK_MAX_FILE_SIZE_LABEL,
} from '@/lib/feedback/constants';

type PickedImage = {
  file: File;
  previewUrl: string;
};

export default function FeedbackWidget({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [application, setApplication] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!enabled) return null;

  function close() {
    if (submitting) return;
    clearImages();
    setOpen(false);
    setContent('');
    setApplication('');
    setError('');
    setSubmitted(false);
  }

  function clearImages() {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setImages([]);
  }

  function addImages(files: Iterable<File> | null) {
    if (!files) return;
    setError('');
    const next = [...images];
    for (const file of Array.from(files)) {
      if (next.length >= FEEDBACK_MAX_ATTACHMENTS) {
        setError(`最多上传 ${FEEDBACK_MAX_ATTACHMENTS} 张图片。`);
        break;
      }
      if (!FEEDBACK_IMAGE_TYPES.includes(file.type as (typeof FEEDBACK_IMAGE_TYPES)[number])) {
        setError(`${file.name} 不是支持的图片格式。`);
        continue;
      }
      if (file.size > FEEDBACK_MAX_FILE_SIZE_BYTES) {
        setError(`${file.name} 超过 ${FEEDBACK_MAX_FILE_SIZE_LABEL}。`);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setImages(next);
  }

  function removeImage(index: number) {
    const image = images[index];
    if (image) URL.revokeObjectURL(image.previewUrl);
    setImages(images.filter((_, currentIndex) => currentIndex !== index));
  }

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed) {
      setError('请填写反馈内容。');
      return;
    }
    if (trimmed.length > FEEDBACK_MAX_CONTENT_LENGTH) {
      setError(`反馈内容不能超过 ${FEEDBACK_MAX_CONTENT_LENGTH} 个字符。`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const body = new FormData();
      body.set('content', trimmed);
      body.set('application', application);
      body.set('pagePath', pathname);
      images.forEach((image) => body.append('files', image.file));

      const response = await fetch('/api/feedback', { method: 'POST', body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '反馈提交失败，请稍后重试。');

      clearImages();
      setContent('');
      setApplication('');
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '反馈提交失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="提交反馈"
        onClick={() => { setOpen(true); setSubmitted(false); }}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
      >
        <MessageSquarePlus className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="feedback-title" className="text-lg font-semibold text-slate-900">反馈</h2>
                <p className="mt-1 text-sm text-slate-600">说说平台本身的问题或建议,我们会有人看</p>
              </div>
              <button
                type="button"
                aria-label="关闭反馈"
                onClick={close}
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {submitted ? (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Send className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">反馈已提交</h3>
                <p className="mt-1 text-sm text-slate-500">感谢你的建议，我们会及时查看。</p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  完成
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  onPaste={(event) => {
                    const pastedImages = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
                    if (pastedImages.length > 0) {
                      addImages(pastedImages);
                    }
                  }}
                  maxLength={FEEDBACK_MAX_CONTENT_LENGTH}
                  placeholder="说说你遇到的问题或建议,截图可直接粘贴进来"
                  className="mt-5 min-h-28 w-full resize-y rounded-md border border-blue-500 px-3 py-3 text-sm text-slate-900 outline-none ring-2 ring-blue-100 placeholder:text-slate-400"
                />

                <div className="mt-3 flex items-center gap-3">
                  <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-500 transition hover:border-blue-500 hover:text-blue-600">
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      multiple
                      className="sr-only"
                      onChange={(event) => {
                        addImages(event.target.files);
                        event.target.value = '';
                      }}
                    />
                    <ImagePlus className="h-5 w-5" />
                  </label>
                  <span className="text-sm text-slate-500">
                    最多 {FEEDBACK_MAX_ATTACHMENTS} 张，单张 {FEEDBACK_MAX_FILE_SIZE_LABEL}
                  </span>
                </div>

                {images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {images.map((image, index) => (
                      <div key={`${image.file.name}-${image.file.lastModified}`} className="group relative aspect-video overflow-hidden rounded-md bg-slate-100">
                        <img src={image.previewUrl} alt={image.file.name} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          aria-label={`删除${image.file.name}`}
                          onClick={() => removeImage(index)}
                          className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="mt-4 block text-sm text-slate-700">
                  <span className="mb-1.5 block">关联应用(可选)</span>
                  <select
                    value={application}
                    onChange={(event) => setApplication(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">不关联</option>
                    {FEEDBACK_APPLICATIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>

                {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}

                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting}
                  className="mt-6 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  提交
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
