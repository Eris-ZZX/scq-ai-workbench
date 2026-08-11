import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession, mockRequireAdmin, mockDatabase, mockPutObject } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRequireAdmin: vi.fn(),
  mockPutObject: vi.fn(),
  mockDatabase: {
    feedbackLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/platform/auth/auth.config', () => ({ getSession: mockGetSession }));
vi.mock('@/platform/permissions/system-admin', () => ({ requireSystemAdminApi: mockRequireAdmin }));
vi.mock('@/lib/database', () => ({ db: mockDatabase }));
vi.mock('@/lib/storage', () => ({
  putFeedbackObject: mockPutObject,
  removeFeedbackObject: vi.fn(),
  getFeedbackObject: vi.fn(),
  isStorageNotFound: vi.fn(),
}));

import { POST } from '@/app/api/feedback/route';
import { GET } from '@/app/api/admin/feedback/route';

const session = {
  sub: 'user-1',
  username: 'tester',
  displayName: '测试用户',
  role: 'user',
  platformRole: 'user',
};

function feedbackRequest(content: string, file?: File) {
  const body = new FormData();
  body.set('content', content);
  if (file) body.append('files', file);
  return new Request('http://localhost/api/feedback', { method: 'POST', body });
}

describe('/api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(session);
    mockPutObject.mockResolvedValue(undefined);
    mockDatabase.feedbackLog.create.mockResolvedValue({
      id: 'feedback-1',
      createdAt: new Date('2026-08-11T01:00:00.000Z'),
    });
  });

  it('rejects unauthenticated feedback', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const response = await POST(feedbackRequest('问题描述'));

    expect(response.status).toBe(401);
    expect(mockDatabase.feedbackLog.create).not.toHaveBeenCalled();
  });

  it('rejects an image whose content does not match its MIME type', async () => {
    const fakePng = new File(['not a png'], 'screen.png', { type: 'image/png' });

    const response = await POST(feedbackRequest('问题描述', fakePng));

    expect(response.status).toBe(400);
    expect(mockPutObject).not.toHaveBeenCalled();
  });

  it('stores valid feedback and image metadata', async () => {
    const png = new File([
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], 'screen.png', { type: 'image/png' });

    const response = await POST(feedbackRequest('页面按钮无法点击', png));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.feedback.id).toBe('feedback-1');
    expect(mockPutObject).toHaveBeenCalledTimes(1);
    expect(mockDatabase.feedbackLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        content: '页面按钮无法点击',
        attachments: expect.stringContaining('"type":"image/png"'),
      }),
    }));
  });
});

describe('/api/admin/feedback', () => {
  it('rejects non-admin log reads', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ error: '需要平台管理员权限', status: 403 });

    const response = await GET(new Request('http://localhost/api/admin/feedback'));

    expect(response.status).toBe(403);
    expect(mockDatabase.feedbackLog.findMany).not.toHaveBeenCalled();
  });
});
