import { useState } from 'react'
import { Music2 } from 'lucide-react'
import { cn } from '../lib/format'

interface Props {
  src?: string
  alt?: string
  className?: string
  rounded?: string
}

/** Обложка с плавным появлением и заглушкой, если картинки нет или она не загрузилась */
export function Cover({ src, alt = '', className, rounded = 'rounded-lg' }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const showImg = src && !failed
  return (
    <div className={cn('relative shrink-0 overflow-hidden bg-elev', rounded, className)}>
      {!loaded && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-elev to-hover text-faint">
          <Music2 className="size-1/3 min-h-4 min-w-4" strokeWidth={1.6} />
        </div>
      )}
      {showImg && (
        <img
          src={src}
          alt={alt}
          crossOrigin="anonymous"
          draggable={false}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn('absolute inset-0 size-full object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </div>
  )
}
