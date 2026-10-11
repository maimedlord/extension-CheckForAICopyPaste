import type { Checker, CheckResult } from './state';
export const remoteChecker: Checker = async(text,signal) => {
  const id=crypto.randomUUID();
  const cancel=()=>{void chrome.runtime.sendMessage({type:'cancel',id}).catch(()=>{});};
  if(signal.aborted) throw new Error('Cancelled');
  signal.addEventListener('abort',cancel,{once:true});
  try {
    const result=await chrome.runtime.sendMessage({type:'check',id,text}) as CheckResult & {error?:string};
    if(signal.aborted || result.error || !Array.isArray(result.findings)) throw new Error('Check unavailable');
    return result;
  } finally {signal.removeEventListener('abort',cancel);}
};
