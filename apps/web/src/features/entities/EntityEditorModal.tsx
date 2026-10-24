import { useLayoutEffect } from "react";
import { DeviceDraftControls } from "../../app/DeviceDraftControls";
import type { CampaignData } from "@shadow-edge/shared-types";
import { DndGenerationProgress } from "../../auth-ui";
import type { EntityTextField } from "./entity.types";
import { EntityEditorForm } from "./EntityEditorForm";
import { useNativeDialog } from "../../app/hooks/useNativeDialog";
import type { EntityEditorController } from "./useEntityEditorController";

type EntityEditorModalProps = {
  section?:string;
  campaign: CampaignData | null;
  controller: EntityEditorController;
  entityGenerationSteps: string[];
  error: string;
  generating: boolean;
  onClose: () => void;
  onContentContextMenu: (field: EntityTextField, event: React.MouseEvent<HTMLTextAreaElement>) => void;
  saving: boolean;
};

export function EntityEditorModal({
  section,
  campaign,
  controller,
  entityGenerationSteps,
  error,
  generating,
  onClose,
  onContentContextMenu,
  saving
}: EntityEditorModalProps) {
  const {
    deleteEntity,
    draftNotes,
    draftPrompt,
    entityFormImageUploading,
    entityModalOpen,
    entitySubmitLabel,
    generateDraft,
    isEditingEntity,
    setDraftPrompt,
    submitEntity
  } = controller;

  const dialogRef = useNativeDialog(entityModalOpen);
  // Keep focused controls clear of the fixed footer, including very short windows.
  function focusEditorTarget(target:Element,focus:HTMLElement=target as HTMLElement){
    target.scrollIntoView({block:"start",inline:"nearest",behavior:"instant"});focus.focus({preventScroll:true});
    const body=dialogRef.current?.querySelector<HTMLElement>(".entity-editor-body");if(!body||!body.contains(focus))return;
    const field=focus.getBoundingClientRect(),area=body.getBoundingClientRect();
    if(field.height<=body.clientHeight){const margin=Math.max(0,Math.min(8,(body.clientHeight-field.height)/2));body.scrollTo({top:body.scrollTop+field.top-area.top-margin,behavior:"instant"});}
  }

  useLayoutEffect(()=>{if(!entityModalOpen||!section)return;const frame=requestAnimationFrame(()=>{const target=dialogRef.current?.querySelector<HTMLElement>(`[data-editor-section="${section}"]`);if(!target)return;let parent=target.parentElement;while(parent&&parent!==dialogRef.current){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement;}const input=target.matches("input,textarea,select")?target:target.querySelector<HTMLElement>("input,textarea,select,button");focusEditorTarget(input?.closest("label,.field")||input||target,input||target);});return()=>cancelAnimationFrame(frame);},[entityModalOpen,section]);
  useLayoutEffect(()=>{if(!entityModalOpen||(!error&&!controller.conflict))return;const frame=requestAnimationFrame(()=>{const notice=dialogRef.current?.querySelector<HTMLElement>(controller.conflict?'[aria-label="Сравнение версий"]':'.form-error');if(notice)focusEditorTarget(notice);});return()=>cancelAnimationFrame(frame);},[entityModalOpen,error,controller.conflict]);
  const saveBlocker=controller.deviceDraft.candidate?{text:"Есть черновик на этом устройстве",action:"Выбрать версию",selector:".device-draft-controls.has-recovery"}:controller.conflict?{text:"Запись изменилась на сервере",action:"Сравнить версии",selector:'[aria-label="Сравнение версий"]'}:null;
  const showSaveBlocker=()=>{if(!saveBlocker)return;const notice=dialogRef.current?.querySelector<HTMLElement>(saveBlocker.selector);if(!notice)return;const focus=notice.hasAttribute("tabindex")?notice:notice.querySelector<HTMLElement>("select,input:not([disabled]),button:not([disabled]),textarea:not([disabled])")||notice;focusEditorTarget(focus.closest("label,.field")||focus,focus);};
  if (!entityModalOpen) {
    return null;
  }

  return (
    <dialog ref={dialogRef} className="app-native-dialog" aria-label={isEditingEntity ? "Редактирование записи" : "Новая запись"} onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="panel palette form-modal entity-editor-modal" onClick={(event) => event.stopPropagation()}>
        <div className="row entity-editor-header">
          <div>
            <h2>{isEditingEntity ? "Редактирование записи" : "Новая запись"}</h2>
            <p className="copy">{isEditingEntity ? controller.entityForm.title : "Начните с названия и описания. Остальное можно дополнить позже."}</p>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <div className="entity-editor-body">
        <DeviceDraftControls draft={controller.deviceDraft}/>
        {controller.conflict && <section tabIndex={-1} className="card mini" aria-label="Сравнение версий">
          <h3>Конфликт: запись изменилась на сервере</h3>
          <p>Сравните версии. Подготовка объединения сохранит остальные серверные поля; изменённые вами поля (включая списки целиком) возьмём из черновика. Сохранение выполняется отдельной кнопкой.</p>
          <details><summary>Мой черновик</summary><pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(controller.entityForm, null, 2)}</pre></details>
          <details><summary>Актуальная серверная версия</summary><pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(controller.conflict, null, 2)}</pre></details>
          <button className="ghost" type="button" onClick={controller.useComparedDraft}>Подготовить объединение с моими правками</button>
        </section>}

        <details className="editor-disclosure">
          <summary>Заполнить с помощью AI</summary>
        <div className="field field-full">
          <label htmlFor="entity-ai-prompt">Описание для AI</label>
          <textarea
            id="entity-ai-prompt"
            className="input textarea"
            disabled={generating}
            onChange={(event) => setDraftPrompt(event.target.value)}
            placeholder="Опиши город, НПС, монстра или квест. AI заполнит форму, а ты потом отредактируешь её вручную."
            value={draftPrompt}
          />
        </div>

        <div className="actions">
          <button className="ghost" disabled={generating || !draftPrompt.trim()} onClick={() => void generateDraft()} type="button">
            {generating ? "Генерирую..." : "Сгенерировать и заполнить"}
          </button>
        </div>

        </details>

        {error && !controller.conflict ? (
          <div tabIndex={-1} className="card mini form-error" role="alert">
            <strong>Изменения не сохранены</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {generating ? (
          <DndGenerationProgress
            detail="Собираю текущую форму, контекст кампании и прошу AI подготовить новый черновик сущности."
            steps={entityGenerationSteps}
            title="Пишу новый черновик"
          />
        ) : null}

        {draftNotes.length ? <p className="copy draft-notes">{draftNotes.join(" ")}</p> : null}

        <EntityEditorForm
          busy={saving || generating}
          campaign={campaign}
          controller={controller}
          onContentContextMenu={onContentContextMenu}
        />

        </div>
        <div className="actions editor-submit-bar">
          {saveBlocker&&<div className="editor-save-blocker"><span>{saveBlocker.text}</span><button className="ghost" type="button" onClick={showSaveBlocker}>{saveBlocker.action}</button></div>}
          {isEditingEntity ? (
            <button className="ghost danger-action" disabled={saving || generating} onClick={() => void deleteEntity()} type="button">
              Удалить
            </button>
          ) : null}
          <button className="ghost" onClick={onClose} type="button">Отмена</button>
          <button className="primary" disabled={saving || generating || entityFormImageUploading || Boolean(controller.conflict) || Boolean(controller.deviceDraft.candidate)} onClick={() => void submitEntity()} type="button">
            {saving ? "Сохраняю..." : entitySubmitLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
