import type {AssetPart,MapAsset} from './creative-assets';
export const assetCategories=['Растительность','Здания','Укрепления','Освещение','Мебель','Фурнитура','Хозяйство','Ландшафт','Декор и магия','Транспорт и лагерь'] as const;
const p=(d:string,fill='none',width=.8,stroke='#49483c'):AssetPart=>({d,fill,width,stroke});
const box=(x:number,y:number,w:number,h:number,fill:string)=>p(`M${x} ${y}h${w}v${h}h-${w}Z`,fill);
const disk=(x:number,y:number,r:number,fill:string)=>p(`M${x-r} ${y}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 -${r*2} 0`,fill);
const line=(d:string,stroke='#716753',width=.65)=>p(d,'none',width,stroke);
const rnd=(seed:number)=>{let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};};
export function shade(hex:string,amount:number){return '#'+[1,3,5].map(i=>Math.max(0,Math.min(255,parseInt(hex.slice(i,i+2),16)+amount)).toString(16).padStart(2,'0')).join('');}
function crown(seed:number,base:string,pine=false,flowers=false):AssetPart[]{
 const r=rnd(seed),parts:AssetPart[]=[];
 if(pine){
  for(let ring=0;ring<4;ring++){const radius=42-ring*8;let d='';for(let i=0;i<40;i++){const a=i*Math.PI/20,rad=radius*(i%2?.6:1)*(1-r()*.12);d+=`${i?'L':'M'}${50+Math.cos(a)*rad} ${50+Math.sin(a)*rad}`;}parts.push(p(d+'Z',shade(base,ring*6)));}
  for(let i=0;i<12;i++){const a=i*Math.PI/6;parts.push(line(`M50 50L${50+Math.cos(a)*30} ${50+Math.sin(a)*30}`,shade(base,32),.6));}
 }else{
  for(let i=0;i<17;i++){const a=i*2.4,rr=i<3?5:18+r()*10,cx=50+Math.cos(a)*rr,cy=50+Math.sin(a)*rr,rad=12+r()*8;parts.push(disk(cx,cy,rad,shade(base,Math.round(r()*22-11))));}
  for(let i=0;i<110;i++){const a=r()*Math.PI*2,rad=Math.sqrt(r())*35,x=50+Math.cos(a)*rad,y=50+Math.sin(a)*rad;parts.push(p(`M${x} ${y}q-4 -5 2 -6q5 2 -2 6Z`,shade(base,Math.round(18+r()*16)),.3,shade(base,-18)));}
  if(flowers)for(let i=0;i<24;i++){const a=r()*Math.PI*2,rad=r()*30;parts.push(disk(50+Math.cos(a)*rad,50+Math.sin(a)*rad,1.5,'#e8b8bd'));}
 }
 return parts;
}
function roof(seed:number,color:string,shape='gable'):AssetPart[]{
 const r=rnd(seed),a:AssetPart[]=[box(8,10,84,80,'#b9ae91'),box(5,6,90,86,shade(color,-22))];
 if(shape==='round'){
  const parts=[disk(50,50,44,'#9a9686'),disk(50,50,39,color)];
  for(let ring=1;ring<7;ring++){const radius=ring*5.3;parts.push({...disk(50,50,radius,'none'),stroke:shade(color,-24),width:.65});for(let j=0;j<ring*5;j++){const t=j*Math.PI*2/(ring*5);parts.push(line(`M${50+Math.cos(t)*(radius-4)} ${50+Math.sin(t)*(radius-4)}L${50+Math.cos(t)*radius} ${50+Math.sin(t)*radius}`,shade(color,-18)));}}
  parts.push(disk(50,50,4,'#d1ba85'));return parts;
 }
 a.push(p('M8 9H50V89H8Z',shade(color,14)),p('M50 9H92V89H50Z',shade(color,-10)));
 for(let y=13;y<88;y+=6){a.push(line(`M9 ${y}H91`,shade(color,-25),.65));for(let x=12+(Math.round(y/6)%2)*4;x<90;x+=8){a.push(line(`M${x} ${y}v${5+r()}`,shade(color,-16),.55));}}
 a.push(box(47,8,6,82,shade(color,27)));
 for(let y=10;y<88;y+=7)a.push(line(`M47 ${y}H53`,shade(color,-18),.7));
 a.push(box(67,17,12,15,'#aaa58e'),box(70,20,6,8,'#393d3b'));
 if(shape==='dormer'){a.push(box(18,35,20,25,'#ac9b79'),p('M15 38L28 27L41 38Z',shade(color,20)),box(22,41,12,13,'#667a7d'),line('M28 41V54 M22 48H34','#d6c59e',1));}
 if(shape==='cross'){a.push(box(12,42,76,20,color),p('M12 52H88V62H12Z',shade(color,-22)));for(let x=14;x<88;x+=6)a.push(line(`M${x} 43V61`,shade(color,-30)));a.push(line('M12 51H88',shade(color,38),2));}
 if(shape==='ruin'){a.splice(3,1,p('M50 9H92V36L80 42L87 57L72 52L66 70L50 65Z',shade(color,-10)));a.push(p('M58 68L70 75L66 86L52 80Z','#a5a18d'),p('M76 61L88 72L81 83L70 72Z','#999582'));}
 return a;
}
function lamp(kind:string,color='#edbf64'):AssetPart[]{
 const a:AssetPart[]=[disk(50,50,21,'#625e52'),disk(50,50,16,'#b09a6b')];
 if(kind==='brazier'){a.push(disk(50,50,14,'#593b2e'));for(let i=0;i<8;i++){const t=i*Math.PI/4;a.push(p(`M50 50Q${50+Math.cos(t)*25} ${50+Math.sin(t)*25} ${50+Math.cos(t+.5)*8} ${50+Math.sin(t+.5)*8}Z`,i%2?color:'#e38b47'));}}
 else if(kind==='crystal'){a.push(p('M50 14L67 41L59 75L40 75L33 41Z',color),p('M50 14L49 75L40 75L33 41Z',shade(color,-28)),line('M50 14L59 41L49 75',shade(color,40)));}
 else {a.push(box(37,34,26,32,color),line('M37 34L63 66 M63 34L37 66','#534d42',2),p('M34 34L50 23L66 34Z','#665b49'),p('M34 66L50 77L66 66Z','#665b49'),disk(50,50,5,'#fff0b1'));if(kind==='post')a.unshift(box(46,6,8,88,'#625c49'));}
 return a;
}
function bareTree(seed:number):AssetPart[]{
 const r=rnd(seed+56),parts:AssetPart[]=[disk(50,50,6,'#75644b')];
 for(let i=0;i<8;i++){const a=i*Math.PI/4+r()*.3,x=50+Math.cos(a)*24,y=50+Math.sin(a)*24,ex=50+Math.cos(a+.2)*44,ey=50+Math.sin(a+.2)*44;parts.push(line(`M50 50Q${x} ${y} ${ex} ${ey}`,'#6f624e',3),line(`M${x} ${y}l${Math.cos(a-.7)*15} ${Math.sin(a-.7)*15}`,'#81735c',1.8),line(`M${ex} ${ey}l${Math.cos(a+.9)*6} ${Math.sin(a+.9)*6}`,'#8d7b60',1));}return parts;
}
export function expandAssets(assets:MapAsset[]){
 // Stable IDs keep previously saved props editable; classification is by function.
 const mapping:Record<string,string>={'Природа':'Растительность','Мебель':'Мебель','Подземелье':'Фурнитура','Таверна':'Хозяйство','Лагерь':'Транспорт и лагерь','Храм':'Декор и магия','Город':'Хозяйство'};
 for(const a of assets){a.category=mapping[a.category] as MapAsset['category'];if(['rock','rocks','pit'].includes(a.id))a.category='Ландшафт';if(['fire','candles','hearth'].includes(a.id))a.category='Освещение';if(['fence','portcullis','pillar','stairs','spiral-stairs'].includes(a.id))a.category='Укрепления';a.parts=a.parts.map(part=>({...part,width:Math.min(part.width||1.2,1.2),stroke:part.stroke||'#514b3e'}));}
 const add=(id:string,name:string,category:MapAsset['category'],parts:AssetPart[],w=85,h=w)=>assets.push({id,name,category,parts,w,h});
 const replace=(id:string,parts:AssetPart[])=>{const a=assets.find(a=>a.id===id);if(a)a.parts=parts;};
 replace('tree',crown(41,'#536e3d'));replace('pine',crown(12,'#395a4c',true));replace('bush',crown(81,'#667b43'));
 const trees=[['oak','Дуб раскидистый','#607c43'],['birch','Берёза','#82904f'],['willow','Ива','#6a8757'],['maple','Клён осенний','#ae7043'],['cherry','Цветущая вишня','#bd8998'],['deadwood','Сухое дерево','#807968'],['jungle','Тропическое дерево','#387657'],['golden','Золотистое дерево','#b09a49']] as const;
 trees.forEach(([id,name,c],i)=>{for(let v=0;v<3;v++)add(`${id}-${v+1}`,`${name} · ${['молодое','зрелое','старое'][v]}`,'Растительность',id==='deadwood'?bareTree(v):crown(i*37+v*19,c,false,id==='cherry'),75+v*25);});
 for(let v=0;v<5;v++)add(`conifer-${v+1}`,`Хвойное дерево · ${v+1}`,'Растительность',crown(100+v,'#3d6654',true),70+v*8);
 for(let v=0;v<4;v++)add(`shrub-${v+1}`,['Куст цветущий','Куст ягодный','Куст сухой','Живая изгородь'][v],'Растительность',crown(300+v,['#799051','#6c754a','#928867','#527245'][v],false,v<2),45+v*5,v===3?90:45);
 add('palm','Пальма','Растительность',Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9;return p(`M50 50Q${50+Math.cos(a-.3)*38} ${50+Math.sin(a-.3)*38} ${50+Math.cos(a)*46} ${50+Math.sin(a)*46}Q${50+Math.cos(a+.35)*25} ${50+Math.sin(a+.35)*25} 50 50Z`,'#62814d');}),90);
 add('reeds','Камыш','Растительность',Array.from({length:16},(_,i)=>{const r=rnd(i+1),x=15+r()*70;return p(`M${x} 80Q${x-15} 45 ${x+5} ${10+r()*30}L${x+2} 82Z`,i%2?'#8b965f':'#667d4b');}),65,70);
 for(let v=0;v<3;v++){const r=rnd(v+4);add(`flowers-${v+1}`,['Полевые цветы','Лаванда','Красные цветы'][v],'Растительность',Array.from({length:35},()=>{const x=15+r()*70,y=15+r()*70;return disk(x,y,2+r()*2,['#ddd5b7','#9a87ba','#ba685c'][v]);}),65);}
 const houses=[['cottage','Коттедж','#9a6a48','dormer',120,110],['townhouse','Городской дом','#a56b52','gable',110,160],['slate-house','Дом со сланцевой крышей','#63717d','dormer',130,120],['thatch-house','Сельская хижина','#aa945b','gable',115,100],['warehouse','Склад','#847d69','gable',180,120],['tavern-roof','Таверна','#875d49','cross',175,150],['temple-roof','Храм','#718889','cross',150,220],['barn','Амбар','#976d48','gable',170,120],['stable','Конюшня','#9b7b59','gable',190,100],['manor','Усадьба','#57787b','cross',220,170],['ruined-house','Разрушенный дом','#8a7568','ruin',130,120],['smithy','Кузница','#696e6f','dormer',130,110]] as const;
 houses.forEach(([id,name,color,shape,w,h],i)=>{add(id,name,'Здания',roof(i+20,color,shape),w,h);add(`${id}-long`,`${name} · флигель`,'Здания',[...roof(i+50,shade(color,8),shape),box(2,58,28,34,'#c2ae84'),p('M0 58L16 49L32 58V89H0Z',shade(color,-6)),line('M16 50V89',shade(color,25),2)],w+30,h);});
 add('round-hut','Круглая хижина','Здания',roof(22,'#a6915d','round'),100);
 add('watchtower-roof','Сторожевая башня','Здания',roof(25,'#627c80','round'),105);
 add('windmill','Ветряная мельница','Здания',[...roof(42,'#917458','round'),box(47,2,6,96,'#b5a17a'),box(2,47,96,6,'#b5a17a'),...Array.from({length:12},(_,i)=>line(`M${12+i*6} 43V57 M43 ${12+i*6}H57`,'#665e4d'))],150);
 add('watermill','Водяная мельница','Здания',[...roof(65,'#8a6651','gable'),box(2,25,14,50,'#644b37'),...Array.from({length:8},(_,i)=>line(`M1 ${28+i*6}H17`,'#c2a276',2))],155,130);
 for(let v=0;v<4;v++){const c=['#b78a70','#769395','#818b5a','#b99a56'][v];add(`market-${v+1}`,`Торговый шатёр · ${['красный','синий','зелёный','песочный'][v]}`,'Здания',[box(8,12,84,78,'#735a3e'),...Array.from({length:7},(_,i)=>box(8+i*12,10,12,72,i%2?c:'#e2d4b3')),box(12,83,76,10,'#aa8555'),...Array.from({length:7},(_,i)=>disk(18+i*10,87,3,['#b28855','#719052','#9b5645'][i%3]))],105,85);}
 for(const [id,name,kind,c] of [['lantern','Фонарь','lantern','#e6bd6b'],['streetlamp','Уличный фонарь','post','#e8bf71'],['brazier','Жаровня','brazier','#edc16b'],['torch','Факел','post','#e39f51'],['crystal-blue','Синий кристалл','crystal','#83c1d5'],['crystal-purple','Фиолетовый кристалл','crystal','#ab8dbd'],['lamp-green','Магический светильник','lantern','#a4c582'],['beacon','Сигнальный огонь','brazier','#e59a58']] as const)add(id,name,'Освещение',lamp(kind,c),id==='beacon'?75:40);
 add('candelabra','Канделябр','Освещение',[box(20,44,60,12,'#ad925c'),...Array.from({length:5},(_,i)=>disk(23+i*14,50,6,'#ebd99f'))],60,30);
 add('hanging-lamp','Подвесной фонарь','Освещение',[...lamp('lantern'),line('M50 2V23 M50 77V98','#5d594d',2)],35,60);
 for(let v=0;v<4;v++){const r=rnd(v+90),parts:AssetPart[]=[];for(let i=0;i<8+v*3;i++){const x=15+r()*70,y=15+r()*70;parts.push(p(`M${x-7} ${y}l5 -8l12 3l4 9l-12 5Z`,['#93958a','#b5ad95','#757e80','#a69c89'][v]),line(`M${x-2} ${y-7}l1 8l9 4`,'#676b60'));}add(`boulders-${v+1}`,`Валуны · ${['гранит','песчаник','сланец','известняк'][v]}`,'Ландшафт',parts,100+v*10);}
 add('cliff','Скальный уступ','Ландшафт',[p('M5 12L25 6L43 17L65 7L94 15V85L73 92L56 80L34 93L5 83Z','#999783'),...Array.from({length:12},(_,i)=>line(`M${8+i*7} 18q-8 25 0 60`,'#5f685d',1.5))],180,65);
 add('pond-stones','Каменная заводь','Ландшафт',[p('M10 25Q45 -5 80 20Q110 60 75 87Q20 103 8 66Z','#8a9275'),p('M17 29Q46 5 76 26Q98 61 69 79Q25 91 16 61Z','#5f9aa6'),line('M27 38Q45 24 64 34 M34 68Q50 77 68 63','#b1c8bb',1)],160,115);
 for(let v=0;v<4;v++){const color=['#8b7654','#6a824a','#a69a5b','#8a896a'][v];add(`field-${v+1}`,['Вспаханное поле','Огород','Пшеничное поле','Виноградник'][v],'Хозяйство',[box(3,3,94,94,'#927d58'),...Array.from({length:9},(_,i)=>box(8+i*10,6,5,88,color)),...Array.from({length:56},(_,i)=>disk(10+(i%8)*11,12+Math.floor(i/8)*12,v===0?.6:1.7,v===2?'#d0b36e':'#536b39'))],170,125);}
 add('haystack','Стог сена','Хозяйство',[disk(50,50,40,'#b39b5b'),...Array.from({length:22},(_,i)=>{const a=i*Math.PI/11;return line(`M50 50L${50+Math.cos(a)*38} ${50+Math.sin(a)*38}`,'#e1c681',1);})],85);
 add('woodpile','Поленница','Хозяйство',Array.from({length:20},(_,i)=>disk(18+(i%5)*16,25+Math.floor(i/5)*16,7,i%2?'#ba9d6b':'#987d52')),75,65);
 add('forge','Горн','Хозяйство',[box(10,10,80,80,'#777c72'),box(20,20,60,60,'#343c3b'),...lamp('brazier')],75);
 add('oven','Печь','Хозяйство',[disk(50,45,38,'#ab9475'),box(27,57,46,35,'#99856a'),box(36,65,28,27,'#3d4038'),...Array.from({length:7},(_,i)=>line(`M${25+i*8} 20V55`,'#75664f'))],70,85);
 add('well-roof','Колодец с крышей','Хозяйство',[disk(50,50,32,'#aaa48c'),disk(50,50,20,'#354f51'),box(8,22,10,56,'#98774e'),box(82,22,10,56,'#98774e'),...roof(9,'#997956','gable').map(part=>({...part,d:part.d}))],75);
 for(let v=0;v<3;v++){const c=['#8e9389','#ab9d83','#677873'][v];add(`stone-wall-${v+1}`,`Каменная стена · ${v+1}`,'Укрепления',[box(2,28,96,44,shade(c,-20)),...Array.from({length:24},(_,i)=>box(3+(i%8)*12+(Math.floor(i/8)%2?2:0),30+Math.floor(i/8)*13,10,11,shade(c,(i%3)*6)))],160,45);}
 add('palisade','Частокол','Укрепления',[box(5,35,90,30,'#73583a'),...Array.from({length:12},(_,i)=>p(`M${5+i*8} 27l3 -8l4 8v49h-7Z`,i%2?'#a2875b':'#b09a6d'))],160,35);
 add('city-gate','Городские ворота','Укрепления',[box(2,10,25,80,'#9b9b8b'),box(73,10,25,80,'#9b9b8b'),box(27,38,46,24,'#826442'),...Array.from({length:6},(_,i)=>line(`M${30+i*7} 39V61`,'#c6ac79')),line('M5 26H24 M5 44H24 M5 63H24 M76 26H94 M76 44H94 M76 63H94','#626a62',2)],160,90);
 add('battlement','Крепостная башня','Укрепления',[disk(50,50,42,'#9ba18f'),disk(50,50,28,'#727c70'),...Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return box(44+Math.cos(a)*36,44+Math.sin(a)*36,12,12,'#b5b5a0');})],110);
 for(let v=0;v<3;v++)add(`door-${v+1}`,['Железная дверь','Арочная дверь','Люк'][v],'Фурнитура',[box(8,28,84,44,['#777f7c','#a18b65','#8b7551'][v]),...Array.from({length:8},(_,i)=>line(`M${12+i*10} 32V68`,'#4f584e')),box(12,38,76,5,'#aaa58e'),box(12,57,76,5,'#aaa58e'),disk(75,50,3,'#dbc28b')],65,v===2?65:30);
 add('window','Окно','Фурнитура',[box(10,20,80,60,'#9e8c6a'),box(18,28,64,44,'#8aa5a5'),line('M50 28V72 M18 50H82','#d5c5a2',4)],55,25);
 add('hatch','Решётчатый люк','Фурнитура',[box(8,8,84,84,'#67766b'),...Array.from({length:7},(_,i)=>line(`M${18+i*10} 12V88 M12 ${18+i*10}H88`,'#b1b8a5',2))],70);
 for(let v=0;v<3;v++){const c=['#9f7955','#7d6754','#ad9370'][v];add(`dining-${v+1}`,`Обеденный стол · ${v+1}`,'Мебель',[box(10,20,80,60,c),...Array.from({length:8},(_,i)=>line(`M${15+i*10} 22V78`,'#5f503e')),...[28,50,72].flatMap(x=>[disk(x,35,9,'#ded6bd'),disk(x,65,9,'#ded6bd')]),box(44,43,12,14,'#9a654b')],100+v*20,60+v*10);}
 add('workbench','Верстак','Мебель',[box(5,18,90,64,'#a68a5e'),line('M8 38H92 M8 58H92','#675e48'),box(15,27,22,27,'#9a9b85'),line('M50 28L75 65','#5d6258',4),disk(70,36,9,'#727e74')],110,65);
 add('round-rug','Круглый ковёр','Мебель',[disk(50,50,44,'#996e61'),disk(50,50,36,'#cebb95'),disk(50,50,29,'#8a7065'),...Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return disk(50+Math.cos(a)*34,50+Math.sin(a)*34,2,'#a5745c');})],100);
 add('tomb','Гробница','Декор и магия',[box(15,5,70,90,'#9e9f8c'),box(23,13,54,74,'#bebba4'),line('M50 25V73 M34 40H66','#858978',3)],65,100);
 add('obelisk','Обелиск','Декор и магия',[box(12,12,76,76,'#9d9f8b'),p('M50 15L78 50L50 85L22 50Z','#b9baa4'),p('M50 15V85L22 50Z','#858e7d'),line('M46 40V65 M43 50H49','#5f6a61')],65);
 add('rune-circle','Рунический круг','Декор и магия',[disk(50,50,44,'#aaa895'),disk(50,50,36,'#c6c1a7'),...Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return line(`M${50+Math.cos(a)*30} ${50+Math.sin(a)*30}l3 -5l3 5`,'#667e80',1.5);}),disk(50,50,18,'#8daca9')],105);
 add('wagon-covered','Крытая повозка','Транспорт и лагерь',[box(12,20,76,60,'#755c3f'),box(18,16,64,68,'#d5c7a3'),...Array.from({length:6},(_,i)=>line(`M20 ${22+i*11}H80`,'#aa9c7c',1)),box(4,20,10,20,'#5b5a47'),box(86,20,10,20,'#5b5a47'),box(4,60,10,20,'#5b5a47'),box(86,60,10,20,'#5b5a47')],100,140);
 add('pier','Причал','Транспорт и лагерь',[box(15,2,70,96,'#947852'),...Array.from({length:12},(_,i)=>line(`M15 ${6+i*8}H85`,'#544f3e')),disk(15,10,6,'#b19d73'),disk(85,10,6,'#b19d73'),disk(15,90,6,'#b19d73'),disk(85,90,6,'#b19d73')],80,170);
 add('large-tent','Шатёр','Транспорт и лагерь',[p('M50 3L97 50L50 97L3 50Z','#b9b28b'),p('M50 3V97L3 50Z','#d2c8a4'),line('M3 50H97 M50 3V97','#7b7760',2),disk(50,50,4,'#796e4d')],140);
 assets.sort((a,b)=>(assetCategories as readonly string[]).indexOf(a.category)-(assetCategories as readonly string[]).indexOf(b.category)||a.name.localeCompare(b.name,'ru'));
}
