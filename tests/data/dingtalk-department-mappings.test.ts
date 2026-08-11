import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type DepartmentMapping = {
  id: string;
  name: string;
  parentId: string | null;
};

describe('DingTalk department mapping JSON', () => {
  it('contains 73 unique nodes with valid parent references', () => {
    const payload = JSON.parse(
      readFileSync('db/seed-data/dingtalk-department-mappings.json', 'utf8'),
    ) as { departments: DepartmentMapping[] };
    const departments = payload.departments;
    const ids = new Set(departments.map((department) => department.id));

    expect(departments).toHaveLength(73);
    expect(ids.size).toBe(departments.length);
    expect(departments.every((department) => Object.keys(department).sort().join(',') === 'id,name,parentId')).toBe(true);
    expect(departments.every((department) => department.id && department.name)).toBe(true);
    expect(departments.every((department) => (
      department.parentId === null || ids.has(department.parentId)
    ))).toBe(true);
    expect(departments.every((department) => department.id !== department.parentId)).toBe(true);
  });
});
