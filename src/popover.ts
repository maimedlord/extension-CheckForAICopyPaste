import type { Draft } from './state';
import type { Editor } from './editors';
import { defaults, type Settings } from './settings';

type Box={left:number;right:number;top:number;bottom:number};
export function placeNotice(r:Box,width:number,height:number,viewport:{width:number;height:number},obstacles:Box[]=[]) {
  const clamp=(n:number,max:number)=>Math.max(12,Math.min(n,max));
  const x=clamp(r.left,viewport.width-width-12),y=clamp(r.top,viewport.height-height-12);
  const candidates=[{x:r.right+10,y,side:'right'},{x:r.left-width-10,y,side:'left'},{x,y:r.top-height-10,side:'above'},{x,y:r.bottom+10,side:'below'}];
  return candidates.find(p=>p.x>=12&&p.y>=12&&p.x+width<=viewport.width-12&&p.y+height<=viewport.height-12&&![r,...obstacles].some(b=>p.x<b.right+4&&p.x+width>b.left-4&&p.y<b.bottom+4&&p.y+height>b.top-4));
}

// Isolated styles and textContent keep page CSS and untrusted excerpts out of the UI.
export function createNotices(initial:Settings=defaults) {
  let appearance=initial;
  const decorate=(host:HTMLElement)=>{
    host.setAttribute('data-theme',appearance.theme);host.setAttribute('data-preset',appearance.colorPreset);
    host.style.setProperty('--notice-size',appearance.textSize==='small'?'13px':appearance.textSize==='large'?'16px':'14px');
  };
  const notices = new Map<Editor, {host:HTMLElement;panel:HTMLElement;arrow:HTMLElement;list:HTMLElement;draft:Draft;signature:string}>();
  let frame = 0;
  function position() {
    frame = 0;
    for (const [editor, notice] of notices) {
      const r=editor.getBoundingClientRect();
      let clipped=false;
      for(let parent=editor.parentElement;parent;parent=parent.parentElement){
        const css=getComputedStyle(parent);
        if(/hidden|clip|auto|scroll/.test(css.overflow+css.overflowX+css.overflowY)){
          const bounds=parent.getBoundingClientRect();
          if(r.bottom<=bounds.top||r.top>=bounds.bottom||r.right<=bounds.left||r.left>=bounds.right){clipped=true;break;}
        }
      }
      const hidden=!editor.isConnected || clipped || r.width===0 || r.height===0 || r.bottom<=0 || r.top>=innerHeight || r.right<=0 || r.left>=innerWidth;
      notice.host.hidden=hidden;
      if(hidden) continue;
      const width=Math.min(320,innerWidth-24);
      notice.panel.style.width=`${width}px`;
      const height=notice.panel.getBoundingClientRect().height;
      const obstacles=[...document.querySelectorAll<HTMLElement>('button,input,textarea,select,[role="button"],[contenteditable="true"]')].filter(e=>e!==editor&&!editor.contains(e)).map(e=>e.getBoundingClientRect()).filter(b=>b.width>0&&b.height>0);
      for(const other of notices.values())if(other!==notice&&!other.host.hidden)obstacles.push(other.panel.getBoundingClientRect());
      const placement=placeNotice(r,width,height,{width:innerWidth,height:innerHeight},obstacles);
      if(!placement){notice.host.hidden=true;continue;}
      const {x,y,side}=placement;
      notice.host.style.left=`${x}px`;notice.host.style.top=`${y}px`;
      const vertical=side==='right'||side==='left';
      const arrowX=vertical?(side==='right'?-4:width-4):Math.max(12,Math.min(width-16,(r.left+r.right)/2-x));
      const arrowY=vertical?Math.max(12,Math.min(height-16,(r.top+Math.min(r.bottom,innerHeight))/2-y)):(side==='above'?height-4:-4);
      notice.arrow.style.left=`${arrowX}px`;notice.arrow.style.top=`${arrowY}px`;
    }
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(position);};
  const resize=new ResizeObserver(schedule);
  window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
  function remove(editor:Editor) {
    const notice=notices.get(editor);if(!notice)return;
    resize.unobserve(editor);resize.unobserve(notice.panel);notice.host.remove();notices.delete(editor);
  }
  return {
    configure(settings:Settings){appearance=settings;for(const notice of notices.values())decorate(notice.host);schedule();},
    update(editor:Editor,draft:Draft) {
      if(!draft.visible.length || !editor.isConnected){remove(editor);return;}
      let notice=notices.get(editor);
      if(!notice){
        const host=document.createElement('div');host.setAttribute('data-proofreader-ignore','');
        host.style.cssText='all:initial;position:fixed;z-index:2147483647;pointer-events:none;';
        decorate(host);
        const root=host.attachShadow({mode:'closed'});
        const style=document.createElement('style');style.textContent=`
          :host([hidden]){display:none!important} *{box-sizing:border-box}
          .arrow{position:absolute;width:8px;height:8px;background:#fffdf5;border:1px solid #b9ad86;transform:rotate(45deg);pointer-events:none}
          section{pointer-events:auto;font:var(--notice-size,14px)/1.45 system-ui,sans-serif;color:#24313c;background:#fffdf5;border:1px solid #b9ad86;border-left:3px solid #948151;border-radius:8px;padding:12px;box-shadow:0 3px 14px #0002;max-height:min(260px,45vh);overflow:auto;overflow-wrap:anywhere}
          h2{font:600 14px/1.4 system-ui,sans-serif;margin:0 0 8px}ul{padding:0;margin:0;list-style:none}li{white-space:pre-wrap;margin:8px 0;padding-left:8px;border-left:2px solid #c5bfae}
          button{font:inherit;color:inherit;background:transparent;border:1px solid #a49b83;border-radius:5px;padding:4px 10px;margin-top:6px;cursor:pointer}button:focus-visible{outline:2px solid #315cad;outline-offset:3px}
          @media(prefers-color-scheme:dark){section{color:#eee9dd;background:#28271f;border-color:#807654}button{border-color:#aaa18a}.arrow{background:#28271f;border-color:#807654}}
          :host([data-theme=light]) section{color:#24313c;background:#fffdf5;border-color:#b9ad86}:host([data-theme=light]) .arrow{background:#fffdf5}
          :host([data-theme=dark]) section{color:#eee9dd;background:#28271f;border-color:#807654}:host([data-theme=dark]) .arrow{background:#28271f}
          :host([data-preset=neutral]) section{border-left-color:#788996}
        `;
        const panel=document.createElement('section');panel.setAttribute('aria-label','Possible drafting leftovers');
        const heading=document.createElement('h2');heading.textContent='Possible drafting leftovers';
        const list=document.createElement('ul');
        const button=document.createElement('button');button.type='button';button.textContent='Dismiss';
        button.addEventListener('click',()=>{const focused=root.activeElement===button;notices.get(editor)?.draft.dismiss();if(focused)editor.focus({preventScroll:true});});
        const arrow=document.createElement('span');arrow.className='arrow';arrow.setAttribute('aria-hidden','true');
        panel.append(heading,list,button);root.append(style,panel,arrow);document.documentElement.append(host);
        notice={host,panel,arrow,list,draft,signature:''};notices.set(editor,notice);resize.observe(editor);resize.observe(panel);
      }
      notice.draft=draft;
      const signature=JSON.stringify(draft.visible.map(f=>f.excerpt));
      if(signature!==notice.signature){notice.signature=signature;notice.list.replaceChildren(...draft.visible.map(f=>{const li=document.createElement('li');li.textContent=f.excerpt;return li;}));schedule();}
    },
    dispose(){for(const editor of notices.keys())remove(editor);resize.disconnect();window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);if(frame)cancelAnimationFrame(frame);},
  };
}
