import {CardAppearance} from "./CardAppearance";
import type {EntityEditorController} from "./useEntityEditorController";

export function QuestAppearanceEditor({controller}:{controller:EntityEditorController}) {
 const value=controller.entityForm.questAppearance??{};
 const change=(patch:Partial<typeof value>)=>controller.updateEntityForm(current=>({...current,questAppearance:{...current.questAppearance,...patch}}));
 return <section data-editor-section="appearance" className="field-full quest-appearance-editor">
  <p className="copy">Цвета и плотность обзора и сценария сохраняются вместе с квестом и доступны на других устройствах. Награды и зачитки могут иметь своё оформление.</p>
  <CardAppearance textColor={value.textColor} backgroundColor={value.backgroundColor} onChange={change}/>
  <div className="form-grid">
   <label className="field"><span>Цвет акцента</span><input className="input" type="color" value={value.accentColor||"#b4a5ed"} onChange={event=>change({accentColor:event.target.value})}/></label>
   <label className="field"><span>Плотность блоков</span><select className="input" value={value.density||"comfortable"} onChange={event=>change({density:event.target.value as "comfortable"|"compact"})}><option value="comfortable">Свободно</option><option value="compact">Компактно</option></select></label>
  </div>
  <article className="quest-appearance-sample" style={{color:value.textColor,backgroundColor:value.backgroundColor,borderLeftColor:value.accentColor}}><strong>Название эпизода</strong><p>Описание сцены и заметки мастера будут выглядеть так.</p></article>
  <button type="button" className="ghost" onClick={()=>controller.updateEntityForm(current=>({...current,questAppearance:{}}))}>Вернуть оформление приложения</button>
 </section>;
}
