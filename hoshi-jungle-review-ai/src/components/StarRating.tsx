export function StarRating({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-sm"
      aria-label={`${rating} / 5`}
      title={`${rating} / 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? 'text-amber-500' : 'text-jungle-200'}>
          ★
        </span>
      ))}
    </span>
  );
}
