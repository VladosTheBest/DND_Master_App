import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Copy, Map as MapIcon, ScrollText, ShieldCheck } from "lucide-react";
import type { CampaignData, GalleryImage, KnowledgeEntity } from "@shadow-edge/shared-types";
import { EntityVisual } from "../../app-shared";
import { CombatEntityStatSheet } from "../../combat-ui";
import { FormattedText } from "../formatting/FormattedText";
import { mapMediaURL, mapRequest } from "../world-maps/world-maps.api";
import "../events/events.css";
import "./ready-campaigns.css";

export type AdventureSection = { title: string; kind: "gm" | "read_aloud" | "rules" | "loot"; text: string; pages: number[] };
export type AdventureMaterial = { title: string; summary: string; sourcePages: number[]; sections: AdventureSection[] };
type AdventurePresentation = { templateId: string; version: number; items: Record<string, AdventureMaterial> };
const presentations = new Map<string, Promise<AdventurePresentation>>();
const sourceId = (id: string) => id.slice(id.lastIndexOf("frost-"));
function loadPresentation(id: string) {
  if (!presentations.has(id)) presentations.set(id, mapRequest<AdventurePresentation>(`/api/campaign-templates/${encodeURIComponent(id)}/presentation`).catch(error => { presentations.delete(id); throw error; }));
  return presentations.get(id)!;
}
function fallback(entity: KnowledgeEntity): AdventureMaterial {
  const text = entity.content.replace(/^Страница PDF .+$/gm, "").replace(/([а-яё])-\n(?=[а-яё])/gi,"$1");
  const paragraphs = text.split(/\n\s*\n/).map(p => p.replace(/\n/g," ").trim()).filter(Boolean);
  return { title:entity.title, summary:paragraphs.find(p => p.length>80)?.slice(0,250) || entity.summary, sourcePages:[], sections:[{title:"Описание для мастера",kind:"gm",text:paragraphs.join("\n\n"),pages:[]}] };
}

