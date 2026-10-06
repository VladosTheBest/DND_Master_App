import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, GitBranch, LayoutGrid, Minus, Plus, RotateCcw, Users } from "lucide-react";
import { adventureKindLabels, adventureMatchesLevel, type AdventureNode, type AdventurePresentation } from "./ready-adventure.types";

export function ReadyLocationHierarchy({ presentation, selectedId, onOpen }: { presentation: AdventurePresentation; selectedId?: string; onOpen: (sourceId: string) => void }) {
  const nodes = presentation.nodes ?? [];
  const rootId = presentation.rootId ?? "";
  const chapters = presentation.chapters ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootId]));
  const [focused, setFocused] = useState("");
  const [query, setQuery] = useState("");
  const [chapter, setChapter] = useState("");
  const [region, setRegion] = useState("");
  const [level, setLevel] = useState("");
  const [kind, setKind] = useState("");
  const [showNPCs, setShowNPCs] = useState(true);
  const [showMentions, setShowMentions] = useState(false);
  const [mode, setMode] = useState<"diagram" | "cards">("diagram");
  const [zoom, setZoom] = useState(1);
  const [viewHeight, setViewHeight] = useState(510);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const children = useMemo(() => {
    const index = new Map<string, AdventureNode[]>();
    nodes.forEach(n => { if (n.parentId) index.set(n.parentId, [...(index.get(n.parentId) ?? []), n]); });
    const order = ["region", "city", "site", "landmark", "area", "npc", "group"];
    index.forEach(group => group.sort((a, b) => order.indexOf(a.kind)-order.indexOf(b.kind) || a.title.localeCompare(b.title, "ru", { numeric: true })));
    return index;
  }, [nodes]);
  const filtered = Boolean(query.trim() || chapter || region || level || kind);
  const { visible, hits } = useMemo(() => {
    const visible = new Set<string>(), hits = new Set<string>();
    function path(n: AdventureNode) {
      for (let current: AdventureNode | undefined = n; current; current = current.parentId ? byId.get(current.parentId) : undefined) visible.add(current.id);
    }
    function inRegion(n: AdventureNode): boolean {
      if (!region) return true;
      for (let current: AdventureNode | undefined = n; current; current = current.parentId ? byId.get(current.parentId) : undefined) if (current.id === region) return true;
      return false;
    }
    for (const n of nodes) {
      if (n.kind === "npc" && (!showNPCs || !showMentions && n.relation === "mention")) continue;
      if (adventureMatchesLevel(chapters, n.chapterIds, chapter, level) && (!kind || n.kind === kind)
          && inRegion(n) && (!query.trim() || n.title.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")))) { hits.add(n.id); path(n); }
    }
    if (!filtered) nodes.filter(n => n.kind !== "npc" || showNPCs && (showMentions || n.relation !== "mention")).forEach(n => visible.add(n.id));
    visible.add(rootId);
    return { visible, hits };
  }, [nodes, byId, chapters, chapter, region, level, kind, query, showNPCs, showMentions, filtered, rootId]);
  useEffect(() => {
    if (filtered) setExpanded(current => new Set([...current, ...[...visible].filter(id => (children.get(id) ?? []).some(n => visible.has(n.id)))]));
  }, [filtered, visible, children]);
  useEffect(() => {
    if (!selectedId) return;
    setExpanded(current => {
      const next = new Set(current);
      for (const node of nodes.filter(n => n.entityId === selectedId)) {
        let parent = node.parentId;
        while (parent) { next.add(parent); parent = byId.get(parent)?.parentId; }
      }
      return next;
    });
  }, [selectedId, nodes, byId]);
  const displayedChildren = (id: string) => (children.get(id) ?? []).filter(n => visible.has(n.id) && (showNPCs || n.kind !== "npc"));
  function choose(node: AdventureNode, button: HTMLButtonElement) {
    if (mode === "diagram" && viewport.current) {
      const rect = button.closest(".ready-tree-node")!.getBoundingClientRect(), view = viewport.current.getBoundingClientRect();
      anchor.current = {x:rect.left-view.left,y:rect.top-view.top};
    }
    setFocused(node.id);
    if (displayedChildren(node.id).length) setExpanded(current => { const next = new Set(current); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next; });
  }
  const nodeWidth = 254, nodeHeight = 152, gap = 28, step = 212;
  const layout: { node: AdventureNode; x: number; y: number; childCount: number }[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const widths = new Map<string, number>();
  function measure(id: string): number {
    const kids = expanded.has(id) ? displayedChildren(id) : [];
    const width = Math.max(nodeWidth, kids.reduce((sum,n) => sum + measure(n.id), 0) + Math.max(0,kids.length-1)*gap);
    widths.set(id,width); return width;
  }
  let maxDepth = 0;
  function place(id: string, left: number, depth: number): { x: number; y: number } {
    const node = byId.get(id)!;
    const kids = displayedChildren(id);
    const x = left + (widths.get(id)!-nodeWidth)/2, y = 24 + depth*step;
    maxDepth = Math.max(maxDepth,depth);
    layout.push({node,x,y,childCount:kids.length});
    let childLeft = left;
    if (expanded.has(id)) kids.forEach(child => {
      const p = place(child.id,childLeft,depth+1);
      edges.push({x1:x+nodeWidth/2,y1:y+nodeHeight,x2:p.x+nodeWidth/2,y2:p.y});
      childLeft += widths.get(child.id)!+gap;
    });
    return {x,y};
  }
  const width = byId.has(rootId) ? measure(rootId)+48 : nodeWidth+48;
  if (byId.has(rootId)) place(rootId,24,0);
  const height = (maxDepth*step)+nodeHeight+48;
  // Keep the clicked card in place when its subtree changes the canvas width.
  useLayoutEffect(() => {
    const position = layout.find(p => p.node.id === focused);
    if (anchor.current && position && viewport.current) {
      viewport.current.scrollLeft = position.x*zoom-anchor.current.x;
      viewport.current.scrollTop = position.y*zoom-anchor.current.y;
    }
    anchor.current = null;
  });
  useEffect(() => {
    const view = viewport.current;
    if (!view) return;
    const observer = new ResizeObserver(() => setViewHeight(Math.round(view.getBoundingClientRect().height)));
    observer.observe(view);
    return () => observer.disconnect();
  }, [mode, hits.size]);
  const nodeContent = (node: AdventureNode, childCount: number) => <>
    <button type="button" className="ready-tree-open" aria-label={`${childCount ? expanded.has(node.id) ? "Свернуть" : "Развернуть" : "Выбрать"}: ${node.title}`} aria-expanded={childCount ? expanded.has(node.id) : undefined} aria-pressed={focused === node.id} onClick={e => choose(node,e.currentTarget)} title={node.reason || node.title}>
      <small>{adventureKindLabels[node.kind]}{node.navigationGroup ? " · группа мест" : ""}</small><strong>{node.title}</strong>
      <span>{node.kind === "npc" ? node.relation === "mention" ? "Упоминание, не место встречи" : node.relation === "unplaced" ? "Постоянное место не установлено" : "Встреча / роль в сцене" : node.chapterIds.length ? `Главы ${node.chapterIds.join(", ")}` : "Общий материал"}</span>
      {childCount > 0 && <span className="ready-tree-child-count">{expanded.has(node.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}Внутри: {childCount}</span>}
    </button>
    <div className="ready-tree-actions">{focused === node.id && node.kind !== "group" && <button className="ghost" type="button" aria-label={`Открыть: ${node.title}`} onClick={() => onOpen(node.entityId)}>Открыть</button>}</div>
  </>;
  const nodeClass = (node: AdventureNode) => `ready-tree-node ${node.kind} ${focused === node.id ? "selected" : ""} ${filtered && !hits.has(node.id) ? "ready-tree-ancestor" : ""}`;
  function cardChildren(id: string): ReactNode {
    const kids = displayedChildren(id);
    return <><div className="ready-branch-grid">{kids.map(n => <div key={n.id} data-node-id={n.id} className={`${nodeClass(n)} ready-tree-card`}>{nodeContent(n,displayedChildren(n.id).length)}</div>)}</div>
      {kids.filter(n => expanded.has(n.id) && displayedChildren(n.id).length).map(n => <section key={n.id} className="ready-branch-children" aria-label={`Внутри: ${n.title}`}><h3>{n.title}<ChevronDown size={16}/></h3>{cardChildren(n.id)}</section>)}</>;
  }
  function fit() { setZoom(Math.min(1,Math.max(.15,((viewport.current?.clientWidth ?? width)-16)/width))); viewport.current?.scrollTo(0,0); }
  return <section className="ready-hierarchy" aria-label="Иерархия приключения">
    <div className="ready-hierarchy-heading"><div><h2><GitBranch size={20}/>Путеводитель по приключению</h2><p>Нажми карточку, чтобы раскрыть вложенность. Кнопка «Открыть» покажет описание выбранного места или НПС.</p></div>
      <div className="ready-hierarchy-mode"><button className="ghost" type="button" aria-pressed={mode === "diagram"} onClick={() => setMode("diagram")}><GitBranch size={16}/>Диаграмма</button><button className="ghost" type="button" aria-pressed={mode === "cards"} onClick={() => setMode("cards")}><LayoutGrid size={16}/>Вложенные карточки</button></div>
    </div>
    <div className="ready-hierarchy-filters">
      <label>Поиск по дереву<input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Город, область или НПС"/></label>
      <label>Регион<select className="input" aria-label="Регион" value={region} onChange={e => setRegion(e.target.value)}><option value="">Все регионы</option>{nodes.filter(n => n.kind === "region").map(n => <option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
      <label>Глава<select className="input" aria-label="Глава" value={chapter} onChange={e => setChapter(e.target.value)}><option value="">Все главы</option>{chapters.map(c => <option key={c.id} value={c.id}>{c.id}. {c.title} · ур. {c.levelLabel}</option>)}</select></label>
      <label>Рекомендации для уровня<select className="input" aria-label="Рекомендации для уровня" value={level} onChange={e => setLevel(e.target.value)}><option value="">Любой уровень</option>{Array.from({length:12}, (_,i) => <option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
      <label>Тип<select className="input" aria-label="Тип в иерархии" value={kind} onChange={e => setKind(e.target.value)}><option value="">Все типы</option>{Object.entries(adventureKindLabels).filter(([k]) => nodes.some(n => n.kind === k)).map(([k,label]) => <option key={k} value={k}>{label}</option>)}</select></label>
    </div>
    <div className="ready-hierarchy-toolbar"><label><input type="checkbox" checked={showNPCs} onChange={e => setShowNPCs(e.target.checked)}/><Users size={15}/>Показывать НПС</label><label><input type="checkbox" checked={showMentions} onChange={e => setShowMentions(e.target.checked)}/>Также упоминания</label><button className="ghost" type="button" onClick={() => { setQuery(""); setChapter(""); setRegion(""); setLevel(""); setKind(""); setFocused(""); setExpanded(new Set([rootId])); }}>Свернуть всё</button>{filtered && <small>{hits.size} совпадений · путь к ним сохранён</small>}
      {mode === "diagram" && <div className="ready-tree-zoom"><button className="ghost" type="button" aria-label="Уменьшить диаграмму" disabled={zoom <= .15} onClick={() => setZoom(z => Math.max(.15,z-.1))}><Minus size={16}/></button><span>{Math.round(zoom*100)}%</span><button className="ghost" type="button" aria-label="Увеличить диаграмму" disabled={zoom >= 1.5} onClick={() => setZoom(z => Math.min(1.5,z+.1))}><Plus size={16}/></button><button className="ghost" type="button" aria-label="Вписать диаграмму" onClick={fit}>Вписать</button><button className="ghost" type="button" aria-label="Сбросить масштаб" onClick={() => setZoom(1)}><RotateCcw size={16}/></button></div>}
    </div>
    {filtered && !hits.size ? <p role="status">По этим условиям ничего не найдено. Измени поиск, главу, уровень или тип.</p> : mode === "cards" ? <div className="ready-tree-cards">{byId.has(rootId) && <><div className={`${nodeClass(byId.get(rootId)!)} ready-tree-card ready-tree-root`}>{nodeContent(byId.get(rootId)!,displayedChildren(rootId).length)}</div>{expanded.has(rootId) && cardChildren(rootId)}</>}</div> : <>
      <div className="ready-tree-size"><label>Высота области<input aria-label="Высота области диаграммы" type="range" min={280} max={900} step={10} value={viewHeight} onChange={e => setViewHeight(Number(e.target.value))}/><span>{viewHeight} px</span></label><small>Перетаскивай свободное место, чтобы перемещаться по диаграмме.</small></div>
      <div ref={viewport} className="ready-tree-viewport" style={{height:viewHeight}} tabIndex={0} aria-label="Диаграмма: прокрутите для просмотра ветвей"
        onPointerDown={e => { if(e.button !== 0 || e.pointerType !== "mouse" || (e.target as HTMLElement).closest("button")) return; const bounds=e.currentTarget.getBoundingClientRect(); if(e.clientX>bounds.right-22&&e.clientY>bounds.bottom-22) return; drag.current={x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop}; e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.classList.add("panning"); e.preventDefault(); }}
        onPointerMove={e => { if(drag.current){ e.currentTarget.scrollLeft=drag.current.left+drag.current.x-e.clientX; e.currentTarget.scrollTop=drag.current.top+drag.current.y-e.clientY; } }}
        onPointerUp={e => { drag.current=null; e.currentTarget.classList.remove("panning"); if(e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerCancel={e => {drag.current=null;e.currentTarget.classList.remove("panning");}}>
        <div style={{width:Math.max(width*zoom,viewport.current?.clientWidth ?? 0),height:height*zoom}}><div className="ready-tree-canvas" style={{width,height,transform:`scale(${zoom})`}}>
          <svg width={width} height={height} aria-hidden="true">{edges.map((e,i) => <path key={i} d={`M${e.x1},${e.y1} V${(e.y1+e.y2)/2} H${e.x2} V${e.y2}`}/>)}</svg>
          {layout.map(({node,x,y,childCount}) => <div key={node.id} data-node-id={node.id} className={nodeClass(node)} style={{left:x,top:y}}>{nodeContent(node,childCount)}</div>)}
        </div></div>
      </div></>}
    <p className="ready-level-caveat">Уровни — рекомендации главы из схемы книги (PDF 10), а не оценка каждого боя. Присутствие НПС зависит от сцены.</p>
  </section>;
}
