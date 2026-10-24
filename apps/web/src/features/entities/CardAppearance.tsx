type Props={textColor?:string;backgroundColor?:string;onChange:(patch:{textColor?:string;backgroundColor?:string})=>void};
export function CardAppearance({textColor,backgroundColor,onChange}:Props){
 return <fieldset className="card-appearance"><legend>Оформление карточки</legend>
 <label>Цвет текста<input type="color" value={textColor||"#edf0f5"} onChange={e=>onChange({textColor:e.target.value})}/></label>
 <label>Цвет карточки<input type="color" value={backgroundColor||"#222733"} onChange={e=>onChange({backgroundColor:e.target.value})}/></label>
 <label>Готовое оформление<select aria-label="Готовое оформление карточки" value="" onChange={e=>{const [backgroundColor,textColor]=e.target.value.split("|");onChange({backgroundColor:backgroundColor||undefined,textColor:textColor||undefined})}}><option value="">Выберите палитру</option><option value="#252b38|#edf0f5">Тёмная</option><option value="#302b40|#eee5ff">Лавандовая</option><option value="#263b34|#e2f3e8">Лесная</option><option value="#423522|#fff1cd">Золотая</option><option value="#efe2c7|#342a21">Пергамент</option></select></label>
 <button className="ghost" type="button" onClick={()=>onChange({textColor:undefined,backgroundColor:undefined})}>Сбросить цвета</button>
 <span className="card-appearance-preview" style={{color:textColor,background:backgroundColor}}>Пример текста карточки</span>
 </fieldset>;
}
