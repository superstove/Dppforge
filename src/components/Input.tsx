import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export function Input({ label, required, ...props }: InputProps) {
  return (
    <div className="flex flex-col mb-4">
      {label && (
        <label className="text-sm font-medium text-[#8b8fa3] mb-1.5 flex justify-between">
          {label} {required && <span className="text-[#ef4444]">*</span>}
        </label>
      )}
      <input 
        className="bg-[#242736] border border-[#2e3245] rounded-lg px-4 py-2.5 text-white placeholder-[#8b8fa3]/50 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
        {...props}
      />
    </div>
  );
}

export function Textarea({ label, required, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col mb-4">
      {label && (
        <label className="text-sm font-medium text-[#8b8fa3] mb-1.5 flex justify-between">
          {label} {required && <span className="text-[#ef4444]">*</span>}
        </label>
      )}
      <textarea 
        className="bg-[#242736] border border-[#2e3245] rounded-lg px-4 py-2.5 text-white placeholder-[#8b8fa3]/50 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors min-h-[100px] resize-y"
        {...props}
      />
    </div>
  );
}
