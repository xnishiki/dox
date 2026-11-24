import { cn } from '../lib/format'

/** Маленький «эквалайзер» у играющего трека */
export function PlayingBars({ paused, className }: { paused?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex h-3.5 items-end gap-[2px]', className)} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-sun"
          style={{
            height: paused ? 3 : undefined,
            animation: paused ? 'none' : `pulse-bar 0.9s ${-i * 0.23}s ease-in-out infinite`,
          }}
        />
      ))}
      <style>{`@keyframes pulse-bar{0%,100%{height:3px}50%{height:14px}}`}</style>
    </span>
  )
}
