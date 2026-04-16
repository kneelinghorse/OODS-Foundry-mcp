type Props = {
  framework: string;
  styling: string;
  brand: string;
  theme: string;
  onFrameworkChange: (v: "react" | "vue" | "html") => void;
  onStylingChange: (v: "inline" | "tokens" | "tailwind") => void;
  onBrandChange: (v: "default" | "A" | "B") => void;
  onThemeChange: (v: "light" | "dark") => void;
  showBrandTheme?: boolean;
};

function Pill({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <div className="flex bg-gray-900 rounded-md border border-gray-700 overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              value === opt.value
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Selectors({
  framework,
  styling,
  brand,
  theme,
  onFrameworkChange,
  onStylingChange,
  onBrandChange,
  onThemeChange,
  showBrandTheme = true,
}: Props) {
  return (
    <div className="flex items-center gap-4">
      <Pill
        label="Framework"
        value={framework}
        options={[
          { value: "react", label: "React" },
          { value: "vue", label: "Vue" },
          { value: "html", label: "HTML" },
        ]}
        onChange={(v) => onFrameworkChange(v as "react" | "vue" | "html")}
      />
      <Pill
        label="Styling"
        value={styling}
        options={[
          { value: "tokens", label: "Tokens" },
          { value: "tailwind", label: "Tailwind" },
          { value: "inline", label: "Inline" },
        ]}
        onChange={(v) => onStylingChange(v as "inline" | "tokens" | "tailwind")}
      />
      {showBrandTheme ? (
        <>
          <Pill
            label="Brand"
            value={brand}
            options={[
              { value: "default", label: "Default" },
              { value: "A", label: "Brand A" },
              { value: "B", label: "Brand B" },
            ]}
            onChange={(v) => onBrandChange(v as "default" | "A" | "B")}
          />
          <Pill
            label="Theme"
            value={theme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            onChange={(v) => onThemeChange(v as "light" | "dark")}
          />
        </>
      ) : null}
    </div>
  );
}
