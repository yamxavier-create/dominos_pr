import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label className="font-body font-extrabold text-white/85 text-sm">{label}</label>
      )}
      <input
        className={`
          bg-[#06180D]/80 border-2 rounded-xl px-4 py-3 font-body font-bold text-white text-base
          placeholder:text-white/30 placeholder:font-semibold outline-none
          border-[#06140B] shadow-[inset_0_3px_0_rgba(0,0,0,0.35),0_0_0_2px_rgba(234,179,8,0.25)]
          focus:shadow-[inset_0_3px_0_rgba(0,0,0,0.35),0_0_0_2px_#FDD04B] transition-shadow
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
