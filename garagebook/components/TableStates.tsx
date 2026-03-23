export function LoadingRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}><div className="skeleton" style={{ height: '14px', borderRadius: '4px', width: j === 0 ? '60%' : '80%' }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ErrorRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} style={{ textAlign: 'center', padding: '32px', color: '#ef4444', fontSize: '13px' }}>
        ⚠️ {msg}
      </td>
    </tr>
  );
}

export function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: '13px' }}>
        {msg}
      </td>
    </tr>
  );
}
