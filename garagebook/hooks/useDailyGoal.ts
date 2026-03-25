'use client';
import { useState, useEffect } from 'react';

const KEY = 'gb_daily_goal';

export function useDailyGoal() {
  const [goal, setGoalState] = useState(0);

  useEffect(() => {
    const saved = Number(localStorage.getItem(KEY));
    if (saved > 0) setGoalState(saved);
  }, []);

  function setGoal(n: number) {
    setGoalState(n);
    localStorage.setItem(KEY, String(n));
  }

  return { goal, setGoal };
}
