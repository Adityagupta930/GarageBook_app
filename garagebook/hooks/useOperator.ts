'use client';
import { useState, useEffect } from 'react';

const KEY = 'pa_operator';

export function useOperator() {
  const [operator, setOperatorState] = useState('');
  const [asking, setAsking]          = useState(false);
  const [input, setInput]            = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved) setOperatorState(saved);
    else setAsking(true);
  }, []);

  function confirm() {
    const name = input.trim();
    if (!name) return;
    localStorage.setItem(KEY, name);
    setOperatorState(name);
    setAsking(false);
  }

  function change() {
    setInput(operator);
    setAsking(true);
  }

  return { operator, asking, input, setInput, confirm, change };
}
