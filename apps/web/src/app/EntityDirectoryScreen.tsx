import {useEffect,useRef,useState} from "react";
import {apiBaseURL} from "./directory-data";
import {requestJson} from "@shadow-edge/api-client";
import {useWorkspaceListState} from "./workspace-route";
import { workspaceURL } from "./workspace-route";
import type { MouseEvent as ReactMouseEvent } from "react";
import type {
  EntityKind,
  KnowledgeEntity,
  LocationEntity,
  ModuleId,
  NpcEntity,
  QuestEntity
} from "@shadow-edge/shared-types";
import {
  badge,
  createPortraitSource,
  gradients,
  hasVisibleArt,
  kindTitle,
  sigil,
  truncateInlineText
} from "../app-shared";
import { usePageSearchHotkey } from "./hooks/usePageSearchHotkey";
import { resolveQuestSceneArtwork, questStatusTone, questStatusLabels, questUrgencyLabels, type QuestCombatEntrySummary } from "../quests";

type EntityDirectoryScreenProps = {
  campaignId:string;
  activeTab:string;
  activeModule: ModuleId;
  activeSectionLabel: string;
  defaultCreateKind: EntityKind;
  moduleDirectoryEntities: KnowledgeEntity[];
  moduleEntitySearch: string;
  onChangeSearch: (value: string) => void;
  onOpenEntity: (entityId: string) => void;
  onOpenEntityActionMenu: (entity: KnowledgeEntity, event: ReactMouseEvent<HTMLElement>) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onOpenEntityModal: (kind: EntityKind) => void;
  onOpenQuestFocus: (questId: string) => void;
  onOpenRandomEventModal: () => void;
  resolveQuestIssuer: (quest: QuestEntity) => NpcEntity | null;
  resolveQuestLocation: (quest: QuestEntity) => LocationEntity | null;
  resolveQuestPreparedCombatEntries: (quest: QuestEntity) => QuestCombatEntrySummary[];
};

