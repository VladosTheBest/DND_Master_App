import {Component,type ReactNode} from "react";
/** A deployed lazy chunk can disappear while an older tab is still open. */
export class WorkspaceBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){if(this.state.failed)return <main className="boot"><section className="panel boot-card" role="alert"><h1>Нужно обновить страницу</h1><p>Раздел не удалось загрузить. Возможно, сайт обновился или прервалась связь.</p><p>Серверные запросы не будут отправлены повторно. После обновления проверьте доступные черновики на устройстве.</p><button className="primary" onClick={()=>location.reload()}>Обновить страницу</button></section></main>;return this.props.children;}
}
