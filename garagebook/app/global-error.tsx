'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html><body>
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h2 className="text-xl font-bold text-red-600">Kuch galat ho gaya!</h2>
        <button onClick={reset} className="px-4 py-2 bg-[#e94560] text-white rounded-lg">Dobara Try Karo</button>
      </div>
    </body></html>
  );
}
