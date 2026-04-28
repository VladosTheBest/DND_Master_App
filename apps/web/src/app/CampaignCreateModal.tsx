import type { CreateCampaignInput } from "@shadow-edge/shared-types";

type CampaignCreateModalProps = {
  form: CreateCampaignInput;
  open: boolean;
  saving: boolean;
  onChange: (patch: Partial<CreateCampaignInput>) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function CampaignCreateModal({
  form,
  open,
  saving,
  onChange,
  onClose,
  onSubmit
}: CampaignCreateModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="overlay" role="presentation">
      <div className="panel palette form-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="row">
          <div>
            <p className="eyebrow">Create Campaign</p>
            <strong>Новая кампания сохраняется сразу на localhost backend</strong>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Esc
          </button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Название</span>
            <input
              className="input"
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="Грань Тени"
              value={form.title}
            />
          </label>
          <label className="field">
            <span>Система</span>
            <input
              className="input"
              onChange={(event) => onChange({ system: event.target.value })}
              placeholder="D&D 5e"
              value={form.system}
            />
          </label>
          <label className="field">
            <span>Сеттинг</span>
            <input
              className="input"
              onChange={(event) => onChange({ settingName: event.target.value })}
              placeholder="Северная граница"
              value={form.settingName}
            />
          </label>
          <label className="field">
            <span>Игровая дата</span>
            <input
              className="input"
              onChange={(event) => onChange({ inWorldDate: event.target.value })}
              placeholder="17 Найтала, 1492 DR"
              value={form.inWorldDate}
            />
          </label>
          <label className="field field-full">
            <span>Краткое описание</span>
            <textarea
              className="input textarea"
              onChange={(event) => onChange({ summary: event.target.value })}
              placeholder="О чём эта кампания и какой у неё тон"
              value={form.summary}
            />
          </label>
        </div>

        <div className="actions">
          <button className="primary" disabled={saving} onClick={onSubmit} type="button">
            {saving ? "Сохраняю..." : "Создать кампанию"}
          </button>
        </div>
      </div>
    </div>
  );
}