export function EntityDirectoryScreen({
  campaignId,activeTab,
  activeModule,
  activeSectionLabel,
  defaultCreateKind,
  moduleDirectoryEntities:initialEntities,
  moduleEntitySearch,
  onChangeSearch,
  onOpenEntity,
  onOpenEntityActionMenu,
  onOpenEntityImage,
  onOpenEntityModal,
  onOpenQuestFocus,
  onOpenRandomEventModal,
  resolveQuestIssuer,
  resolveQuestLocation,
  resolveQuestPreparedCombatEntries
}: EntityDirectoryScreenProps) {
  const [requestedRows,setRequestedRows]=useWorkspaceListState<number>("directory.rows",48);
  const [page,setPage]=useState<{items:KnowledgeEntity[];total:number;nextCursor:string}>({items:[],total:0,nextCursor:""}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  const [failedThumbnails,setFailedThumbnails]=useState<Set<string>>(()=>new Set());
  const generation=useRef(0);
  const endpoint=`${apiBaseURL}/api/campaigns/${encodeURIComponent(campaignId)}/entities?kind=${defaultCreateKind}&limit=48&tab=${encodeURIComponent(activeTab)}&q=${encodeURIComponent(moduleEntitySearch)}`;
  const moduleDirectoryEntities=page.items;
  useEffect(()=>{const abort=new AbortController();const version=++generation.current;setPage({items:[],total:0,nextCursor:""});setLoading(true);setError("");const timer=setTimeout(()=>{void requestJson<typeof page>(endpoint,{signal:abort.signal}).then(result=>{if(version===generation.current)setPage(result);}).catch(reason=>{if(!abort.signal.aborted)setError(reason instanceof Error?reason.message:"Не удалось загрузить записи.");}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});},moduleEntitySearch?250:0);return()=>{abort.abort();clearTimeout(timer);};},[endpoint,retry,initialEntities]);
  const more=async()=>{if(loading||!page.nextCursor)return;const version=generation.current;setLoading(true);setError("");try{const result=await requestJson<typeof page>(endpoint+`&cursor=${encodeURIComponent(page.nextCursor)}`);if(version===generation.current)setPage(old=>({...result,items:[...old.items,...result.items]}));}catch(reason){if(version===generation.current)setError(reason instanceof Error?reason.message:"Страница недоступна.");}finally{if(version===generation.current)setLoading(false);}};
  useEffect(()=>{if(!loading&&!error&&page.nextCursor&&page.items.length<Math.min(1000,Math.max(48,requestedRows)))void more();},[requestedRows,page.items.length,page.nextCursor,loading,error]);
  const searchInputRef = usePageSearchHotkey<HTMLInputElement>();

  return (
    <div className="stack wide">
      <section className="card section-card directory-screen">
        <div className="directory-head">
          <div>
            <h1>{activeModule === "players" ? "Карточки группы" : activeSectionLabel}</h1>
            {activeModule === "players" && <p className="copy">Краткие записи мастера. Полные листы и приглашения игроков — выше.</p>}
            <p className="copy">{moduleEntitySearch ? "Найдено" : "Записей в кампании"}: {page.total}</p>
          </div>
          <div className="actions">
            {activeModule === "quests" ? (
              <button className="ghost" onClick={onOpenRandomEventModal} type="button">
                Сцена для зачитки
              </button>
            ) : null}
            <button className="primary" onClick={() => onOpenEntityModal(defaultCreateKind)} type="button">
              Добавить {({location:"локацию",npc:"НПС",player:"персонажа",monster:"монстра",quest:"квест",lore:"заметку"})[defaultCreateKind]}
            </button>
          </div>
        </div>

        <label className="field">
          <span>Поиск</span>
          <input
            className="input"
            ref={searchInputRef}
            onChange={(event) => {setRequestedRows(48);onChangeSearch(event.target.value);}}
            placeholder={`Поиск по разделу «${activeSectionLabel}»`}
            value={moduleEntitySearch}
          />
        </label>

        {error&&<p role="alert">{error} <button onClick={()=>setRetry(value=>value+1)}>Обновить список</button></p>}
        {loading&&<p role="status">Загружаю записи…</p>}
        {moduleDirectoryEntities.length ? (
          <div className="directory-grid">
            {activeModule === "quests"
              ? moduleDirectoryEntities
                  .filter((entity): entity is QuestEntity => entity.kind === "quest")
                  .map((quest) => {
                    const location = resolveQuestLocation(quest);
                    const issuer = resolveQuestIssuer(quest);
                    const preparedEntries = resolveQuestPreparedCombatEntries(quest);
                    const preparedCombatCount = preparedEntries.reduce((sum, item) => sum + item.quantity, 0);
                    const sceneImage = resolveQuestSceneArtwork(quest, location, issuer, preparedEntries);

                    return (
                      <article
                        key={quest.id}
                        className="directory-card quest-directory-card"
                        onContextMenu={(event) => onOpenEntityActionMenu(quest, event)}
                      >
                        <button
                          aria-haspopup={onOpenEntityImage ? "dialog" : undefined}
                          aria-label={onOpenEntityImage ? `Открыть изображение «${quest.title}»` : undefined}
                          className={`directory-card-thumb ${onOpenEntityImage ? "entity-image-trigger" : ""}`.trim()}
                          disabled={!onOpenEntityImage}
                          onClick={() => onOpenEntityImage?.(quest, sceneImage)}
                          title={onOpenEntityImage ? `Открыть изображение «${quest.title}»` : undefined}
                          type="button"
                        >
                          <img alt={quest.title} className="directory-card-image" loading="lazy" src={sceneImage} />
                        </button>
                        <button className="directory-card-copy" onClick={() => onOpenQuestFocus(quest.id)} type="button">
                          <span className="directory-card-topline">
                            <strong>{quest.title}</strong>
                            <span className={badge(questStatusTone(quest.status))}>{questStatusLabels[quest.status]}</span>
                          </span>
                          <small>{location?.title ?? issuer?.title ?? quest.subtitle}</small>
                          <p>{truncateInlineText(quest.summary, 150)}</p>
                          <span className="directory-meta">
                            <span>{questUrgencyLabels[quest.urgency]}</span>
                            {preparedCombatCount ? <span>{preparedCombatCount} в бою</span> : null}
                          </span>
                        </button>
                      </article>
                    );
                  })
              : moduleDirectoryEntities.map((entity) => {
                  const displayUrl = hasVisibleArt(entity.art) && !failedThumbnails.has(entity.art?.url||"") ? createPortraitSource(entity) : undefined;
                  return (
                    <article
                      key={entity.id}
                      className="directory-card"
                      onContextMenu={(event) => onOpenEntityActionMenu(entity, event)}
                    >
                      <button
                        aria-haspopup={onOpenEntityImage ? "dialog" : undefined}
                        aria-label={onOpenEntityImage ? `Открыть изображение «${entity.title}»` : undefined}
                        className={`directory-card-thumb ${onOpenEntityImage ? "entity-image-trigger" : ""}`.trim()}
                        disabled={!onOpenEntityImage}
                        onClick={() => onOpenEntityImage?.(entity, displayUrl)}
                        title={onOpenEntityImage ? `Открыть изображение «${entity.title}»` : undefined}
                        type="button"
                      >
                        {displayUrl ? (
                          <img alt={entity.title} className="directory-card-image" loading="lazy" src={displayUrl} onError={()=>setFailedThumbnails(current=>new Set([...current,displayUrl]))} />
                        ) : (
                          <span className="sigil big" style={{ backgroundImage: gradients[entity.kind] }}>
                            {sigil(entity.title)}
                          </span>
                        )}
                      </button>
                      <button className="directory-card-copy" onClick={() => onOpenEntity(entity.id)} type="button">
                        <span className="directory-card-topline">
                          <strong>{entity.title}</strong>
                          <span className={badge()}>{kindTitle[entity.kind]}</span>
                        </span>
                        <small>{entity.subtitle}</small>
                        <p>{truncateInlineText(entity.summary, 150)}</p><small>{({location:"Открыть место и связи",npc:"Открыть НПС и связи",player:"Открыть персонажа и лист",monster:"Открыть характеристики",quest:"Продолжить квест",lore:"Открыть заметку"})[entity.kind]}</small>
                      </button>
                      {entity.kind==="location"&&<a className="ghost directory-map-link" href={workspaceURL({campaignId,section:"maps",view:"new",context:JSON.stringify({locationId:entity.id})})}>Карта или сцена места →</a>}
                    </article>
                  );
                })}
          </div>
        ) : !loading&&!error ? (
          <div className="directory-empty">
            <h3>{moduleEntitySearch ? "Ничего не найдено" : "Здесь пока пусто"}</h3>
            <p className="copy">{moduleEntitySearch ? "Попробуйте другое название или очистите поиск." : "Добавьте первую запись — описание можно дополнить позже."}</p>
            {moduleEntitySearch ? <button className="ghost" onClick={() => onChangeSearch("")} type="button">Очистить поиск</button> : null}
          </div>
        ):null}
        {page.nextCursor&&<button disabled={loading} onClick={()=>{if(error)void more();else setRequestedRows(page.items.length+48);}}>Показать ещё записи</button>}
      </section>
    </div>
  );
}
