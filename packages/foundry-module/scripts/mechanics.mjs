import {damageFormula,damageType,attackBonus} from "./core.mjs";
import {inferAttackMode} from './presentation.mjs';
const kinds=new Set(["attack","save","heal","damage"]),types=new Set(["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"]);
export function abilityActivity(v,index=0){
  const m=v.foundry??v.mechanics,kind=m?.kind??"attack",formula=damageFormula(v.damage),bonus=attackBonus(v.toHit??v.attackBonus);
  const type=m?.damageType||v.damageType||damageType(v.damage);
  // Do not silently keep only the first term of multi-part or special damage.
  const dice=String(v.damage??"").replace(/к/gi,"d").match(/\d+d\d+/gi)??[];
  if(!kinds.has(kind)||!formula||dice.length>1||/[@*/]/.test(String(v.damage??""))||kind!=="heal"&&!types.has(type)||kind==="attack"&&bonus===null)return null;
  if(m?.range!==undefined&&(!Number.isInteger(m.range)||m.range<0||m.range>10000))return null;
  if(kind==="save"&&(!["str","dex","con","int","wis","cha"].includes(m?.saveAbility??v.saveAbility)||!Number.isInteger(m?.saveDc??v.saveDc)||(m?.saveDc??v.saveDc)<1||(m?.saveDc??v.saveDc)>100))return null;
  const id=`segmact${String(index).padStart(9,"0")}`,part={custom:{enabled:true,formula},types:[kind==="heal"?"healing":type]};
  const a={_id:id,type:kind,target:{affects:{type:"creature",count:"1"}},activation:{type:["action","bonus","reaction"].includes(m?.activation)?m.activation:"action",value:1},consumption:{spellSlot:false,targets:[]}};
  if((m?.range??v.range)!==undefined)a.range={override:true,value:m?.range??v.range,units:"ft"};
  if(kind==="attack")a.attack={flat:true,bonus:String(bonus),type:{value:inferAttackMode(v),classification:v.type==="spell"?"spell":"weapon"}};
  if(kind==="save")a.save={ability:[m?.saveAbility??v.saveAbility],dc:{calculation:"",formula:String(m?.saveDc??v.saveDc)}};
  if(kind==="heal")a.healing=part;else a.damage={includeBase:false,parts:[part],...(kind==="save"?{onSave:m?.saveDamage==="half"?"half":"none"}:{})};
  return a;
}
