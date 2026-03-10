import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label className="font-body text-white/70 text-sm">{label}</label>
      )}
      <input
        className={`
          bg-bg border rounded-xl px-4 py-3 font-body text-white text-base
          placeholder:text-white/30 outline-none
          border-border focus:border-primary transition-colors
          ${error ? 'border-accent' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="font-body text-accent text-xs">{error}</p>
      )}
    </div>
  )
}