export function ReadyAdventureReader({ campaign, module, selected, selectedEventId, onSelect, onGallery }: {
  campaign: CampaignData;
  module: string;
  selected: KnowledgeEntity | null;
  selectedEventId?: string;
  onSelect: (id: string) => void;
  onGallery: (ownerId: string, title: string, images: GalleryImage[], index: number) => void;
}) {
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("");
  const [book,setBook] = useState(false);
  const [showCards,setShowCards] = useState(true);
  const [localId,setLocalId] = useState("");
  const [page,setPage] = useState(6);
  const [presentation,setPresentation] = useState<AdventurePresentation | null>(null);
  const [error,setError] = useState("");
  const templateId = campaign.readyCampaign!.templateId;
  useEffect(() => {
    let alive=true;
    setPresentation(null);setError("");
    void loadPresentation(templateId).then(p=>{if(alive)setPresentation(p);}).catch(()=>{if(alive)setError("Оформленные карточки не загрузились. Исходная книга доступна по кнопке выше.");});
    return ()=>{alive=false;};
  },[templateId]);
  useEffect(() => {setQuery("");setCategory("");setBook(false);setShowCards(true);setLocalId("");},[module,campaign.id]);
  useEffect(() => {if(selected?.id){setLocalId(selected.id);setShowCards(false);}},[selected?.id]);
  useEffect(() => {if(module==="events"&&selectedEventId){setLocalId(selectedEventId);setShowCards(false);}},[module,selectedEventId]);
  const all = useMemo(()=>[...campaign.locations,...campaign.npcs,...campaign.monsters,...campaign.quests,...campaign.lore],[campaign]);
  const byId = useMemo(()=>new Map(all.map(e=>[e.id,e])),[all]);
  const byTitle = useMemo(()=>new Map(all.map(e=>[e.title,e])),[all]);
  const collections: Record<string,KnowledgeEntity[]> = {locations:campaign.locations,npcs:campaign.npcs,monsters:campaign.monsters,quests:campaign.quests,lore:campaign.lore,notes:campaign.lore,
    events:campaign.events.map(e=>({...e,kind:"lore",category:"History",visibility:"gm_only",subtitle:e.summary,content:e.sceneText,quickFacts:[],related:e.locationId?[{id:e.locationId,kind:"location",label:e.locationLabel||"Локация",reason:"Место действия"}]:[]})),
    shops:campaign.shops.map(e=>({...e,title:e.name,kind:"lore",category:"History",visibility:"gm_only",subtitle:e.gmNotes||"",summary:"",content:e.description||"",tags:[],quickFacts:[],related:e.locationId?[{id:e.locationId,kind:"location",label:byId.get(e.locationId)?.title||"Город",reason:"Расположение"}]:[]}))};
  const items = collections[module] ?? campaign.lore;
  const labels:Record<string,string>={locations:"Локации",npcs:"НПС",monsters:"Существа",quests:"Задания",lore:"Книга приключения",notes:"Книга приключения",events:"Сцены приключения",shops:"Места торговли"};
  const material = (e:KnowledgeEntity)=>presentation?.items[sourceId(e.id)] || fallback(e);
  const materialType = (e:KnowledgeEntity)=>e.quickFacts.find(f=>f.label==="Тип материала")?.value || (module==="events"?"Сцена":module==="shops"?"Место торговли":"");
  const categories = [...new Set(items.map(materialType).filter(Boolean))];
  const filtered = items.filter(e=>(!category||materialType(e)===category)&&(!query.trim()||`${e.title} ${material(e).summary} ${e.content}`.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))));
  const active = !showCards ? items.find(e=>e.id===localId) || (selected&&items.find(e=>e.id===selected.id)) : null;
  function open(e:KnowledgeEntity){setLocalId(e.id);setShowCards(false);setBook(false);if(module!=="events"&&module!=="shops")onSelect(e.id);}
  const pageImage={title:`Страница PDF ${page} · книга ${page-1}`,url:`/api/campaign-templates/${templateId}/assets/pages/${String(page).padStart(3,"0")}.webp`};
  const overviewCard=(e:KnowledgeEntity,compact=false)=><button key={e.id} type="button" className={`card ready-material-card ${compact?"compact":""} ${active?.id===e.id?"selected":""}`} onClick={()=>open(e)}>
    <div className="ready-material-card-top"><EntityVisual entity={e}/><span className="ready-material-type">{materialType(e)||labels[module]}</span></div>
    <strong>{e.title}</strong><p>{material(e).summary}</p>
    <span className="ready-material-card-foot">{material(e).sections.some(s=>s.kind==="read_aloud")?<><ScrollText size={14}/>Есть текст для зачитки</>:<><BookOpen size={14}/>Описание и правила</>}</span>
  </button>;
  return <div className="ready-reader">
    <header className="ready-reader-header"><div><p className="eyebrow"><ShieldCheck size={14}/>Готовое приключение</p><h1>{labels[module]||"Приключение"}</h1></div>
      <div className="ready-reader-actions">{active&&!book&&<button className="ghost" type="button" onClick={()=>setShowCards(true)}><ArrowLeft size={16}/>Все карточки</button>}<button className="ghost" type="button" aria-pressed={book} onClick={()=>setBook(!book)}><BookOpen size={16}/>{book?"Вернуться к карточкам":"Открыть исходную книгу"}</button></div>
    </header>
    {book?<section className="ready-book"><nav aria-label="Страницы приключения"><button className="ghost" type="button" disabled={page<=1} onClick={()=>setPage(page-1)}>Назад</button><label>Страница PDF <input aria-label="Страница PDF" type="number" min={1} max={323} value={page} onChange={e=>setPage(Math.max(1,Math.min(323,Number(e.target.value)||1)))}/></label><span>из 323 · книга {page-1}</span><button className="ghost" type="button" disabled={page>=323} onClick={()=>setPage(page+1)}>Вперёд</button></nav>
      <select aria-label="Глава книги" value="" onChange={e=>setPage(Number(e.target.value))}><option value="" disabled>Перейти к главе или приложению</option>{campaign.lore.filter(e=>e.tags.includes("Книга приключения")).map(e=><option key={e.id} value={e.subtitle.match(/PDF (\d+)/)?.[1]}>{e.title}</option>)}</select>
      <button className="ready-book-image" type="button" aria-label="Увеличить исходную страницу" onClick={()=>onGallery("source-book",campaign.title,[pageImage],0)}><img src={mapMediaURL(pageImage.url)} alt={pageImage.title}/></button>
    </section>:<>
      {error?<p role="alert">{error}</p>:!presentation?<p role="status">Подготавливаю карточки приключения…</p>:null}
      {(presentation||error)&&<div className={active?"ready-reader-grid":"ready-reader-overview"}>
        <aside className="ready-reader-directory"><div className="ready-directory-filters"><label>Поиск<input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название, персонаж или место"/></label>{categories.length>1&&<select className="input" aria-label="Тип материала" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Все материалы</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>}<small>{filtered.length} карточек</small></div>
          <div className={active?"ready-reader-list":"ready-material-grid"}>{filtered.map(e=>overviewCard(e,Boolean(active)))}{!filtered.length&&<p>Ничего не найдено.</p>}</div>
        </aside>
        {active&&<AdventureCard key={active.id} entity={active} material={material(active)} byId={byId} byTitle={byTitle} children={all.filter(e=>"parentId" in e&&e.parentId===active.id)} onSelect={onSelect} onGallery={onGallery} onSourcePage={n=>{setPage(n);setBook(true);}}/>}
      </div>}
    </>}
  </div>;
}

