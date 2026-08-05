export type LegacyDirectoryUser = {
  id: string;
  username: string;
  email: string | null;
  status: string;
};

export type AuthingManifestEntry = {
  subject: string;
  issuer?: string;
  username?: string | null;
  email?: string | null;
  name?: string | null;
  avatar?: string | null;
};

export type IdentityMigrationDecision =
  | { kind: 'link'; entry: AuthingManifestEntry; user: LegacyDirectoryUser; matchedBy: 'username' | 'email' }
  | { kind: 'ambiguous'; entry: AuthingManifestEntry; candidates: LegacyDirectoryUser[] }
  | { kind: 'unmatched'; entry: AuthingManifestEntry };

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() || null;
}

export function buildIdentityMigrationPlan(
  users: LegacyDirectoryUser[],
  entries: AuthingManifestEntry[],
): IdentityMigrationDecision[] {
  const byUsername = new Map<string, LegacyDirectoryUser[]>();
  const byEmail = new Map<string, LegacyDirectoryUser[]>();
  for (const user of users) {
    const username = normalized(user.username);
    const email = normalized(user.email);
    if (username) byUsername.set(username, [...(byUsername.get(username) ?? []), user]);
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), user]);
  }

  return entries.map((entry) => {
    const usernameCandidates = entry.username
      ? byUsername.get(normalized(entry.username)!) ?? []
      : [];
    const emailCandidates = entry.email
      ? byEmail.get(normalized(entry.email)!) ?? []
      : [];
    const candidates = new Map<string, LegacyDirectoryUser>();
    const preferredCandidates = usernameCandidates.length ? usernameCandidates : emailCandidates;
    for (const user of preferredCandidates) candidates.set(user.id, user);

    if (candidates.size === 0) return { kind: 'unmatched', entry };
    if (candidates.size > 1) {
      return { kind: 'ambiguous', entry, candidates: Array.from(candidates.values()) };
    }
    const user = Array.from(candidates.values())[0]!;
    return {
      kind: 'link',
      entry,
      user,
      matchedBy: usernameCandidates.length ? 'username' : 'email',
    };
  });
}
