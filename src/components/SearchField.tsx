import React from "react";
import { FaSearch } from "react-icons/fa";

interface SearchFieldProps {
  id: string;
  /** The field's accessible name. */
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** A search box with a magnifier, named for assistive technology. */
const SearchField: React.FC<SearchFieldProps> = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  className = "",
}) => (
  <div className={`relative ${className}`}>
    <label htmlFor={id} className="sr-only">
      {label}
    </label>
    <FaSearch
      aria-hidden="true"
      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint"
    />
    <input
      id={id}
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-xl border border-field bg-panel pl-11 pr-4 text-base text-paper placeholder:text-faint transition-colors hover:border-muted focus:border-cyan"
    />
  </div>
);

export default SearchField;
