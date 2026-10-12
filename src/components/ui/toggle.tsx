// Toggle — the Nebula on/off switch: a soft nova-pink glow track when on,
// quiet stardust when off. Fully keyboard-operable (a real <input>), with an
// optional label + helper line. Divine-light: glow is soft, never harsh.
//
// Props:
//   checked     — current state
//   onChange    — called with the new state; MUST update `checked`
//   label       — visible label text
//   description — helper line under the label
//   disabled    — non-interactive, dimmed

"use client";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-4 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-star-100">{label}</span>}
          {description && <span className="mt-0.5 block text-xs leading-relaxed text-stardust-300">{description}</span>}
        </span>
      )}
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-nova-300/70 ${
          checked
            ? "border-nova-300/60 bg-nova-500/40 shadow-[0_0_14px_rgb(244_114_182/0.45)]"
            : "border-stardust-600/40 bg-nebula-900/80"
        }`}
      >
        <span
          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all duration-200 ${
            checked
              ? "left-[26px] bg-nova-200 shadow-[0_0_10px_rgb(244_114_182/0.8)]"
              : "left-[3px] bg-stardust-400"
          }`}
        />
      </span>
    </label>
  );
}
