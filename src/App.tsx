import GlobeView from "./components/globe/GlobeView";

export default function App() {
  return (
    <div className="min-h-screen bg-yc-bg-deep text-yc-text-primary font-body">
      <header className="flex items-center justify-between px-6 py-4 border-b border-yc-border">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Yanco<span className="text-yc-green">Cup</span>
        </h1>
        <span className="text-yc-text-tertiary text-sm font-mono">
          World Cup 2026
        </span>
      </header>

      <main className="relative">
        <GlobeView />
      </main>
    </div>
  );
}
