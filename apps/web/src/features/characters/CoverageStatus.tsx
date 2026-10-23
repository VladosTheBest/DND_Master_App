import type {CharacterDraft,FeatureGain} from "./rules";
import coverage from "./COVERAGE.md?raw";
const aliases:Record<string,string[]>={artificer:["Изобретатель"],warlock:["Колдун"],ranger:["Следопыт","Повелитель зверей"],druid:["Друид"],sorcerer:["Чародей"],barbarian:["Варвар"],bard:["Бард"],cleric:["Жрец"],fighter:["Воин"],monk:["Монах"],paladin:["Паладин"],rogue:["Плут"],wizard:["Волшебник"]};
export function CoverageStatus({draft,className,features}:{draft:CharacterDraft;className:string;features:FeatureGain[]}){
 const row=coverage.split('\n').find(line=>line.startsWith(`| ${draft.edition} | [${draft.classId}]`));
 const catalog=row?.split('|')[3]?.trim();
 const untranslated=features.filter(feature=>!/[А-Яа-яЁё]/.test(feature.description));
 const notes=coverage.split('\n').filter(line=>line.startsWith('- ')&&(aliases[draft.classId]||[]).some(label=>line.toLowerCase().includes(label.toLowerCase()))).slice(0,3).map(line=>line.slice(2).replace(/\[([^\]]+)\]\([^)]+\)/g,'$1'));
 return <details className="ch-coverage"><summary>{className} · {draft.edition}: покрытие правил частичное</summary><p>Каталог специализаций: {catalog||"состав требует сверки"}. Наличие варианта в списке не означает полной автоматизации его механик.</p><p>В текущем листе {features.length} умений; без русского текста в описании — {untranslated.length}. Краткая русская подсказка также не гарантирует полный перевод оригинала.</p>{untranslated.length>0&&<p>Проверьте английские описания: {untranslated.map(feature=>feature.name).join(', ')}.</p>}<ul><li>Ресурсы, состояния и призываемые существа могут требовать ручного применения. Проверка формы не доказывает полноту всех правил.</li><li>Полнота дополнительных видов/рас, снаряжения и всех переводов ещё не подтверждена. Правила 2014 и 2024 хранятся отдельно.</li>{notes.map(note=><li key={note}>{note}</li>)}</ul></details>;
}
