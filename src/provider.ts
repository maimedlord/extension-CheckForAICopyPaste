import prompt from './detection-prompt.txt';
import { validateFindings, type CheckResult, type Finding } from './state';
export const endpoint = 'https://api.openai.com/v1/responses';
export const origin = 'https://api.openai.com/*';
export const model = 'gpt-6-luna';
export const sample = 'Here is a version you can post.\n\nThe meeting starts at noon.\n\nLet me know if you would like a shorter version.';
const kinds = ['assistant_commentary','drafting_instruction','placeholder'];
export const schema = { type:'object', additionalProperties:false, required:['findings'], properties:{ findings:{ type:'array', items:{ type:'object', additionalProperties:false, required:['kind','excerpt','occurrence'], properties:{ kind:{type:'string',enum:kinds}, excerpt:{type:'string',minLength:1}, occurrence:{type:'integer',minimum:1} } } } } };
export function parseFindings(text: string, value: unknown): Finding[] {
  const root = value as {findings?: unknown};
  if (!root || Object.keys(root).join() !== 'findings' || !Array.isArray(root.findings)) throw new Error('Invalid findings');
  const findings = root.findings.map(value => {
    const f = value as {kind:string;excerpt:string;occurrence:number};
    if (!f || Object.keys(f).sort().join() !== 'excerpt,kind,occurrence' || !kinds.includes(f.kind) || typeof f.excerpt !== 'string' || !f.excerpt || !Number.isSafeInteger(f.occurrence) || f.occurrence < 1 || f.occurrence > text.length) throw new Error('Invalid finding');
    let start = -f.excerpt.length;
    for (let i=0;i<f.occurrence;i++) { start = text.indexOf(f.excerpt,start+f.excerpt.length); if(start<0) throw new Error('Missing excerpt'); }
    return {start,end:start+f.excerpt.length,excerpt:f.excerpt};
  });
  return validateFindings(text,findings);
}
// Intentionally narrow fallback: only an entire standalone explicit slot. It does
// not scan prose, quotes, or code for keywords and cannot catch semantic leftovers.
export function basic(text: string, reason = 'Basic mode: only standalone explicit placeholders are checked.'): CheckResult {
  const excerpt = text.trim();
  const match = /^\[(?:insert|enter|replace with) (?:your |the )?[a-z][a-z0-9 ,'-]{1,100}\]$/i.test(excerpt);
  const start = text.indexOf(excerpt);
  return {status:'basic',findings:match ? [{start,end:start+excerpt.length,excerpt}] : [], detail:reason};
}
export function requestBody(text: string) {
  return {model,store:false,stream:false,max_output_tokens:8192,instructions:prompt,input:[{role:'user',content:JSON.stringify({text})}],text:{format:{type:'json_schema',name:'paste_findings',strict:true,schema}}};
}
export async function detect(text: string, key: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<CheckResult> {
  try {
    const response = await fetcher(endpoint,{method:'POST',redirect:'error',signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(requestBody(text))});
    if(!response.ok) return basic(text,`OpenAI HTTP ${response.status}; limited basic checks used.`);
    const data = await response.json();
    if(data.status !== 'completed') return basic(text,'OpenAI response incomplete; limited basic checks used.');
    const parts = (data.output ?? []).filter((x: {type:string})=>x.type==='message').flatMap((x: {content:unknown[]})=>x.content ?? []);
    if(parts.some((x: {type:string})=>x.type==='refusal')) return basic(text,'OpenAI declined the check; limited basic checks used.');
    const outputs = parts.filter((x: {type:string})=>x.type==='output_text');
    if(outputs.length!==1 || typeof outputs[0].text!=='string' || outputs[0].text.includes(key)) throw new Error('Invalid output');
    const findings = parseFindings(text,JSON.parse(outputs[0].text));
    const usage = data.usage;
    return {status:'checked',findings,detail:'GPT-6 Luna check completed.',usage: Number.isSafeInteger(usage?.input_tokens) && Number.isSafeInteger(usage?.output_tokens) ? {input:usage.input_tokens,output:usage.output_tokens} : undefined};
  } catch {
    return basic(text,signal.aborted ? 'Request cancelled or timed out; limited basic checks used. A sent request may be billed.' : 'OpenAI check failed; limited basic checks used.');
  }
}
