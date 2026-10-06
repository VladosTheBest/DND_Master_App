import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Copy, Map as MapIcon, ScrollText, ShieldCheck } from "lucide-react";
import type { CampaignData, GalleryImage, KnowledgeEntity } from "@shadow-edge/shared-types";
import { EntityVisual } from "../../app-shared";
import { CombatEntityStatSheet } from "../../combat-ui";
import { FormattedText } from "../formatting/FormattedText";
import { PlayerFacingCardStrip } from "../../quests";
import { ReadyLocationHierarchy } from "./ReadyLocationHierarchy";
import { adventureSourceId as sourceId, adventureKindLabels, adventureMatchesLevel, type AdventureSection, type AdventureMaterial, type AdventurePresentation, type AdventureChapter } from "./ready-adventure.types";
import { mapMediaURL, mapRequest } from "../world-maps/world-maps.api";
import "../events/events.css";
import "./ready-campaigns.css";

const presentations = new Map<string, Promise<AdventurePresentation>>();
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
  const [locationView,setLocationView] = useState<"hierarchy"|"cards">("hierarchy");
  const [chapterFilter,setChapterFilter] = useState("");
  const [levelFilter,setLevelFilter] = useState("");
  const [sort,setSort] = useState("name");
  const templateId = campaign.readyCampaign!.templateId;
  useEffect(() => {
    let alive=true;
    setPresentation(null);setError("");
    void loadPresentation(templateId).then(p=>{if(alive)setPresentation(p);}).catch(()=>{if(alive)setError("Оформленные карточки не загрузились. Исходная книга доступна по кнопке выше.");});
    return ()=>{alive=false;};
  },[templateId]);
  useEffect(() => {setQuery("");setCategory("");setChapterFilter("");setLevelFilter("");setBook(false);setShowCards(true);setLocalId("");},[module,campaign.id]);
  useEffect(() => {if(selected?.id){setLocalId(selected.id);setShowCards(false);}},[selected?.id]);
  useEffect(() => {if(module==="events"&&selectedEventId){setLocalId(selectedEventId);setShowCards(false);}},[module,selectedEventId]);
  const all = useMemo(()=>[...campaign.locations,...campaign.npcs,...campaign.monsters,...campaign.quests,...campaign.lore],[campaign]);
  const byId = useMemo(()=>new Map(all.map(e=>[e.id,e])),[all]);
  const byTitle = useMemo(()=>new Map(all.map(e=>[e.title,e])),[all]);
  const bySourceId = useMemo(()=>new Map(all.map(e=>[sourceId(e.id),e])),[all]);
  const collections: Record<string,KnowledgeEntity[]> = {locations:campaign.locations,npcs:campaign.npcs,monsters:campaign.monsters,quests:campaign.quests,lore:campaign.lore,notes:campaign.lore,
    events:campaign.events.map(e=>({...e,kind:"lore",category:"History",visibility:"gm_only",subtitle:e.summary,content:e.sceneText,quickFacts:[],related:e.locationId?[{id:e.locationId,kind:"location",label:e.locationLabel||"Локация",reason:"Место действия"}]:[]})),
    shops:campaign.shops.map(e=>({...e,title:e.name,kind:"lore",category:"History",visibility:"gm_only",subtitle:e.gmNotes||"",summary:"",content:e.description||"",tags:[],quickFacts:[],related:e.locationId?[{id:e.locationId,kind:"location",label:byId.get(e.locationId)?.title||"Город",reason:"Расположение"}]:[]}))};
  const items = collections[module] ?? campaign.lore;
  const labels:Record<string,string>={locations:"Локации",npcs:"НПС",monsters:"Существа",quests:"Задания",lore:"Книга приключения",notes:"Книга приключения",events:"Сцены приключения",shops:"Места торговли"};
  const material = (e:KnowledgeEntity)=>presentation?.items[sourceId(e.id)] || fallback(e);
  const locationKinds = new Map(presentation?.nodes?.filter(n=>n.kind!=="npc"&&n.kind!=="group").map(n=>[n.entityId,n.kind]));
  const materialType = (e:KnowledgeEntity)=>module==="locations"&&locationKinds.has(sourceId(e.id)) ? adventureKindLabels[locationKinds.get(sourceId(e.id))!] : e.quickFacts.find(f=>f.label==="Тип материала")?.value || (module==="events"?"Сцена":module==="shops"?"Место торговли":"");
  const categories = [...new Set(items.map(materialType).filter(Boolean))];
  const chapters = presentation?.chapters ?? [];
  const firstChapter = (e:KnowledgeEntity)=>Math.min(...(material(e).chapterIds?.length ? material(e).chapterIds! : [99]));
  const minimumLevel = (e:KnowledgeEntity)=>Math.min(...chapters.filter(c=>material(e).chapterIds?.includes(c.id)&&(!chapterFilter||c.id===Number(chapterFilter))).map(c=>c.levelMin),99);
  const filtered = items.filter(e=>(!category||materialType(e)===category)&&adventureMatchesLevel(chapters,material(e).chapterIds??[],chapterFilter,levelFilter)&&(!query.trim()||`${e.title} ${material(e).summary} ${e.content}`.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")))).sort((a,b)=>(sort==="chapter"?firstChapter(a)-firstChapter(b):sort==="level"?minimumLevel(a)-minimumLevel(b):sort==="type"?materialType(a).localeCompare(materialType(b),"ru"):0)||a.title.localeCompare(b.title,"ru",{numeric:true}));
  const active = !showCards ? items.find(e=>e.id===localId) || (selected&&items.find(e=>e.id===selected.id)) : null;
  function open(e:KnowledgeEntity){setLocalId(e.id);setShowCards(false);setBook(false);if(module!=="events"&&module!=="shops")onSelect(e.id);}
  const hierarchy = module==="locations"&&locationView==="hierarchy"&&Boolean(presentation?.nodes);
  const openSource=(id:string)=>{const entity=bySourceId.get(id);if(entity)open(entity);};
  const renderDetail=()=>active&&<AdventureCard key={active.id} entity={active} material={material(active)} presentation={presentation} bySourceId={bySourceId} byId={byId} byTitle={byTitle} children={presentation?.nodes?presentation.nodes.filter(n=>n.parentId===sourceId(active.id)&&n.kind!=="npc").map(n=>bySourceId.get(n.entityId)).filter((e):e is NonNullable<typeof e>=>Boolean(e&&e.id!==active.id)):all.filter(e=>"parentId" in e&&e.parentId===active.id)} onSelect={onSelect} onGallery={onGallery} onSourcePage={n=>{setPage(n);setBook(true);}}/>;
  const pageImage={title:`Страница PDF ${page} · книга ${page-1}`,url:`/api/campaign-templates/${templateId}/assets/pages/${String(page).padStart(3,"0")}.webp`};
  const overviewCard=(e:KnowledgeEntity,compact=false)=><button key={e.id} type="button" className={`card ready-material-card ${compact?"compact":""} ${active?.id===e.id?"selected":""}`} onClick={()=>open(e)}>
    <div className="ready-material-card-top"><EntityVisual entity={e}/><span className="ready-material-type">{materialType(e)||labels[module]}</span></div>
    <strong>{e.title}</strong><small className="ready-material-level">{material(e).chapterIds?.length ? `Главы ${material(e).chapterIds!.join(", ")}` : "Общий материал"}{minimumLevel(e)<99 ? ` · от ${minimumLevel(e)} ур. (по главе)` : ""}</small><p>{material(e).summary}</p>
    <span className="ready-material-card-foot">{material(e).sections.some(s=>s.kind==="read_aloud")?<><ScrollText size={14}/>Есть текст для зачитки</>:<><BookOpen size={14}/>Описание и правила</>}</span>
  </button>;
  return <div className="ready-reader">
    <header className="ready-reader-header"><div><p className="eyebrow"><ShieldCheck size={14}/>Готовое приключение</p><h1>{labels[module]||"Приключение"}</h1></div>
      <div className="ready-reader-actions">{active&&!book&&<button className="ghost" type="button" onClick={()=>setShowCards(true)}><ArrowLeft size={16}/>Все карточки</button>}<button className="ghost" type="button" aria-pressed={book} onClick={()=>setBook(!book)}><BookOpen size={16}/>{book?"Вернуться к карточкам":"Открыть исходную книгу"}</button></div>
    </header>
    {module==="locations"&&!book&&<nav className="ready-location-views" aria-label="Вид локаций"><button className="ghost" type="button" aria-pressed={locationView==="hierarchy"} onClick={()=>setLocationView("hierarchy")}>По регионам и вложенности</button><button className="ghost" type="button" aria-pressed={locationView==="cards"} onClick={()=>setLocationView("cards")}>Каталог карточек</button></nav>}
    {book?<section className="ready-book"><nav aria-label="Страницы приключения"><button className="ghost" type="button" disabled={page<=1} onClick={()=>setPage(page-1)}>Назад</button><label>Страница PDF <input aria-label="Страница PDF" type="number" min={1} max={323} value={page} onChange={e=>setPage(Math.max(1,Math.min(323,Number(e.target.value)||1)))}/></label><span>из 323 · книга {page-1}</span><button className="ghost" type="button" disabled={page>=323} onClick={()=>setPage(page+1)}>Вперёд</button></nav>
      <select aria-label="Глава книги" value="" onChange={e=>setPage(Number(e.target.value))}><option value="" disabled>Перейти к главе или приложению</option>{campaign.lore.filter(e=>e.tags.includes("Книга приключения")).map(e=><option key={e.id} value={e.subtitle.match(/PDF (\d+)/)?.[1]}>{e.title}</option>)}</select>
      <button className="ready-book-image" type="button" aria-label="Увеличить исходную страницу" onClick={()=>onGallery("source-book",campaign.title,[pageImage],0)}><img src={mapMediaURL(pageImage.url)} alt={pageImage.title}/></button>
    </section>:<>
      {error?<p role="alert">{error}</p>:!presentation?<p role="status">Подготавливаю карточки приключения…</p>:null}
      {hierarchy&&presentation?<><ReadyLocationHierarchy presentation={presentation} selectedId={active?sourceId(active.id):undefined} onOpen={openSource}/>{renderDetail()}</>:(presentation||error)&&<div className={active?"ready-reader-grid":"ready-reader-overview"}>
        <aside className="ready-reader-directory"><div className="ready-directory-filters"><label>Поиск<input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название, персонаж или место"/></label>{categories.length>1&&<select className="input" aria-label="Тип материала" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Все материалы</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>}<small>{filtered.length} карточек</small></div>
          <div className="ready-catalog-sort"><label>Глава<select className="input" aria-label="Глава каталога" value={chapterFilter} onChange={e=>setChapterFilter(e.target.value)}><option value="">Все главы</option>{presentation?.chapters?.map(c=><option key={c.id} value={c.id}>{c.id}. {c.title} · ур. {c.levelLabel}</option>)}</select></label><label>Рекомендации для уровня<select className="input" aria-label="Уровень каталога" value={levelFilter} onChange={e=>setLevelFilter(e.target.value)}><option value="">Любой уровень</option>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><label>Сортировка<select className="input" aria-label="Сортировка каталога" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">По названию</option><option value="chapter">По главе</option><option value="level">По уровню</option><option value="type">По типу</option></select></label></div>
          <div className={active?"ready-reader-list":"ready-material-grid"}>{filtered.map(e=>overviewCard(e,Boolean(active)))}{!filtered.length&&<p>Ничего не найдено.</p>}</div>
        </aside>
        {renderDetail()}
      </div>}
    </>}
  </div>;
}

function AdventureCard({entity,material,presentation,bySourceId,byId,byTitle,children,onSelect,onGallery,onSourcePage}:{entity:KnowledgeEntity;material:AdventureMaterial;presentation:AdventurePresentation|null;bySourceId:Map<string,KnowledgeEntity>;byId:Map<string,KnowledgeEntity>;byTitle:Map<string,KnowledgeEntity>;children:KnowledgeEntity[];onSelect:(id:string)=>void;onGallery:(id:string,title:string,images:GalleryImage[],index:number)=>void;onSourcePage:(n:number)=>void}){
  const [copied,setCopied]=useState(-1);
  const [readMode,setReadMode]=useState(false);
  const [openSection,setOpenSection]=useState<AdventureSection|null>(null);
  const detailRef=useRef<HTMLElement>(null);
  useEffect(()=>{const frame=requestAnimationFrame(()=>requestAnimationFrame(()=>detailRef.current?.scrollIntoView({block:"start"})));return()=>cancelAnimationFrame(frame);},[entity.id]);
  const readings=material.sections.filter(s=>s.kind==="read_aloud");
  const gm=material.sections.filter(s=>s.kind!=="read_aloud");
  const maps=entity.gallery?.filter(g=>g.url.includes("/maps/"))||[];
  const dossier=entity.kind==="location"||entity.kind==="npc";
  const chapters=presentation?.chapters?.filter(c=>material.chapterIds?.includes(c.id))||[];
  const playerCards=material.playerCards||readings.map(s=>({...s,sourceKind:"quote" as const}));
  const displayedReadings=dossier&&readMode?playerCards:readings;
  const profiles=material.statProfiles||[];
  const locationScope=new Set([sourceId(entity.id)]);
  if(entity.kind==="location"&&presentation?.nodes)for(let i=0;i<8;i++)presentation.nodes.forEach(n=>{if(n.kind!=="npc"&&n.parentId&&locationScope.has(n.parentId))locationScope.add(n.id);});
  const relatedNPCs=entity.kind==="location"?[...bySourceId.values()].filter(n=>n.kind==="npc"&&presentation?.items[sourceId(n.id)]?.locationIds?.some(id=>locationScope.has(id))):[];
  const encounterNPCs=relatedNPCs.filter(n=>presentation?.items[sourceId(n.id)]?.locationLinks?.some(link=>locationScope.has(link.locationId)&&link.relation==="encounter"));
  const referenceNPCs=relatedNPCs.filter(n=>!encounterNPCs.includes(n));
  const npcLinks=(npcs:KnowledgeEntity[])=>npcs.map(n=><button className="card ready-npc-link" type="button" key={n.id} onClick={()=>onSelect(n.id)}><EntityVisual entity={n}/><span><strong>{n.title}</strong><small>{presentation?.items[sourceId(n.id)]?.summary}</small></span></button>);
  const trail=[];
  let node=presentation?.nodes?.find(n=>n.id===sourceId(entity.id));
  while(node){trail.unshift(node);node=presentation?.nodes?.find(n=>n.id===node?.parentId);}
  const escape=(text:string)=>text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  function strip(sections:AdventureSection[],title:string,safe:boolean){return <PlayerFacingCardStrip cards={sections.map(s=>({title:s.title,content:s.text,contentHtml:`<h2>${escape(s.title)}</h2>${s.text.split(/\n\n/).map(p=>`<p>${escape(p)}</p>`).join("")}`}))} entityId={`${entity.id}-${title}`} title={title} cardBadgeLabel={safe?"Для игроков":"Мастеру"} cardBadgeTone={safe?"success":"default"} readOnly createDescription="" description={safe?"Отдельные карточки для зачитывания. Открой карточку, чтобы прочитать весь текст.":"Описание, встречи, правила и секреты. Эти карточки предназначены мастеру."} emptyDescription={safe?"Для этого материала книга не даёт отдельной зачитки. Описание и условия встречи находятся в карточках мастера.":"Дополнительных сведений нет."} onCreateCard={()=>{}} onDeleteCard={()=>{}} onEditCard={()=>{}} onOpenCard={(_,i)=>setOpenSection(sections[i])}/>;}
  async function copy(text:string,index:number){try{await navigator.clipboard.writeText(text);setCopied(index);}catch{setCopied(-2);}}
  return <article ref={detailRef} className={`ready-reader-detail event-scene-card ${readMode?"ready-read-mode":""} ${dossier?"ready-dossier":""}`}>
    {entity.kind==="location"&&presentation?.nodes&&!readMode&&<button className="ghost ready-return-hierarchy" type="button" onClick={()=>document.querySelector(".ready-reader")?.scrollIntoView({block:"start"})}><ArrowLeft size={14}/>К навигации по локациям</button>}
    {!readMode&&trail.length>1&&<nav className="ready-breadcrumbs" aria-label="Путь локации">{trail.map(n=><button className="ghost" type="button" key={n.id} onClick={()=>{const e=bySourceId.get(n.entityId);if(e)onSelect(e.id);}}>{n.title}</button>)}</nav>}
    <header className="ready-detail-heading">{!readMode&&<EntityVisual entity={entity} variant="hero"/>}<div><p className="eyebrow">{readMode?"Текст для игроков":entity.kind==="npc"?"Персонаж приключения":entity.kind==="monster"?"Существо приключения":entity.quickFacts.find(f=>f.label==="Тип материала")?.value||"Материал приключения"}</p><h2>{entity.title}</h2>{!readMode&&<p className="event-scene-summary">{material.summary}</p>}</div></header>
    <div className="ready-detail-tools">{playerCards.length>0&&<button className="ghost" type="button" aria-pressed={readMode} onClick={()=>setReadMode(!readMode)}><ScrollText size={16}/>{readMode?"Вернуть заметки мастера":"Только зачитки"}</button>}{!readMode&&entity.related.length>0&&<nav className="ready-reader-relations" aria-label="Связанные материалы">{entity.related.filter(r=>byId.has(r.id)).map((r,i)=><button className="ghost" type="button" key={`${r.id}-${i}`} onClick={()=>onSelect(r.id)}>{r.label}</button>)}</nav>}</div>
    {!readMode&&<ChapterGuide chapters={chapters} onSourcePage={onSourcePage}/>}
    {!readMode&&material.chapterNotes?.map(note=><p className="ready-level-caveat" key={note.chapterId}>{note.text}</p>)}
    {!readMode&&maps.length>0&&<button className="ready-featured-map" type="button" onClick={()=>onGallery(entity.id,entity.title,maps,0)}><img loading="lazy" src={mapMediaURL(maps[0].url)} alt={maps[0].title}/><span><MapIcon size={16}/>Открыть карту</span></button>}
    {dossier&&!readMode?strip(playerCards.map(s=>({...s,kind:"read_aloud"})),"Игроки видят",true):displayedReadings.map((section,i)=><details className="ready-reading-block" key={i} open={i<2||readMode}><summary><ScrollText size={16}/>{displayedReadings.length===1?"Зачитать игрокам":`Зачитать игрокам · ${section.title}`}</summary><section className="event-read-aloud"><FormattedText content={section.text}/><button className="ghost ready-copy-reading" type="button" onClick={()=>void copy(section.text,i)}><Copy size={14}/>{copied===i?"Скопировано":"Копировать зачитку"}</button></section></details>)}
    {copied===-2&&<p role="status">Не удалось скопировать. Можно выделить текст зачитки вручную.</p>}
    {!readMode&&<>
      {entity.kind==="npc"&&profiles.map((profile,i)=><section className="ready-npc-profile" key={i}><h3>{profile.title}</h3><p className="copy">{profile.basis}</p>{profile.notes&&<details className="ready-gm-section"><summary>Особенности и условия из книги</summary><FormattedText content={profile.notes}/></details>}{profile.sourceTitle&&<p className="ready-level-caveat">{profile.sourceTitle}. Индивидуальные исключения сверяй с абзацем книги. Применённые изменения указаны над статблоком.</p>}<CombatEntityStatSheet entity={{...entity,statBlock:profile.statBlock}} defaultCollapsed={false}/><button className="ghost" type="button" onClick={()=>onSourcePage(profile.pages[0])}>Статистика в источнике · PDF {profile.pages.join(", ")}</button></section>)}
      {(entity.kind==="monster"||entity.kind==="npc"&&!profiles.length)&&entity.statBlock&&<CombatEntityStatSheet entity={entity} defaultCollapsed/>}
      {entity.kind==="npc"&&!profiles.length&&!entity.statBlock&&<p className="ready-level-caveat">Индивидуальный статблок в этом материале не выделен. Боевые параметры не заменены предположениями; смотри описание персонажа и исходные страницы.</p>}
      {entity.kind==="npc"&&material.locationLinks?.length&&<section className="ready-location-npcs"><h3>Где связан с сюжетом</h3>{material.locationLinks.map(link=>{const e=bySourceId.get(link.locationId);return e?<button className="ghost" type="button" key={link.locationId} onClick={()=>onSelect(e.id)} title={link.reason}>{e.title} · PDF {link.pages.join(", ")}</button>:null;})}</section>}
      {encounterNPCs.length>0&&<section className="ready-location-npcs"><h3>Кого можно встретить</h3><p className="copy">НПС с ролью или встречей в описании места и его вложенных областей. Присутствие и условия встречи уточняй по сцене.</p><div>{npcLinks(encounterNPCs)}</div></section>}
      {referenceNPCs.length>0&&<details className="ready-gm-section ready-location-npcs"><summary>Упоминания и сведения о мире · {referenceNPCs.length}</summary><p className="copy">Эти связи не означают, что персонаж находится в локации.</p><div>{npcLinks(referenceNPCs)}</div></details>}
      {gm.length>0&&<section className="ready-gm-notes">{dossier?strip(gm.map(s=>({...s,title:`${s.topic||"Мастеру"} · ${s.title}`})),"Мастеру",false):<><h3><ShieldCheck size={17}/>Мастеру</h3>{gm.map((section,i)=><details className={`ready-gm-section ready-section-${section.kind}`} key={i} open={i===0||section.kind==="loot"}><summary><span>{section.title}</span><small>{section.kind==="loot"?"Награды и находки":section.kind==="rules"?"Правила":"Заметки мастера"}</small></summary><FormattedText content={section.text} entityByTitle={byTitle} onMentionClick={onSelect}/></details>)}</>}</section>}
      {children.length>0&&<section className="ready-child-locations"><h3>Места и области</h3><div>{children.map(e=><button className="ghost" type="button" key={e.id} onClick={()=>onSelect(e.id)}>{e.title}</button>)}</div></section>}
      <details className="ready-source-gallery"><summary><BookOpen size={16}/>Источник и иллюстрации</summary><p className="muted">{entity.subtitle}</p>{material.sourcePages[0]&&<button className="ghost" type="button" onClick={()=>onSourcePage(material.sourcePages[0])}>Открыть страницу в книге</button>}<div>{entity.gallery?.map((g,i)=><button type="button" key={`${g.url}-${i}`} onClick={()=>onGallery(entity.id,entity.title,entity.gallery!,i)}><img loading="lazy" src={mapMediaURL(g.url)} alt=""/><span>{g.title}</span></button>)}</div></details>
    </>}
    {openSection&&<ReadySectionModal section={openSection} entityTitle={entity.title} onClose={()=>setOpenSection(null)} onSourcePage={n=>{setOpenSection(null);onSourcePage(n);}}/>}
  </article>;
}

function ChapterGuide({chapters,onSourcePage}:{chapters:AdventureChapter[];onSourcePage:(n:number)=>void}){
  if(!chapters.length)return null;
  return <details className="ready-chapter-guide"><summary>Главы и опасность · {chapters.map(c=>`${c.id}: ур. ${c.levelLabel}`).join(" · ")}</summary><div>{chapters.map(c=><article key={c.id}><strong>Глава {c.id}. {c.title}</strong><span>Рекомендуемый уровень: {c.levelLabel}</span><p>{c.levelNote}</p></article>)}</div><p>Это уровень главы из схемы книги, а не гарантированная сложность отдельного боя.</p><button className="ghost" type="button" onClick={()=>onSourcePage(10)}>Схема приключения в книге</button></details>;
}

function ReadySectionModal({section,entityTitle,onClose,onSourcePage}:{section:AdventureSection;entityTitle:string;onClose:()=>void;onSourcePage:(n:number)=>void}){
  const [copied,setCopied]=useState(false);
  const [copyError,setCopyError]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const current=dialog.current;current?.showModal();return()=>{if(current?.open)current.close();};},[]);
  return <dialog ref={dialog} className="panel palette ready-section-modal" aria-label={section.title} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><header><div><p className="eyebrow">{section.kind==="read_aloud"?"Для игроков":"Мастеру"} · {entityTitle}</p><h2>{section.title}</h2>{section.sourceKind&&<small>{section.sourceKind==="quote"?"Зачитка из книги":"Краткое описание по книге"}</small>}</div><button className="ghost" type="button" autoFocus onClick={onClose}>Закрыть</button></header><FormattedText content={section.text}/><footer><button className="ghost" type="button" onClick={()=>void navigator.clipboard.writeText(section.text).then(()=>setCopied(true)).catch(()=>setCopyError(true))}><Copy size={16}/>{copied?"Скопировано":"Копировать текст"}</button>{section.pages[0]&&<button className="ghost" type="button" onClick={()=>onSourcePage(section.pages[0])}>Источник · PDF {section.pages.join(", ")}</button>}{copyError&&<p role="status">Не удалось скопировать; можно выделить текст вручную.</p>}</footer></dialog>;
}
