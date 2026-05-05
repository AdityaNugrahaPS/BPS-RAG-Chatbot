import { useState, useRef } from 'react'
import clsx from 'clsx'

interface UploadAreaProps {
  files?: File[]
  onFilesChange?: (files: File[]) => void
  maxFiles?: number
  maxSizeMB?: number
}

interface FileRowProps {
  file: File
  onRemove: () => void
}

function fmt(bytes: number) {
  if (!bytes) return '0 B'
  const k = 1024, s = ['B','KB','MB','GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + s[i]
}

function FileRow({ file, onRemove }: FileRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface rounded-xl group"
      style={{ border: '1px solid var(--bdr-2)' }}>
      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-accent">
          <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h5L11 4.5V11.5A1.5 1.5 0 0 1 9.5 13h-6A1.5 1.5 0 0 1 2 11.5v-9Z"
            stroke="currentColor" strokeWidth="1.2" />
          <path d="M8.5 1v3.5H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-t1 truncate">{file.name}</p>
        <p className="text-xs text-t4">{fmt(file.size)}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-success flex-shrink-0">
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M4.5 7L6.5 9L9.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <button onClick={() => onRemove()} className="ml-1 w-6 h-6 rounded-lg flex items-center justify-center
        transition-colors hover:bg-red-500/15"
        style={{ color: '#FF453A' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
  )
}

export default function UploadArea({ files = [], onFilesChange, maxFiles = 10, maxSizeMB = 200 }: UploadAreaProps) {
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const add = (incoming: FileList | null) => {
    if (!incoming) return
    const valid = Array.from(incoming)
      .filter(f => f.name.toLowerCase().endsWith('.pdf') && f.size <= maxSizeMB * 1024 * 1024)
    const next = [...files, ...valid].slice(0, maxFiles)
    onFilesChange?.(next)
  }

  const remove = (i: number) => {
    const next = files.filter((_, idx) => idx !== i)
    onFilesChange?.(next)
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }}
        onClick={() => ref.current?.click()}
        className={clsx(
          'relative flex flex-col items-center justify-center gap-4 h-44 rounded-2xl',
          'border-2 border-dashed cursor-pointer transition-all duration-200',
          drag ? 'border-accent bg-accent/[0.06] scale-[0.995]' : 'hover:border-accent/40 hover:bg-accent/[0.025]',
        )}
        style={!drag ? { borderColor: 'var(--bdr-4)' } : {}}
      >
        <input ref={ref} type="file" accept=".pdf" multiple className="hidden"
          onChange={e => add(e.target.files)} />

        <div className={clsx(
          'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200',
          drag ? 'bg-accent/20 text-accent' : 'text-t4',
        )}
        style={!drag ? { background: 'var(--fill-3)' } : {}}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13V4M7 7L10 4l3 3" />
            <path d="M3 15h14" />
          </svg>
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-t1">
            {drag ? 'Lepaskan file di sini' : 'Drag & drop atau klik untuk memilih'}
          </p>
          <p className="text-xs text-t4">
            PDF · Maks {maxSizeMB} MB per file · hingga {maxFiles} file
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          {files.map((f, i) => (
            <FileRow key={i} file={f} onRemove={() => remove(i)} />
          ))}
        </div>
      )}
    </div>
  )
}
