import { CLASSES, type Edition } from "./rules-data";
import inventory from "./source-inventory.json";

/** Public index counts describe sources, never imply those rules are implemented. */
export function SourceCoverage({ edition }: { edition: Edition }) {
  const rows = inventory.classes.filter((c) => c.edition === edition);
  return (
    <details className="ch-rule-original">
      <summary>Источники и доступные специализации · {edition}</summary>
      <p>
        В конструкторе доступны только перечисленные варианты. Каталог dnd.su
        проверен {inventory.checkedAt}. Наличие специализации не означает
        полного покрытия её выборов и зависимых правил. Каталог инфузий и схем
        изобретателя пока содержит только часть опубликованных предметов.
        Неофициальные варианты и Unearthed Arcana исключены из сравнения.
      </p>
      <table>
        <thead>
          <tr>
            <th>Класс</th>
            <th>В конструкторе</th>
            <th>В источнике</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cls = CLASSES.find((c) => c.id === row.id);
            const available =
              cls?.subclasses.filter((s) => s.editions.includes(edition)) ?? [];
            return (
              <tr key={row.id}>
                <th>{cls?.name ?? "Изобретатель"}</th>
                <td>
                  {available.length
                    ? available.map((s) => s.name).join(", ")
                    : "Пока отсутствует"}
                </td>
                <td>
                  <a href={row.url} target="_blank" rel="noreferrer">
                    {row.subclasses.length} специализаций
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}
