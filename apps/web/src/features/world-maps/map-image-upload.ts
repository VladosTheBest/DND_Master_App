export const MAP_IMAGE_MAX_BYTES=100*1024*1024;
// Decode by content, not the filename or OS-provided MIME. Convert additional
// browser-supported formats to a portable PNG before the existing owned upload.
export async function prepareMapImage(file:File):Promise<File>{
 if(file.size>MAP_IMAGE_MAX_BYTES)throw new Error('Изображение должно быть не больше 100 МБ.');
 let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(file);}catch{throw new Error('Браузер не смог открыть изображение. Преобразуй его в PNG, JPEG или WebP.');}
 try{
  if(/^image\/(png|jpeg|webp|gif)$/.test(file.type))return file;
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Недостаточно памяти для изображения.');ctx.drawImage(bitmap,0,0);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось преобразовать изображение.')),'image/png'));
  if(blob.size>MAP_IMAGE_MAX_BYTES)throw new Error('После преобразования изображение больше 100 МБ.');
  return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.png',{type:'image/png'});
 }finally{bitmap.close();}
}
