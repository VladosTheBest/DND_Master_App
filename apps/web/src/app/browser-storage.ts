// Accessing the Storage property itself can throw (privacy settings, sandbox).
export const browserStorage = {
  keys(): string[] | null {
    try { const storage=window.localStorage;return Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((key):key is string=>key!==null); } catch {return null;}
  },
  getItem(key: string): string | null {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): boolean {
    try { window.localStorage.setItem(key, value); return true; } catch { return false; }
  },
  removeItem(key: string): boolean {
    try { window.localStorage.removeItem(key); return true; } catch { return false; }
  }
};

export const sessionBrowserStorage = {
  getItem(key:string):string|null {try{return window.sessionStorage.getItem(key);}catch{return null;}},
  setItem(key:string,value:string):boolean {try{window.sessionStorage.setItem(key,value);return true;}catch{return false;}},
  removeItem(key:string):boolean {try{window.sessionStorage.removeItem(key);return true;}catch{return false;}}
};
