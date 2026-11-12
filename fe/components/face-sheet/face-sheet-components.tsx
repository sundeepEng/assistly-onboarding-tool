import { Phone, UserIcon } from "lucide-react";
import { InlineInput,InlineTextarea } from "../../commonComponents/inline-form-fields";

/** ---------------- UI atoms (matching your style) ---------------- */

export const normalizeList = (input: string) =>
  input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <div
    className={`
      w-full rounded-2xl bg-white shadow-md border border-solid border-[#D1D5DB] py-2
      print:shadow-none print:border-none print:rounded-none
      ${className}
    `}
  >
    {children}
  </div>
);

export const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-6 text-[22px] font-extrabold text-gray-900">{title}</div>
);

export const Divider = () => <div className="h-px bg-gray-100" />;

export const toTelHref = (phone?: string) => {
  if (!phone) return "#";
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `tel:${cleaned}`;
};

export const Row: React.FC<{
  label: string;
  divider?: boolean;
  children: React.ReactNode;
}> = ({ label, divider = true, children }) => (
  <div className="px-6">
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900 text-right min-w-[180px] max-w-[60%] w-full">
        {children}
      </div>
    </div>
    {divider ? <Divider /> : null}
  </div>
);

export const SimpleListSection: React.FC<{
  title: string;
  valueText: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  divider?: boolean;
}> = ({ title, valueText, onChange, onBlur, error, divider = false }) => (
  <div className="px-6">
    <div className="text-[15px] text-gray-500">{title}</div>
    <div className="mt-2 print:hidden">
      <InlineTextarea
        value={valueText}
        onChange={onChange}
        onBlur={onBlur}
        error={error}
        placeholder="None recorded"
        rows={2}
      />
    </div>
    <div className="hidden print:block mt-2">
      {valueText?.trim() ? (
        <ul className="pl-6 list-disc">
          {normalizeList(valueText).map((item, idx) => (
            <li key={`${title}-${idx}`} className="text-[15px] text-gray-900">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-[15px] text-gray-500">None recorded</div>
      )}
    </div>

    {divider ? <div className="mt-5 h-px bg-gray-200" /> : null}
  </div>
);

export const ContactBlock: React.FC<{
  title: "Primary" | "Secondary";
  name: string;
  relationship: string;
  phone: string;
  errors?: Partial<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  onBlur?: (field: "name" | "relationship" | "phone") => void;
  onChange: (
    patch: Partial<{ name: string; relationship: string; phone: string }>,
  ) => void;
  divider?: boolean;
}> = ({
  title,
  name,
  relationship,
  phone,
  errors,
  onBlur,
  onChange,
  divider = true,
}) => (
  <div className="px-6 gap-4">
    <div className="flex gap-4">
      <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center print:hidden">
        <UserIcon className="h-5 w-5 text-gray-600" />
      </div>

      <div className="flex-1 mt-1">
        <div className="text-sm text-gray-500">{title}</div>
        <div className="flex">
          <div className="mt-1">
            <InlineInput
              value={name}
              onChange={(v) => onChange({ name: v })}
              onBlur={() => onBlur?.("name")}
              error={errors?.name}
              placeholder="Name"
            />
          </div>

          <div className="mt-1">
            <InlineInput
              value={relationship}
              onChange={(v) => onChange({ relationship: v })}
              onBlur={() => onBlur?.("relationship")}
              error={errors?.relationship}
              placeholder="Relationship"
              className="text-gray-700"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Phone className="h-5 w-5 text-gray-600 print:hidden" />
          <div className="flex-1">
            <InlineInput
              value={phone}
              onChange={(v) => onChange({ phone: v })}
              onBlur={() => onBlur?.("phone")}
              error={errors?.phone}
              placeholder="Phone"
              type="tel"
              inputMode="tel"
            />
            {/* <a
              className="text-xs text-[#514ceb] font-semibold print:hidden"
              href={toTelHref(phone)}
              onClick={(e) => {
                if (!phone?.trim()) e.preventDefault();
              }}
            >
              Tap to call
            </a> */}
            <div className="hidden print:block text-sm text-gray-700 mt-1">
              {phone?.trim() ? phone : "Not on file"}
            </div>
          </div>
        </div>
      </div>
    </div>

    {divider ? (
      <div className="mt-6">
        <Divider />
      </div>
    ) : null}
  </div>
);