function AdventureCard({entity,material,byId,byTitle,children,onSelect,onGallery,onSourcePage}:{entity:KnowledgeEntity;material:AdventureMaterial;byId:Map<string,KnowledgeEntity>;byTitle:Map<string,KnowledgeEntity>;children:KnowledgeEntity[];onSelect:(id:string)=>void;onGallery:(id:string,title:string,images:GalleryImage[],index:number)=>void;onSourcePage:(n:number)=>void}){
  const [copied,setCopied]=useState(-1);
  const [readMode,setReadMode]=useState(false);
  const readings=material.sections.filter(s=>s.kind==="read_aloud");
  const gm=material.sections.filter(s=>s.kind!=="read_aloud");
  const maps=entity.gallery?.filter(g=>g.url.includes("/maps/"))||[];
  async function copy(text:string,index:number){try{await navigator.clipboard.writeText(text);setCopied(index);}catch{setCopied(-2);}}
  return <article className={`ready-reader-detail event-scene-card ${readMode?"ready-read-mode":""}`}>
    <header className="ready-detail-heading">{!readMode&&<EntityVisual entity={entity} variant="hero"/>}<div><p className="eyebrow">{readMode?"Текст для игроков":entity.kind==="npc"?"Персонаж приключения":entity.kind==="monster"?"Существо приключения":entity.quickFacts.find(f=>f.label==="Тип материала")?.value||"Материал приключения"}</p><h2>{entity.title}</h2>{!readMode&&<p className="event-scene-summary">{material.summary}</p>}</div></header>
    <div className="ready-detail-tools">{readings.length>0&&<button className="ghost" type="button" aria-pressed={readMode} onClick={()=>setReadMode(!readMode)}><ScrollText size={16}/>{readMode?"Вернуть заметки мастера":"Только зачитки"}</button>}{!readMode&&entity.related.length>0&&<nav className="ready-reader-relations" aria-label="Связанные материалы">{entity.related.filter(r=>byId.has(r.id)).map((r,i)=><button className="ghost" type="button" key={`${r.id}-${i}`} onClick={()=>onSelect(r.id)}>{r.label}</button>)}</nav>}</div>
    {!readMode&&maps.length>0&&<button className="ready-featured-map" type="button" onClick={()=>onGallery(entity.id,entity.title,maps,0)}><img loading="lazy" src={mapMediaURL(maps[0].url)} alt={maps[0].title}/><span><MapIcon size={16}/>Открыть карту</span></button>}
    {readings.map((section,i)=><details className="ready-reading-block" key={i} open={i<2||readMode}><summary><ScrollText size={16}/>{readings.length===1?"Зачитать игрокам":`Зачитать игрокам · ${section.title}`}</summary><section className="event-read-aloud"><FormattedText content={section.text}/><button className="ghost ready-copy-reading" type="button" onClick={()=>void copy(section.text,i)}><Copy size={14}/>{copied===i?"Скопировано":"Копировать зачитку"}</button></section></details>)}
    {copied===-2&&<p role="status">Не удалось скопировать. Можно выделить текст зачитки вручную.</p>}
    {!readMode&&<>
      {(entity.kind==="npc"||entity.kind==="monster")&&entity.statBlock&&<CombatEntityStatSheet entity={entity} defaultCollapsed/>}
      {gm.length>0&&<section className="ready-gm-notes"><h3><ShieldCheck size={17}/>Мастеру</h3>{gm.map((section,i)=><details className={`ready-gm-section ready-section-${section.kind}`} key={i} open={i===0||section.kind==="loot"}><summary><span>{section.title}</span><small>{section.kind==="loot"?"Награды и находки":section.kind==="rules"?"Правила":"Заметки мастера"}</small></summary><FormattedText content={section.text} entityByTitle={byTitle} onMentionClick={onSelect}/></details>)}</section>}
      {children.length>0&&<section className="ready-child-locations"><h3>Места и области</h3><div>{children.map(e=><button className="ghost" type="button" key={e.id} onClick={()=>onSelect(e.id)}>{e.title}</button>)}</div></section>}
      <details className="ready-source-gallery"><summary><BookOpen size={16}/>Источник и иллюстрации</summary><p className="muted">{entity.subtitle}</p>{material.sourcePages[0]&&<button className="ghost" type="button" onClick={()=>onSourcePage(material.sourcePages[0])}>Открыть страницу в книге</button>}<div>{entity.gallery?.map((g,i)=><button type="button" key={`${g.url}-${i}`} onClick={()=>onGallery(entity.id,entity.title,entity.gallery!,i)}><img loading="lazy" src={mapMediaURL(g.url)} alt=""/><span>{g.title}</span></button>)}</div></details>
    </>}
  </article>;
}
