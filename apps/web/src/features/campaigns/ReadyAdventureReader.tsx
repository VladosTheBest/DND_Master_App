import { useEffect, useMemo, useState } from "react";
import type { CampaignData, GalleryImage, KnowledgeEntity } from "@shadow-edge/shared-types";
import { RichParagraphs } from "../../rich-text";
import { mapMediaURL } from "../world-maps/world-maps.api";
import "./ready-campaigns.css";

export function ReadyAdventureReader({ campaign, module, selected, selectedEventId, onSelect, onGallery }: {
  campaign: CampaignData;
  module: string;
  selected: KnowledgeEntity | null;
  selectedEventId?: string;
  onSelect: (id: string) => void;
  onGallery: (ownerId: string, title: string, images: GalleryImage[], index: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [book, setBook] = useState(false);
  const [localId, setLocalId] = useState("");
  const [page, setPage] = useState(6);
  useEffect(() => { setQuery(""); setCategory(""); setBook(false); setLocalId(module === "events" ? selectedEventId || "" : ""); }, [module, campaign.id, selectedEventId]);
  const all = useMemo(() => [...campaign.locations, ...campaign.npcs, ...campaign.monsters, ...campaign.quests, ...campaign.lore], [campaign]);
  const byId = useMemo(() => new Map(all.map(e => [e.id, e])), [all]);
  const byTitle = useMemo(() => new Map(all.map(e => [e.title, e])), [all]);
  const collections: Record<string, KnowledgeEntity[]> = { locations: campaign.locations, npcs: campaign.npcs, monsters: campaign.monsters, quests: campaign.quests, lore: campaign.lore, notes: campaign.lore,
    events: campaign.events.map(e => ({...e, kind:"lore",category:"History",visibility:"gm_only",subtitle:e.summary,content:e.sceneText,quickFacts:[],related:e.locationId?[{id:e.locationId,kind:"location",label:e.locationLabel || "Локация",reason:"Место действия"}]:[]})),
    shops: campaign.shops.map(e => ({...e,title:e.name,kind:"lore",category:"History",visibility:"gm_only",subtitle:e.gmNotes || "",summary:"",content:e.description || "",tags:[],quickFacts:[],related:e.locationId?[{id:e.locationId,kind:"location",label:byId.get(e.locationId)?.title || "Город",reason:"Расположение"}]:[]})) };
  const items = collections[module] ?? campaign.lore;
  const labels: Record<string,string> = {locations:"Локации",npcs:"НПС",monsters:"Существа",quests:"Задания",lore:"Книга приключения",notes:"Книга приключения",events:"Сцены приключения",shops:"Места торговли"};
  const active = (module === "shops" || module === "events") ? items.find(e => e.id === localId) || items[0] : selected && items.some(e => e.id === selected.id) ? selected : items[0];
  const materialType = (e: KnowledgeEntity) => e.quickFacts.find(f => f.label === "Тип материала")?.value || "";
  const filtered = items.filter(e => (!category || materialType(e) === category) && (!query.trim() || `${e.title} ${e.subtitle} ${e.content}`.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))));
  const categories = [...new Set(items.map(materialType).filter(Boolean))];
  const pageImage = { title: `Страница PDF ${page} · книга ${page - 1}`, url: `/api/campaign-templates/${campaign.readyCampaign!.templateId}/assets/pages/${String(page).padStart(3,"0")}.webp` };
  return <div className="ready-reader">
    <header className="ready-reader-header"><div><small>Готовые Кампании · материалы только для чтения</small><h1>{labels[module] || "Приключение"}</h1></div>
      <button className="ghost" type="button" aria-pressed={book} onClick={() => setBook(!book)}>{book ? "Вернуться к карточкам" : "Открыть исходную книгу"}</button>
    </header>
    {book ? <section className="ready-book"><nav aria-label="Страницы приключения"><button className="ghost" type="button" disabled={page<=1} onClick={() => setPage(page-1)}>Назад</button><label>Страница PDF <input aria-label="Страница PDF" type="number" min={1} max={323} value={page} onChange={e => setPage(Math.max(1,Math.min(323,Number(e.target.value)||1)))}/></label><span>из 323 · книга {page-1}</span><button className="ghost" type="button" disabled={page>=323} onClick={() => setPage(page+1)}>Вперёд</button></nav>
      <select aria-label="Глава книги" value="" onChange={e => setPage(Number(e.target.value))}><option value="" disabled>Перейти к главе или приложению</option>{campaign.lore.filter(e => e.tags.includes("Книга приключения")).map(e => <option key={e.id} value={e.subtitle.match(/PDF (\d+)/)?.[1]}>{e.title}</option>)}</select>
      <button className="ready-book-image" type="button" aria-label="Увеличить исходную страницу" onClick={() => onGallery("source-book",campaign.title,[pageImage],0)}><img src={mapMediaURL(pageImage.url)} alt={pageImage.title}/></button>
    </section> : <div className="ready-reader-grid"><aside className="ready-reader-directory"><label>Поиск<input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Название или текст источника"/></label>{categories.length>1 && <select className="input" aria-label="Тип материала" value={category} onChange={e => setCategory(e.target.value)}><option value="">Все материалы</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>}
      <small>{filtered.length} материалов</small><div className="ready-reader-list">{filtered.map(e => <button className={e.id===active?.id?"selected":""} type="button" key={e.id} onClick={() => module === "shops" || module === "events" ? setLocalId(e.id) : onSelect(e.id)}><strong>{e.title}</strong><small>{e.subtitle}</small></button>)}{!filtered.length && <p>Ничего не найдено.</p>}</div>
    </aside><article className="ready-reader-detail">{active ? <><h2>{active.title}</h2><p className="muted">{active.subtitle}</p>
      {active.related.length>0 && <nav className="ready-reader-relations" aria-label="Связанные материалы">{active.related.filter(r => byId.has(r.id)).map(r => <button className="ghost" type="button" key={r.id} onClick={() => onSelect(r.id)}>{r.label}</button>)}</nav>}
      {active.gallery?.length ? <details className="ready-source-gallery"><summary>Карты и исходные страницы ({active.gallery.length})</summary><div>{active.gallery.map((g,i) => <button type="button" key={g.url} onClick={() => onGallery(active.id,active.title,active.gallery!,i)}><img loading="lazy" src={mapMediaURL(g.url)} alt=""/><span>{g.title}</span></button>)}</div></details> : null}
      <div className="ready-source-text"><RichParagraphs content={active.content} entityByTitle={byTitle} onMentionClick={onSelect}/></div>
    </> : <p>Материалы этого раздела доступны в книге приключения.</p>}</article></div>}
  </div>;
}
