"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="font-serif text-2xl text-royal">Something went wrong</p>
      <p className="max-w-md text-sm text-royal-soft">
        {error.message || "Please try again."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep"
      >
        Try again
      </button>
    </div>
  );
}
