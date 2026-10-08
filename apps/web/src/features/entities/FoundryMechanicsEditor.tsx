import type { FoundryMechanics, StatBlockEntry } from "@shadow-edge/shared-types";

export function FoundryMechanicsEditor({entry,onChange}:{entry:StatBlockEntry;onChange:(patch:Partial<StatBlockEntry>)=>void}) {
  const profile=entry.foundry;
  const update=(patch:Partial<FoundryMechanics>)=>onChange({foundry:{kind:profile?.kind??"attack",...profile,...patch}});
  return <details className="field field-full"><summary>Расчёт способности в Foundry</summary>
    <label className="field"><span>Тип расчёта</span><select className="input" value={profile?.kind??"auto"} onChange={e=>e.target.value==="auto"?onChange({foundry:undefined}):update({kind:e.target.value as FoundryMechanics["kind"]})}>
      <option value="auto">По численным полям статблока</option><option value="attack">Атака</option><option value="save">Спасбросок</option><option value="heal">Лечение</option><option value="damage">Урон без атаки</option><option value="manual">Ручной расчёт</option>
    </select></label>
    {profile&&profile.kind!=="manual"?<div className="form-grid">
      <label className="field"><span>Активация</span><select className="input" value={profile.activation??""} onChange={e=>update({activation:(e.target.value||undefined) as FoundryMechanics["activation"]})}><option value="">По секции статблока</option><option value="action">Действие</option><option value="bonus">Бонусное действие</option><option value="reaction">Реакция</option></select></label>
      <label className="field"><span>Дальность, футы</span><input className="input" type="number" min={0} max={10000} value={profile.range??""} onChange={e=>update({range:e.target.value===""?undefined:Number(e.target.value)})}/></label>
      {profile.kind==="attack"?<label className="field"><span>Вид атаки</span><select className="input" value={profile.attackMode??"melee"} onChange={e=>update({attackMode:e.target.value as FoundryMechanics["attackMode"]})}><option value="melee">Ближняя</option><option value="ranged">Дальняя</option></select></label>:null}
      {profile.kind==="save"?<>
        <label className="field"><span>Характеристика спасброска</span><select className="input" value={profile.saveAbility??""} onChange={e=>update({saveAbility:(e.target.value||undefined) as FoundryMechanics["saveAbility"]})}><option value="">Выберите</option>{Object.entries({str:"Сила",dex:"Ловкость",con:"Телосложение",int:"Интеллект",wis:"Мудрость",cha:"Харизма"}).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
        <label className="field"><span>Численная СЛ</span><input className="input" type="number" min={1} max={100} value={profile.saveDc??""} onChange={e=>{const dc=e.target.value===""?undefined:Number(e.target.value);onChange({foundry:{...profile,saveDc:dc},saveDc:dc?String(dc):""})}}/></label>
        <label className="field"><span>При успешном спасброске</span><select className="input" value={profile.saveDamage??"none"} onChange={e=>update({saveDamage:e.target.value as FoundryMechanics["saveDamage"]})}><option value="none">Без урона</option><option value="half">Половина урона</option></select></label>
      </>:null}
      {profile.kind!=="heal"?<label className="field"><span>Тип урона</span><select className="input" value={profile.damageType??""} onChange={e=>update({damageType:e.target.value||undefined})}><option value="">Из поля «Урон»</option>{Object.entries({acid:"Кислота",bludgeoning:"Дробящий",cold:"Холод",fire:"Огонь",force:"Силовой",lightning:"Электричество",necrotic:"Некротический",piercing:"Колющий",poison:"Яд",psychic:"Психический",radiant:"Излучение",slashing:"Рубящий",thunder:"Звук"}).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>:null}
    </div>:null}
    <p className="copy">Используются поля «Попадание» и «Урон» выше. Для лечения в поле «Урон» укажите формулу лечения, например 1d8+3. Сложные условия, эффекты и расход ресурсов требуют отдельной настройки.</p>
  </details>;
}
