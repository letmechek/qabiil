export default function PublicLoading() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[55]">
      <div className="h-1 w-full overflow-hidden bg-cyan-100">
        <div className="h-full w-1/3 animate-[navLoad_1.1s_ease-in-out_infinite] bg-cyan-600" />
      </div>
      <div className="absolute right-4 top-3 rounded-full border border-cyan-200 bg-white/95 px-3 py-1 text-xs font-semibold text-cyan-700 shadow-sm">
        Loading page...
      </div>
    </div>
  );
}
