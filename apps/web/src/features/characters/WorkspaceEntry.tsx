import {useEffect,useState,type FormEvent} from "react";
import {LoginScreen} from "../../auth-ui";
import {api} from "../../app/api";
import {browserStorage} from "../../app/browser-storage";
/** Public sign-in can open without loading the campaign/map/catalog workspace. */
export function WorkspaceEntry({children}:{children:React.ReactNode}){
 const [state,setState]=useState<"checking"|"login"|"ready">("checking"),[error,setError]=useState("");
 const [username,setUsername]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;if(browserStorage.getItem("shadow-edge.logout-pending")==="1"){setState("ready");return;}void api.getSession().then(session=>{if(active)setState(session.authenticated?"ready":"login");}).catch(reason=>{if(active){setError(reason instanceof Error?reason.message:"Сервер недоступен.");setState("login");}});return()=>{active=false;};},[]);
 async function submit(event:FormEvent<HTMLFormElement>,mode:"login"|"register"){event.preventDefault();if(mode==="register"&&password!==confirm){setError("Пароли не совпадают.");return;}setBusy(true);setError("");try{const session=await api[mode]({username:username.trim(),password});if(session.authenticated){setPassword("");setConfirm("");setState("ready");}else setError("Вход не подтверждён сервером.");}catch(reason){setError(reason instanceof Error?reason.message:"Не удалось войти.");}finally{setBusy(false);}}
 if(state==="ready")return <>{children}</>;
 if(state==="checking")return <div className="boot" role="status">Проверяем вход…</div>;
 return <LoginScreen busy={busy} error={error} username={username} password={password} passwordConfirm={confirm} onUsernameChange={setUsername} onPasswordChange={setPassword} onPasswordConfirmChange={setConfirm} onSubmit={submit}/>;
}
