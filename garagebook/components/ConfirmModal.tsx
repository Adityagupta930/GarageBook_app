'use client';
import { useEffect } from 'react';

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ message, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter')  onConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onConfirm, onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <p style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '20px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn-gray" onClick={onCancel}>Cancel</button>
          <button className="btn" style={{ background: '#dc2626' }} onClick={onConfirm} autoFocus>Delete</button>
        </div>
      </div>
    </div>
  );
}
