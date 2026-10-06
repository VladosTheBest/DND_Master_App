import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, GitBranch, LayoutList, Minus, Plus, RotateCcw, Users } from "lucide-react";
import { adventureKindLabels, type AdventureNode, type AdventurePresentation } from "./ready-adventure.types";

export function ReadyLocationHierarchy({ presentation, selectedId, onOpen }: { presentation: AdventurePresentation; selectedId?: string; onOpen: (sourceId: string) => void }) {
  const nodes = presentation.nodes ?? [];
  const rootId = presentation.rootId ?? "";
  const chapters = presentation.chapters ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootId]));
  const [query, setQuery] = useState("");
  const [chapter, setChapter] = useState("");
  const [region, setRegion] = useState("");
  const [level, setLevel] = useState("");
  const [showNPCs, setShowNPCs] = useState(true);
  const [showMentions, setShowMentions] = useState(false);
  const [mode, setMode] = useState<"diagram" | "list">("diagram");
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const children = useMemo(() => {
    const index = new Map<string, AdventureNode[]>();
    nodes.forEach(n => { if (n.parentId) index.set(n.parentId, [...(index.get(n.parentId) ?? []), n]); });
    const order = ["region", "city", "site", "landmark", "area", "npc", "group"];
    index.forEach(group => group.sort((a, b) => order.indexOf(a.kind)-order.indexOf(b.kind) || a.title.localeCompare(b.title, "ru", { numeric: true })));
    return index;
  }, [nodes]);
  const filtered = Boolean(query.trim() || chapter || region || level);
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
      const relevant = chapters.filter(c => n.chapterIds.includes(c.id) && (!chapter || c.id === Number(chapter)));
      if ((!chapter || relevant.length) && (!level || relevant.some(c => Number(level) >= c.levelMin && (c.levelMax === null || Number(level) <= c.levelMax)))
          && inRegion(n) && (!query.trim() || n.title.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")))) { hits.add(n.id); path(n); }
    }
    if (!filtered) nodes.filter(n => n.kind !== "npc" || showNPCs && (showMentions || n.relation !== "mention")).forEach(n => visible.add(n.id));
    visible.add(rootId);
    return { visible, hits };
  }, [nodes, byId, chapters, chapter, region, level, query, showNPCs, showMentions, filtered, rootId]);
  // Search opens only the paths to its results. Normal browsing remembers folds.
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
  function toggle(id: string) { setExpanded(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  const layout: { node: AdventureNode; x: number; y: number; depth: number; childCount: number }[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let row = 0, maxDepth = 0;
  function place(id: string, depth: number): { x: number; y: number } {
    const node = byId.get(id)!;
    const childNodes = displayedChildren(id);
    const positions = expanded.has(id) ? childNodes.map(child => place(child.id, depth + 1)) : [];
    const y = positions.length ? positions[0].y : row++ * 110 + 16;
    const x = depth * 300 + 16;
    maxDepth = Math.max(maxDepth, depth);
    layout.push({ node, x, y, depth, childCount: childNodes.length });
    positions.forEach(p => edges.push({ x1: x + 254, y1: y + 44, x2: p.x, y2: p.y + 44 }));
    return { x, y };
  }
  if (byId.has(rootId)) place(rootId, 0);
  const width = (maxDepth+1)*300, height = Math.max(160, row*110 + 32);
  const nodeContent = (node: AdventureNode, childCount: number) => <>
    <button type="button" className="ready-tree-open" onClick={() => node.kind === "group" ? toggle(node.id) : onOpen(node.entityId)} title={node.reason || node.title}>
      <small>{adventureKindLabels[node.kind]}{node.navigationGroup ? " · группа мест" : ""}</small><strong>{node.title}</strong>
      <span>{node.kind === "npc" ? node.relation === "mention" ? "Упоминание, не место встречи" : node.relation === "unplaced" ? "Постоянное место не установлено" : "Встреча / роль в сцене" : node.chapterIds.length ? `Главы ${node.chapterIds.join(", ")}` : "Общий материал"}</span>
    </button>
    {childCount > 0 && <button type="button" className="ready-tree-toggle" aria-label={`${expanded.has(node.id) ? "Свернуть" : "Развернуть"}: ${node.title}`} aria-expanded={expanded.has(node.id)} onClick={() => toggle(node.id)}>{expanded.has(node.id) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}<span>{childCount}</span></button>}
  </>;
  function listBranch(id: string, depth = 0): ReactNode {
    const node = byId.get(id); if (!node) return null;
    const kids = displayedChildren(id);
    return <li key={id}><div className={`ready-tree-node ready-tree-list-node ${node.kind} ${node.entityId === selectedId ? "selected" : ""}`}>{nodeContent(node, kids.length)}</div>{expanded.has(id) && kids.length > 0 && <ul>{kids.map(n => listBranch(n.id, depth+1))}</ul>}</li>;
  }
  return <section className="ready-hierarchy" aria-label="Иерархия приключения">
    <div className="ready-hierarchy-heading"><div><h2><GitBranch size={20}/>Путеводитель по приключению</h2><p>Раскрой ветку региона, города или области. НПС связаны с конкретными фрагментами книги; их присутствие зависит от сцены.</p></div>
      <div className="ready-hierarchy-mode"><button className="ghost" type="button" aria-pressed={mode === "diagram"} onClick={() => setMode("diagram")}><GitBranch size={16}/>Диаграмма</button><button className="ghost" type="button" aria-pressed={mode === "list"} onClick={() => setMode("list")}><LayoutList size={16}/>Дерево</button></div>
    </div>
    <div className="ready-hierarchy-filters">
      <label>Поиск по дереву<input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Город, область или НПС"/></label>
      <label>Регион<select className="input" aria-label="Регион" value={region} onChange={e => setRegion(e.target.value)}><option value="">Все регионы</option>{nodes.filter(n => n.kind === "region").map(n => <option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
      <label>Глава<select className="input" aria-label="Глава" value={chapter} onChange={e => setChapter(e.target.value)}><option value="">Все главы</option>{chapters.map(c => <option key={c.id} value={c.id}>{c.id}. {c.title} · ур. {c.levelLabel}</option>)}</select></label>
      <label>Рекомендации для уровня<select className="input" aria-label="Рекомендации для уровня" value={level} onChange={e => setLevel(e.target.value)}><option value="">Любой уровень</option>{Array.from({length:12}, (_,i) => <option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
    </div>
    <div className="ready-hierarchy-toolbar"><label><input type="checkbox" checked={showNPCs} onChange={e => setShowNPCs(e.target.checked)}/><Users size={15}/>Показывать НПС</label><label><input type="checkbox" checked={showMentions} onChange={e => setShowMentions(e.target.checked)}/>Также упоминания</label><button className="ghost" type="button" onClick={() => { setQuery(""); setChapter(""); setRegion(""); setLevel(""); setExpanded(new Set([rootId])); }}>Свернуть всё</button>{filtered && <small>{hits.size} совпадений</small>}
      {mode === "diagram" && <div className="ready-tree-zoom"><button className="ghost" type="button" aria-label="Уменьшить диаграмму" disabled={zoom <= .5} onClick={() => setZoom(z => Math.max(.5,z-.1))}><Minus size={16}/></button><span>{Math.round(zoom*100)}%</span><button className="ghost" type="button" aria-label="Увеличить диаграмму" disabled={zoom >= 1.5} onClick={() => setZoom(z => Math.min(1.5,z+.1))}><Plus size={16}/></button><button className="ghost" type="button" aria-label="Вписать диаграмму" onClick={() => {setZoom(Math.min(1,Math.max(.5,(viewport.current?.clientWidth??width)/width)));viewport.current?.scrollTo(0,0);}}>Вписать</button><button className="ghost" type="button" aria-label="Сбросить масштаб" onClick={() => setZoom(1)}><RotateCcw size={16}/></button></div>}
    </div>
    {filtered && !hits.size ? <p role="status">По этим условиям ничего не найдено. Измени поиск, главу или уровень.</p> : mode === "list" ? <ul className="ready-tree-list">{listBranch(rootId)}</ul> : <div ref={viewport} className="ready-tree-viewport" tabIndex={0} aria-label="Диаграмма: прокрутите для просмотра ветвей"><div style={{width:width*zoom,height:height*zoom}}><div className="ready-tree-canvas" style={{width,height,transform:`scale(${zoom})`}}>
      <svg width={width} height={height} aria-hidden="true">{edges.map((e,i) => <path key={i} d={`M${e.x1},${e.y1} H${e.x1+22} V${e.y2} H${e.x2}`}/>)}</svg>
      {layout.map(({node,x,y,childCount}) => <div key={node.id} className={`ready-tree-node ${node.kind} ${node.entityId === selectedId ? "selected" : ""}`} style={{left:x,top:y}}>{nodeContent(node,childCount)}</div>)}
    </div></div></div>}
    <p className="ready-level-caveat">Уровни — рекомендации главы из схемы книги (PDF 10), а не оценка каждого боя. Ловушки, отдельные противники и решения игроков могут сделать место опаснее.</p>
  </section>;
}
