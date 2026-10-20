import {useEffect,useRef,useState} from 'react';
import type {WorldMapDocument} from '@shadow-edge/shared-types';
import {api} from '../../app/api';
import {mapRequest,mapRoute} from './world-maps.api';
import {MapCreateForm} from './MapCreateForm';
import {creativePNG,decorations,emptyScene,paintScene,type CreativeItem,type CreativeKind,type CreativeScene} from './creative-map';

export function CreativeMapEditor({campaignId,original,onSaved,onDirty,onVariant}:{campaignId:string;original?:WorldMapDocument;onSaved:(m:WorldMapDocument)=>void;onDirty:(d:boolean)=>void;onVariant:(m:WorldMapDocument)=>void}){
 const [scene,setScene]=useState<CreativeScene>(()=>original?.creative?JSON.parse(original.creative):emptyScene());
 const [title,setTitle]=useState(original?.title||'Новая ручная карта');
 const [saved,setSaved]=useState(original),[baseline,setBaseline]=useState(()=>JSON.stringify([title,scene]));
 const [tool,setTool]=useState<CreativeKind|'select'|'erase'>('room'),[selected,setSelected]=useState('');
 const [color,setColor]=useState('#d6ceb8'),[size,setSize]=useState(60),[zoom,setZoom]=useState(65),[snap,setSnap]=useState(true);
 const [past,setPast]=useState<CreativeScene[]>([]),[future,setFuture]=useState<CreativeScene[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[ai,setAI]=useState(false),[style,setStyle]=useState('Детализированная фэнтези battlemap');
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef(scene),lock=useRef(false),id=useRef(original?.id||crypto.randomUUID());latest.current=scene;
 const gesture=useRef<{before:CreativeScene;start:number[];item:string;move:boolean}|null>(null);
 const dirty=JSON.stringify([title,scene])!==baseline;
 useEffect(()=>onDirty(dirty),[dirty,onDirty]);
 useEffect(()=>{if(canvas.current)paintScene(canvas.current,scene,selected);},[scene,selected]);
 function change(next:CreativeScene){setPast(p=>[...p.slice(-49),scene]);setFuture([]);setScene(next);setNotice('');}
 function patch(p:Partial<CreativeItem>){change({...scene,items:scene.items.map(i=>i.id===selected?{...i,...p}:i)});}
 const item=scene.items.find(i=>i.id===selected);
 function point(e:React.PointerEvent){const r=canvas.current!.getBoundingClientRect();const step=snap&&tool!=='brush'?25:1;return [Math.max(0,Math.min(1600,Math.round((e.clientX-r.left)*1600/r.width/step)*step)),Math.max(0,Math.min(1000,Math.round((e.clientY-r.top)*1000/r.height/step)*step))];}
 function finish(cancel=false){const g=gesture.current;if(!g)return;gesture.current=null;if(cancel)setScene(g.before);else {setPast(p=>[...p.slice(-49),g.before]);setFuture([]);}}
 async function save(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  const blob=await creativePNG(scene);const upload=await api.uploadImage(campaignId,new File([blob],'creative-map.png',{type:'image/png'}));
  const result=await mapRequest<WorldMapDocument>(`${mapRoute(campaignId)}/creative`,'POST',{id:id.current,title,revision:saved?.revision||0,imageUrl:new URL(upload.url,location.origin).pathname,creative:JSON.stringify(scene)});
  setSaved(result);setBaseline(JSON.stringify([title,scene]));onSaved(result);setNotice('Ручная карта сохранена');
 }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 async function download(){setError('');try{const blob=await creativePNG(scene),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${title.replace(/[\\/:*?"<>|]/g,'_')||'map'}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError((e as Error).message);}}
 return <section className="creative-editor" aria-label="Креатив — редактор карты"><fieldset disabled={busy}>
 <div className="world-map-toolbar"><label>Название ручной карты<input value={title} maxLength={160} onChange={e=>setTitle(e.target.value)}/></label><div className="world-map-tools">
 <button type="button" disabled={!past.length} onClick={()=>{setFuture(f=>[scene,...f]);setScene(past[past.length-1]);setPast(p=>p.slice(0,-1));}}>Отменить</button>
 <button type="button" disabled={!future.length} onClick={()=>{setPast(p=>[...p,scene]);setScene(future[0]);setFuture(f=>f.slice(1));}}>Повторить</button>
 <button type="button" className="map-primary" disabled={!title.trim()||(!dirty&&!!saved)} onClick={()=>void save()}>Сохранить карту</button><button type="button" onClick={()=>void download()}>Скачать PNG</button>
 <button type="button" disabled={dirty||!saved} title="Сначала сохрани ручную карту" onClick={()=>setAI(!ai)}>Оформить с AI</button></div></div>
 <div className="creative-layout"><aside className="creative-tools"><h3>Рисование</h3><div className="creative-palette">{([['select','Выбрать'],['erase','Ластик'],['room','Комната'],['wall','Стена'],['brush','Кисть'],['water','Вода']] as const).map(([v,label])=><button type="button" key={v} aria-pressed={tool===v} onClick={()=>setTool(v)}>{label}</button>)}</div>
 <label>Цвет рисования<input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><label>Толщина / размер<input type="range" min={8} max={160} value={size} onChange={e=>setSize(+e.target.value)}/></label>
 <h3>Декорации</h3><div className="creative-palette">{decorations.map(([v,label])=><button type="button" key={v} aria-pressed={tool===v} onClick={()=>setTool(v)}>{label}</button>)}</div>
 <label>Фон<input type="color" value={scene.background} onChange={e=>change({...scene,background:e.target.value})}/></label>
 <label><input type="checkbox" checked={scene.grid} onChange={e=>change({...scene,grid:e.target.checked})}/>Сетка 50 px</label><label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/>Привязка к сетке</label>
 {item&&<div className="creative-properties"><h3>Выбранный объект</h3>{!['brush','wall'].includes(item.kind)&&<>{(['w','h','rotation'] as const).map(key=><label key={key}>{key==='w'?'Ширина':key==='h'?'Высота':'Поворот'}<input type="range" min={key==='rotation'?-180:10} max={key==='rotation'?180:600} value={item[key]} onChange={e=>patch({[key]:+e.target.value})}/></label>)}</>}
 <button type="button" onClick={()=>change({...scene,items:scene.items.filter(i=>i.id!==selected)})}>Удалить объект</button><button type="button" onClick={()=>change({...scene,items:[...scene.items.filter(i=>i.id!==selected),item]})}>На передний план</button></div>}
 </aside><div className="creative-stage"><p>Протяни для комнаты, стены или штриха. Нажми для декорации. «Выбрать» — перенос объекта, «Ластик» — удаление целого объекта.</p><label>Масштаб · {zoom}%<input type="range" min={20} max={150} value={zoom} onChange={e=>setZoom(+e.target.value)}/></label>
 <div className="creative-scroll"><canvas ref={canvas} width={1600} height={1000} aria-label="Холст ручной карты" style={{width:1600*zoom/100,height:1000*zoom/100,touchAction:'none'}} onPointerDown={e=>{
 if(busy||e.button!==0)return;const p=point(e);canvas.current?.setPointerCapture(e.pointerId);
 const hit=[...scene.items].reverse().find(i=>{if(i.points)return i.points.some((q,index)=>{const a=i.points![Math.max(0,index-1)],dx=q[0]-a[0],dy=q[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(a[0]+t*dx-p[0],a[1]+t*dy-p[1])<i.w/2+12;});const angle=-i.rotation*Math.PI/180,dx=p[0]-i.x,dy=p[1]-i.y;return Math.abs(dx*Math.cos(angle)-dy*Math.sin(angle))<=i.w/2+8&&Math.abs(dx*Math.sin(angle)+dy*Math.cos(angle))<=i.h/2+8;});
 if(tool==='erase'){if(hit)change({...scene,items:scene.items.filter(i=>i.id!==hit.id)});return;}
 if(tool==='select'){setSelected(hit?.id||'');if(hit)gesture.current={before:scene,start:p,item:hit.id,move:true};return;}
 if(scene.items.length>=1000){setError('Не более 1000 объектов на холсте.');return;}
 const next:CreativeItem={id:crypto.randomUUID(),kind:tool,x:p[0],y:p[1],w:tool==='wall'?Math.min(size,30):size,h:size,rotation:0,color:tool==='water'?'#6096ae':color,...(['brush','wall'].includes(tool)?{points:[p,[Math.min(1600,p[0]+.01),p[1]]]}:{})};
 gesture.current={before:scene,start:p,item:next.id,move:false};setSelected(next.id);setScene({...scene,items:[...scene.items,next]});
 }} onPointerMove={e=>{const g=gesture.current;if(!g)return;const p=point(e);setScene({...latest.current,items:latest.current.items.map(i=>{
 if(i.id!==g.item)return i;
 if(g.move){const old=g.before.items.find(v=>v.id===i.id)!;const dx=p[0]-g.start[0],dy=p[1]-g.start[1];return {...i,x:Math.max(0,Math.min(1600,old.x+dx)),y:Math.max(0,Math.min(1000,old.y+dy)),...(old.points?{points:old.points.map(q=>[Math.max(0,Math.min(1600,q[0]+dx)),Math.max(0,Math.min(1000,q[1]+dy))])}:{})};}
 if(i.kind==='brush')return {...i,points:[...(i.points||[]).slice(0,4999),p]};
 if(i.kind==='wall')return {...i,points:[g.start,p]};
 if(i.kind==='room'||i.kind==='water')return {...i,x:(p[0]+g.start[0])/2,y:(p[1]+g.start[1])/2,w:Math.max(10,Math.abs(p[0]-g.start[0])),h:Math.max(10,Math.abs(p[1]-g.start[1]))};return i;
 })});}} onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)} onLostPointerCapture={()=>finish()}/></div><small>1600 × 1000 · {scene.items.length}/1000 объектов · прокрутка для перемещения по холсту</small></div></div>
 </fieldset>
 {ai&&saved&&!dirty&&<section className="world-map-ai-edit"><h3>Оформление ручной карты</h3><p>AI создаст отдельную карту по сохранённому эскизу. Проверь результат: расположение деталей может измениться.</p><label>Стиль<select aria-label="Стиль" value={style} onChange={e=>setStyle(e.target.value)}>{['Детализированная фэнтези battlemap','Чёрно-белый план подземелья','Акварель на пергаменте','Мрачная готика','Пиксельная карта'].map(s=><option key={s}>{s}</option>)}</select></label><MapCreateForm campaignId={campaignId} sourceMap={saved} storageKey={`creative:${saved.id}`} initialPrompt={`Оформи эскиз в стиле: ${style}. Вид строго сверху. Сохрани расположение и размеры комнат, стен, проходов, деревьев и мебели. Не добавляй надписи.`} onCreated={onVariant}/></section>}
 <p role="status">{busy?'Сохраняю…':notice||(dirty?'Есть несохранённые изменения':saved?'Ручная карта сохранена':'Нарисуй первую комнату или размести декорации.')}</p>{error&&<p role="alert">{error}</p>}
 </section>;
}
