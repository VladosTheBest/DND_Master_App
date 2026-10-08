import {clone} from './core.mjs';
export const sceneBackground=scene=>scene.levels?.contents?.[0]?.background?.src??scene.background?.src??'';
export function sceneCreation(projection){
 const data=clone(projection);
 if(Number(globalThis.game?.release?.generation)>=14){data.levels=[{name:'Основной уровень',background:clone(data.background??{})}];delete data.background}
 return data;
}
export async function setSceneBackground(scene,src){
 if(sceneBackground(scene)===src)return;
 if(Number(game.release.generation)>=14){const level=scene.levels.contents[0];if(level)await level.update({'background.src':src});else await scene.createEmbeddedDocuments('Level',[{name:'Основной уровень',background:{src}}])}
 else await scene.update({'background.src':src});
 if(sceneBackground(scene)!==src)throw Error('Foundry не сохранил фон сцены. Повторите создание.');
}
export async function verifySceneImage(src){
 if(!src)throw Error('У фона сцены отсутствует файл.');
 const image=new Image();image.src=src;await image.decode().catch(()=>{throw Error('Фон не загрузился. Повторите попытку: пустая сцена не будет создана.')});
 if(!image.naturalWidth)throw Error('Файл фона не содержит изображения.');
}
