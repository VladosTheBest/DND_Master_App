import type { KeyboardEvent } from "react";

/** One visible workspace, with native tab focus and no anchor scrolling. */
export function WorkspaceTabs({
  id,
  label,
  tabs,
  value,
  onChange,
}: {
  id: string;
  label: string;
  tabs: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}) {
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % tabs.length
            : event.key === "ArrowLeft"
              ? (index + tabs.length - 1) % tabs.length
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(tabs[next][0]);
    (
      event.currentTarget.parentElement?.children[next] as HTMLButtonElement
    )?.focus();
  }
  return (
    <div className="workspace-tabs" role="tablist" aria-label={label}>
      {tabs.map(([key, title], index) => (
        <button
          type="button"
          role="tab"
          key={key}
          id={`${id}-tab-${key}`}
          aria-controls={`${id}-panel-${key}`}
          aria-selected={value === key}
          tabIndex={value === key ? 0 : -1}
          onKeyDown={(event) => move(event, index)}
          onClick={() => onChange(key)}
        >
          {title}
        </button>
      ))}
    </div>
  );
}
