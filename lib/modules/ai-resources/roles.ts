export const AI_RESOURCE_ROLES = ['user', 'reviewer', 'admin'] as const;
export type AiResourceRole = (typeof AI_RESOURCE_ROLES)[number];

export const AI_RESOURCE_ROLE_RANK: Record<AiResourceRole, number> = {
  user: 1,
  reviewer: 2,
  admin: 3,
};

export function isAiResourceRole(value: string): value is AiResourceRole {
  return (AI_RESOURCE_ROLES as readonly string[]).includes(value);
}

export function hasAiResourceRole(actual: AiResourceRole, minimum: AiResourceRole) {
  return AI_RESOURCE_ROLE_RANK[actual] >= AI_RESOURCE_ROLE_RANK[minimum];
}
