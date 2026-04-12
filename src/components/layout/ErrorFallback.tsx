export default function ErrorFallback({ error, componentStack }: { error?: Error; componentStack?: string }) {

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="text-4xl mb-4">:(</div>
      <h2 className="font-heading text-xl font-bold mb-2">
        Something went wrong
      </h2>
      <p className="text-yc-text-secondary text-sm mb-6 max-w-md">
        An unexpected error occurred. Try refreshing the page.
      </p>
      {error && (
        <pre className="text-yc-danger text-xs text-start bg-yc-bg-surface rounded-lg p-3 mb-4 max-w-md overflow-auto max-h-40 w-full">
          {error.message}
          {componentStack && `\n\nComponent Stack:${componentStack}`}
        </pre>
      )}
      <button
        onClick={() => window.location.reload()}
        className="bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all"
      >
        Refresh
      </button>
    </div>
  );
}
