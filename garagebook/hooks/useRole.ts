'use client';
import { useState, useEffect, useCallback } from 'react';

export type Role = 'owner' | 'staff';

const KEY = 'gb_role';

export function useRole() {
  const [role, setRoleState] = useState<Role>('owner');

  useEffect(() => {
    const saved = localStorage.getItem(KEY) as Role | null;
    if (saved === 'owner' || saved === 'staff') setRoleState(saved);
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    localStorage.setItem(KEY, r);
  }, []);

  const isOwner = role === 'owner';

  return { role, setRole, isOwner };
}
