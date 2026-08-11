import {
  FEEDBACK_IMAGE_TYPES,
  FEEDBACK_MAX_FILE_SIZE_BYTES,
  FEEDBACK_MAX_FILE_SIZE_LABEL,
  isFeedbackImageType,
} from './constants';

export function feedbackFileError(file: File) {
  if (!file.size) return `${file.name} 不能为空。`;
  if (file.size > FEEDBACK_MAX_FILE_SIZE_BYTES) {
    return `${file.name} 超过 ${FEEDBACK_MAX_FILE_SIZE_LABEL}。`;
  }
  if (!isFeedbackImageType(file.type)) {
    return `${file.name} 不是支持的图片格式。`;
  }
  return null;
}

export async function detectFeedbackImageType(file: File): Promise<(typeof FEEDBACK_IMAGE_TYPES)[number] | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}
