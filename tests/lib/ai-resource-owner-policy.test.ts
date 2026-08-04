import { describe, expect, it } from 'vitest';
import type { AiResourceActor } from '@/modules/ai-resources/guards';
import { canEditResource, canRequestArchive } from '@/modules/ai-resources/policy';

function actor(userId: string): AiResourceActor {
  return {
    userId,
    username: userId,
    workbenchRole: 'user',
    moduleRole: 'user',
    membershipId: null,
    isEffectiveAdmin: false,
  };
}

const resource = {
  createdById: 'uploader',
  ownerId: 'owner',
  status: 'PUBLISHED',
};

describe('AI resource owner permissions', () => {
  it('allows the owner and uploader to edit, but not an unrelated user', () => {
    expect(canEditResource(actor('owner'), resource)).toBe(true);
    expect(canEditResource(actor('uploader'), resource)).toBe(true);
    expect(canEditResource(actor('other'), resource)).toBe(false);
  });

  it('allows the owner and uploader to request archive', () => {
    expect(canRequestArchive(actor('owner'), resource)).toBe(true);
    expect(canRequestArchive(actor('uploader'), resource)).toBe(true);
    expect(canRequestArchive(actor('other'), resource)).toBe(false);
    expect(canRequestArchive(actor('owner'), { ...resource, status: 'ARCHIVED' })).toBe(false);
  });
});
