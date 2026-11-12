import React from "react";
import { Eye, RotateCcw, Trash2, Upload } from "lucide-react";
import { FACESHEET_ALLOWED_FILE_TYPES } from "../utils/constants";
const baseFieldClass = `
  w-full bg-transparent border-0 p-0 m-0 
  text-[15px] font-semibold text-gray-900 placeholder:text-gray-400
  leading-[20px] align-middle
  outline-none focus:outline-none focus:ring-0
  print:shadow-none
`;
export const InlineInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  error?: string;
  multiLine?: boolean;
  rows?: number;
  min?:string,
  max?:string
}> = ({
  value,
  onChange,
  onBlur,
  placeholder = "Not on file",
  className = "",
  type = "text",
  inputMode,
  error,
  multiLine = false,
  rows = 2,
  min,
  max
}) => (
  <div className="w-full">
    {multiLine ? (
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        title={value ?? ""}
        rows={rows}
        className={`
          w-full bg-transparent border-0 p-0 m-0 resize-none
          text-[15px] font-semibold text-gray-900 placeholder:text-gray-400
          leading-[20px] align-middle
          outline-none focus:outline-none focus:ring-0
          print:shadow-none
          ${
            error
              ? "shadow-[inset_0_-1px_0_0_rgba(239,68,68,1)]"
              : "focus:shadow-[inset_0_-1px_0_0_rgba(209,213,219,1)]"
          }
          ${className}
        `}
      />
    ) : (
      <input
        type={type}
        inputMode={inputMode}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        title={value ?? ""}
        className={`
          ${baseFieldClass}
          ${
            error
              ? "shadow-[inset_0_-1px_0_0_rgba(239,68,68,1)]"
              : "focus:shadow-[inset_0_-1px_0_0_rgba(209,213,219,1)]"
          }
          ${className}
        `}
        min={min}
        max={max}
      />
    )}
    {error ? <div className="mt-1 text-xs text-red-500">{error}</div> : null}
  </div>
);

export const InlineSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  className?: string;
  error?: string;
  options: { label: string; value: string }[];
}> = ({ value, onChange, onBlur, className = "", error, options }) => (
  <div className="w-full">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={`
        ${baseFieldClass}
        appearance-none cursor-pointer
        ${
          error
            ? "shadow-[inset_0_-1px_0_0_rgba(239,68,68,1)]"
            : "focus:shadow-[inset_0_-1px_0_0_rgba(209,213,219,1)]"
        }
        ${className}
      `}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    {error ? <div className="mt-1 text-xs text-red-500">{error}</div> : null}
  </div>
);

export const InlineTextarea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  rows?: number;
  error?: string;
}> = ({
  value,
  onChange,
  onBlur,
  placeholder = "None recorded",
  rows = 2,
  error,
}) => (
  <div className="w-full">
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      rows={rows}
      className={`
        w-full bg-transparent border-0 p-0 m-0 resize-none
        text-[15px] font-semibold text-gray-900 placeholder:text-gray-400
        leading-[20px]
        outline-none focus:outline-none focus:ring-0
        ${
          error
            ? "shadow-[inset_0_-1px_0_0_rgba(239,68,68,1)]"
            : "focus:shadow-[inset_0_-1px_0_0_rgba(209,213,219,1)]"
        }
        print:shadow-none
      `}
    />
    {error ? <div className="mt-1 text-xs text-red-500">{error}</div> : null}
  </div>
);

export const Row: React.FC<{
  label: string;
  divider?: boolean;
  children: React.ReactNode;
}> = ({ label, divider = true, children }) => (
  <div className="px-6">
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="min-w-[180px] max-w-[60%] text-right">{children}</div>
    </div>
    {divider ? <div></div> : null}
  </div>
);

export const UploadRow: React.FC<{
  label: string;
  doc: any;
  disabled?: boolean;
  onPickFile: (file: File) => void; 
  onRemove: () => void; 
  onUndo?: () => void; 
  onView?: () => void;
  onFileSizeError?: (error: string) => void;
}> = ({
  label,
  doc,
  disabled,
  onPickFile,
  onRemove,
  onUndo,
  onView,
  onFileSizeError,
}) => {
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      onFileSizeError?.(
        `File size must be less than 2MB. Selected file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`,
      );
      e.target.value = "";
      return;
    }

    // Check file type
    const allowedTypes = FACESHEET_ALLOWED_FILE_TYPES
    
    if (!allowedTypes.includes(file.type)) {
      onFileSizeError?.(
        "Invalid file type. Please upload photos (JPG, PNG, GIF, WebP), PDF, Word documents, or text files.",
      );
      e.target.value = "";
      return;
    }

    onPickFile(file);
    e.target.value = "";
  };

  const status = doc?.status as
    | "existing"
    | "new"
    | "remove"
    | "empty"
    | undefined;

  const hasExisting = !!doc?.fileUrl;
  const hasStagedFile = !!doc?.file;

  // View only when it exists AND not marked for removal
  const showView = hasExisting && status !== "remove";

  const showRemove =
    !disabled && (hasExisting || hasStagedFile) && status !== "remove";

  // Undo appears only when marked remove (and caller provided onUndo)
  const showUndo = !disabled && status === "remove" && !!onUndo;

  // Label text for user feedback
  const statusLabel =
    status === "new" && hasStagedFile
      ? `Pending upload: ${doc.file?.name ?? "file"}`
      : status === "remove"
        ? "Will be removed (pending)"
        : "";

  const statusClass =
    status === "new"
      ? "text-amber-700"
      : status === "remove"
        ? "text-red-600"
        : "text-gray-400";

  return (
    <Row label={label}>
      <div className="flex items-center justify-end gap-3">
        {/* Status / View */}
        {statusLabel ? (
          <span className={`text-sm font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
        ) : showView ? (
          <button
            type="button"
            onClick={onView}
            disabled={disabled}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              disabled
                ? "text-gray-400 cursor-not-allowed"
                : "text-[#514ceb] hover:bg-[#514ceb]/10"
            }`}
            title="View document"
          >
            <Eye size={18} />
          </button>
        ) : (
          <span className="text-gray-400 text-sm">Not on file</span>
        )}

        {/* Upload */}
        <label
          className={`p-2 rounded-lg transition-colors ${
            disabled
              ? "text-gray-400 cursor-not-allowed"
              : "text-[#514ceb] hover:bg-[#514ceb]/10 cursor-pointer"
          }`}
          title="Upload document (Max 2MB)"
        >
          <Upload size={18} />
          <input
            type="file"
            className="hidden"
            disabled={disabled}
            onChange={handleFileSelect}
          />
        </label>

        {/* Remove */}
        {showRemove && (
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            className={`p-2 rounded-lg transition-colors ${
              disabled
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            title={
              status === "new"
                ? "Remove staged file"
                : "Remove document (pending until Save)"
            }
          >
            <Trash2 size={18} />
          </button>
        )}

        {/* Undo remove */}
        {showUndo && (
          <button
            type="button"
            disabled={disabled}
            onClick={onUndo}
            className={`p-2 rounded-lg transition-colors ${
              disabled
                ? "text-gray-400 cursor-not-allowed"
                : "text-[#514ceb] hover:bg-[#514ceb]/10"
            }`}
            title="Undo remove"
          >
            <RotateCcw size={18} />
          </button>
        )}
      </div>
    </Row>
  );
};
