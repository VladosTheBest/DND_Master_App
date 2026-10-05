import type { CreateCampaignInput, ReadyCampaignTemplate } from "@shadow-edge/shared-types";
import { useEffect, useState } from "react";
import { api } from "./api";
import "../features/campaigns/ready-campaigns.css";

type CampaignCreateModalProps = {
  form: CreateCampaignInput;
  open: boolean;
  saving: boolean;
  onChange: (patch: Partial<CreateCampaignInput>) => void;
  onClose: () => void;
  onCreateWithAI: () => void;
  onSubmit: () => void;
  readyTab: boolean;
  onTabChange: (ready: boolean) => void;
  onStartReadyCampaign: (id: string) => void;
};

export function CampaignCreateModal({
  form,
  open,
  saving,
  onChange,
  onClose,
  onCreateWithAI,
  onSubmit, readyTab, onTabChange, onStartReadyCampaign
}: CampaignCreateModalProps) {
  const [templates, setTemplates] = useState<ReadyCampaignTemplate[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || !readyTab) return;
    let alive = true;
    setLoading(true); setError("");
    void api.listReadyCampaignTemplates().then(items => { if (alive) setTemplates(items); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Не удалось загрузить кампании."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, readyTab]);
  if (!open) {
    return null;
  }

  return (
    <div className="overlay" role="presentation">
      <div className="panel palette form-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="row">
          <div>
            <p className="eyebrow">Кампании</p>
            <strong>{readyTab ? "Готовые Кампании" : "Новая кампания"}</strong>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Esc
          </button>
        </div>

        <div className="ready-campaign-tabs" aria-label="Способ создания кампании">
          <button type="button" className="ghost" aria-pressed={!readyTab} disabled={saving} onClick={() => onTabChange(false)}>Своя кампания</button>
          <button type="button" className="ghost" aria-pressed={readyTab} disabled={saving} onClick={() => onTabChange(true)}>Готовые Кампании</button>
        </div>
        {readyTab ? <div className="ready-campaign-library">
          <p>Готовое приключение для проведения игры. Сюжет, локации, НПС и карты защищены от изменений. Игроки, бои и журнал сохраняются в вашем прохождении.</p>
          {loading ? <p role="status">Загружаю готовые кампании…</p> : error ? <p role="alert">{error}</p> : templates.length ? templates.map(template => <article className="card ready-campaign-card" key={template.id}>
            <small>{template.label} · {template.system}</small>
            <h2>{template.title}</h2><p>{template.summary}</p>
            <p className="muted">{template.sourcePages} страницы · {template.counts.locations} локаций · {template.counts.npcs} НПС · {template.counts.maps} карт · {template.counts.quests} заданий</p>
            <button type="button" className="primary" disabled={saving} onClick={() => onStartReadyCampaign(template.id)}>{saving ? "Открываю…" : "Начать прохождение"}</button>
          </article>) : <p>Готовых кампаний пока нет.</p>}
        </div> : <><div className="form-grid">
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
        </>}

        {!readyTab && <div className="actions">
          <button className="ghost ai-edit-button" disabled={saving} onClick={onCreateWithAI} type="button">
            Создать с AI
          </button>
          <button className="primary" disabled={saving} onClick={onSubmit} type="button">
            {saving ? "Сохраняю..." : "Создать кампанию"}
          </button>
        </div>}
      </div>
    </div>
  );
}
