import {damageFormula,damageType,attackBonus} from "./core.mjs";
import {inferAttackMode} from './presentation.mjs';
const kinds=new Set(["attack","save","heal","damage"]),types=new Set(["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"]);
function inferredSave(v){
  if(attackBonus(v.toHit??v.attackBonus)!==null)return null;
  const text=String(v.description??''),match=text.match(/спасбросок\s+(Силы|Ловкости|Телосложения|Интеллекта|Мудрости|Харизмы)\s+Сл\s*(\d+)/iu);
  if(!match)return null;
  const abilities={силы:'str',ловкости:'dex',телосложения:'con',интеллекта:'int',мудрости:'wis',харизмы:'cha'},range=text.match(/в пределах\s+(\d+)\s*фут/iu),sphere=text.match(/сфер[а-яё]*\s+радиусом\s+(\d+)\s*фут/iu);
  return {kind:'save',saveAbility:abilities[match[1].toLowerCase()],saveDc:Number(match[2]),saveDamage:/половин[а-яё]*\s+(?:этого\s+)?урон[а-яё]*\s+при\s+успеш/iu.test(text)?'half':'none',...(range?{range:Number(range[1])}:{}),...(sphere?{radius:Number(sphere[1])}:{})};
}
function damageParts(raw,kind,explicitType){
  const text=String(raw??'').replace(/(\d)к(?=\d)/gi,'$1d');if(/[@*/]|если|спасброс|при\s+(?:провал|успеш)|\bif\b|\bsave\b/iu.test(text))return null;
  const chunks=text.split(/\s+(?:плюс|plus)\s+|\s+(?:и|and)\s+(?=\d+\s*\()/iu),parts=[];
  for(const chunk of chunks){const formula=damageFormula(chunk),dice=chunk.match(/\d+d\d+/gi)??[],type=damageType(chunk)||explicitType;if(!formula||dice.length>1||kind!=='heal'&&!types.has(type))return null;parts.push({custom:{enabled:true,formula},types:[kind==='heal'?'healing':type]})}
  return parts;
}
export function abilityActivity(v,index=0){
  const inferred=v.foundry||v.mechanics?null:inferredSave(v),m=v.foundry??v.mechanics??inferred,kind=m?.kind??"attack",bonus=attackBonus(v.toHit??v.attackBonus);
  // A source damage summary can truncate later types. Only an explicit save sentence supplies a fallback.
  const fullDamage=inferred&&String(v.description??'').match(/получая\s+(.+?)\s+(?:при\s+провал|или\s+половин)/iu)?.[1];
  const noDamage=kind==='save'&&!String(fullDamage??v.damage??'').trim(),parts=noDamage?[]:damageParts(fullDamage??v.damage,kind,m?.damageType||v.damageType);
  if(!kinds.has(kind)||!noDamage&&!parts?.length||kind==='heal'&&parts.length!==1||kind==="attack"&&bonus===null)return null;
  if(m?.range!==undefined&&(!Number.isInteger(m.range)||m.range<0||m.range>10000))return null;
  if(kind==="save"&&(!["str","dex","con","int","wis","cha"].includes(m?.saveAbility??v.saveAbility)||!Number.isInteger(m?.saveDc??v.saveDc)||(m?.saveDc??v.saveDc)<1||(m?.saveDc??v.saveDc)>100))return null;
  const id=`segmact${String(index).padStart(9,"0")}`,part=parts[0];
  const a={_id:id,type:kind,target:{affects:{type:"creature",count:"1"}},activation:{type:["action","bonus","reaction"].includes(m?.activation)?m.activation:"action",value:1},consumption:{spellSlot:false,targets:[]}};
  if((m?.range??v.range)!==undefined)a.range={override:true,value:m?.range??v.range,units:"ft"};
  if(m?.radius)a.target={affects:{type:'creature',count:''},template:{type:'circle',size:m.radius,units:'ft'},prompt:true};
  if(kind==="attack")a.attack={flat:true,bonus:String(bonus),type:{value:inferAttackMode(v),classification:v.type==="spell"?"spell":"weapon"}};
  if(kind==="save")a.save={ability:[m?.saveAbility??v.saveAbility],dc:{calculation:"",formula:String(m?.saveDc??v.saveDc)}};
  if(kind==="heal")a.healing=part;else a.damage={includeBase:false,parts,...(kind==="save"?{onSave:m?.saveDamage==="half"?"half":"none"}:{})};
  return a;
}
