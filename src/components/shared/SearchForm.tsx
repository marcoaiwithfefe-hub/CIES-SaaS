import React from 'react';
import { Camera, Loader2 } from 'lucide-react';

interface SearchFormProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  loading: boolean;
  isTextArea?: boolean;
  buttonText?: string;
  helpText?: string;
}

export function SearchForm({ id, label, placeholder, value, onChange, onSubmit, loading, isTextArea, buttonText = 'Capture', helpText }: SearchFormProps) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {helpText && <span className="block text-xs text-slate-500 mt-1">{helpText}</span>}
      </label>
      <div className="flex gap-3">
        {isTextArea ? (
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all min-h-[100px] resize-y"
            placeholder={placeholder}
            aria-required="true"
          />
        ) : (
          <input
            type="text"
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            placeholder={placeholder}
            aria-required="true"
          />
        )}
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors self-start"
          aria-busy={loading}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Camera className="w-5 h-5" aria-hidden="true" />}
          {loading ? 'Capturing...' : buttonText}
        </button>
      </div>
    </form>
  );
}
