/* Auto Typesetting import and reviewed batch placement. Bubble detection is not claimed here. */
(function () {
  "use strict";
  const state = { entries: [], page: "", fileName: "", errors: [] };
  const $ = (id) => document.getElementById(id);
  const clean = (v) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").trim();
  const num = (v) => v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  const pageName = (v, fallback) => typeof v === "number" ? String(v + 1) : clean(v || fallback || "Current page");
  function getBounds(item) {
    const b = item && (item.bounds || item.bbox || item.rect || item.box);
    if (b) {
      const l = num(b.left != null ? b.left : b.x), t = num(b.top != null ? b.top : b.y);
      const r = num(b.right) == null && l != null ? l + num(b.width) : num(b.right);
      const d = num(b.bottom) == null && t != null ? t + num(b.height) : num(b.bottom);
      if ([l,t,r,d].every(Number.isFinite) && r > l && d > t) return { left:l, top:t, right:r, bottom:d };
    }
    const x=num(item && item.x), y=num(item && item.y), w=num(item && (item.width ?? item.w)), h=num(item && (item.height ?? item.h));
    return [x,y,w,h].every(Number.isFinite) && w>0 && h>0 ? {left:x,top:y,right:x+w,bottom:y+h} : null;
  }
  function entry(item, index, fallback) {
    const text = clean(typeof item === "string" ? item : item && (item.translatedText ?? item.text ?? item.content ?? item.translation ?? item.value));
    if (!text) return null;
    return { id:"ats-"+index+"-"+Math.random().toString(36).slice(2,7), page:pageName(item && typeof item==="object" ? (item.page ?? item.pageName ?? item.image ?? item.file ?? item.filename) : null, fallback), text, bounds:item && typeof item==="object" ? getBounds(item) : null };
  }
  function parseText(source) {
    let page="Current page"; const out=[];
    String(source||"").replace(/^\uFEFF/,"").split(/\r\n?|\n/).forEach((raw) => {
      const line=raw.trim(); if(!line) return;
      const m=line.match(/^(?:--\s*)?(?:page|image|file)\s*[:=]\s*(.+?)(?:\s*--)?$/i) || line.match(/^\[\[([^\]]+)\]\]$/);
      if(m){page=m[1].trim();return;}
      const tagged=line.match(/^(?:""|\/\/|\(\)|\[\]|<>|SFX|OT)\s*:\s*(.*)$/i);
      const item=entry(tagged?tagged[1]:line,out.length,page); if(item) out.push(item);
    });
    return out;
  }
  function parseJSON(data) {
    const root=data&&typeof data==="object"?data:{}, out=[];
    const pageList=Array.isArray(root)?root:Array.isArray(root.pages)?root.pages:null;
    if(pageList) pageList.forEach((p,i)=>{
      const name=p&&(p.image||p.file||p.filename||p.name||p.page)||String(i+1);
      const list=Array.isArray(p)?p:p&&(p.texts||p.translations||p.items||p.lines);
      if(Array.isArray(list)) list.forEach(v=>{const e=entry(v,out.length,name);if(e)out.push(e);});
    });
    else {
      const list=root.texts||root.translations||root.items;
      if(Array.isArray(list)) list.forEach(v=>{const e=entry(v,out.length,root.page||root.image||"Current page");if(e)out.push(e);});
      else {const e=entry(root,0,root.page||root.image);if(e)out.push(e);}
    }
    if(!out.length) throw new Error("لم أجد نصوصًا صالحة أو مصفوفة pages/texts داخل JSON.");
    return out;
  }
  const pageNames=()=>Array.from(new Set(state.entries.map(e=>e.page)));
  const esc=(v)=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function sync(card) {
    const e=state.entries.find(v=>v.id===card.dataset.id); if(!e)return;
    e.text=clean(card.querySelector(".ats__text").value);
    const v={};card.querySelectorAll("[data-b]").forEach(el=>v[el.dataset.b]=num(el.value));
    e.bounds=[v.x,v.y,v.w,v.h].every(Number.isFinite)&&v.w>0&&v.h>0?{left:v.x,top:v.y,right:v.x+v.w,bottom:v.y+v.h}:null;
  }
  function render() {
    const host=$("ats-panel");if(!host)return;
    const names=pageNames();if(!names.includes(state.page))state.page=names[0]||"";
    const select=host.querySelector(".ats__page");
    select.innerHTML=names.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join("");
    select.disabled=!names.length;if(state.page)select.value=state.page;
    const items=state.entries.filter(e=>e.page===state.page);
    host.querySelector(".ats__count").textContent=state.entries.length?state.entries.length+" نص / "+names.length+" صفحة":"لم يتم استيراد ملف بعد";
    host.querySelector(".ats__rows").innerHTML=items.map(e=>{
      const b=e.bounds||{};
      return '<article class="ats__entry" data-id="'+esc(e.id)+'"><textarea class="ats__text" aria-label="Translation text">'+esc(e.text)+'</textarea><div class="ats__coords">'+
      [['x',b.left],['y',b.top],['w',b.left!=null?b.right-b.left:""],['h',b.top!=null?b.bottom-b.top:""]].map(pair=>'<label>'+pair[0].toUpperCase()+'<input data-b="'+pair[0]+'" type="number" min="0" step="1" value="'+(pair[1]??"")+'"></label>').join("")+
      '</div><small>'+(e.bounds?"إحداثيات محددة":"أدخل حدود الفقاعة بالبكسل")+'</small><button type="button" class="ats__remove" aria-label="Remove line">×</button></article>';
    }).join("");
    host.querySelector(".ats__empty").hidden=items.length>0;
    host.querySelector(".ats__apply").disabled=!items.length;
    host.querySelector(".ats__export").disabled=!state.entries.length;
    host.querySelector(".ats__status").textContent=state.errors.join(" · ");
  }
  async function importFile(file) {
    const source=await file.text();
    const parsed=/\.json$/i.test(file.name)?parseJSON(JSON.parse(source)):parseText(source);
    if(!parsed.length)throw new Error("الملف لا يحتوي على نصوص.");
    state.entries=parsed;state.fileName=file.name;state.page=pageNames()[0]||"";state.errors=[];render();
  }
  function exportData() {
    const data={version:1,source:state.fileName,pages:pageNames().map(name=>({image:name,texts:state.entries.filter(e=>e.page===name).map(e=>({text:e.text,...(e.bounds?{bounds:e.bounds}:{})}))}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download=(state.fileName.replace(/\.[^.]+$/,"")||"translations")+".autotypeset.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function apply() {
    const host=$("ats-panel");host.querySelectorAll(".ats__entry").forEach(sync);
    const ps=window.TypeRPhotoshop,doc=ps&&ps.app&&ps.app.doc;
    if(!doc)throw new Error("افتح صفحة صورة في مساحة العمل أولًا.");
    const list=state.entries.filter(e=>e.page===state.page&&e.text);
    if(!list.length)throw new Error("لا توجد نصوص في الصفحة المختارة.");
    const missing=list.filter(e=>!e.bounds);if(missing.length)throw new Error("هناك "+missing.length+" نص بلا حدود فقاعة. أدخل X وY وW وH أولًا.");
    const outside=list.filter(e=>e.bounds.left<0||e.bounds.top<0||e.bounds.right>doc.width||e.bounds.bottom>doc.height);
    if(outside.length)throw new Error("بعض الإحداثيات خارج أبعاد الصفحة الحالية ("+doc.width+" × "+doc.height+").");
    const active=ps.activeTextLayer&&ps.activeTextLayer(),style=active?{textProps:active.params}:null;
    const result=ps.ops.createTextLayersInStoredSelections({texts:list.map(e=>e.text),selections:list.map(e=>e.bounds),styles:list.map(()=>style),padding:8});
    if(result)throw new Error("تعذر إنشاء الطبقات: "+result);
    host.querySelector(".ats__status").textContent="تم إنشاء "+list.length+" طبقة نص. راجع النتيجة قبل الحفظ.";
  }
  function mount() {
    if($("ats-panel"))return;
    const panel=document.createElement("section");panel.id="ats-panel";panel.className="ats";
    panel.innerHTML='<header class="ats__head"><strong>Auto Typesetting</strong><button type="button" class="ats__close" aria-label="Close">×</button></header><div class="ats__body"><p class="ats__intro">استورد TXT أو JSON، ثم راجع النصوص وحدد حدود الفقاعات بالبكسل. الكشف التلقائي للفقاعات غير مفعّل في هذه المرحلة.</p><div class="ats__actions"><button type="button" class="ats__import">استيراد TXT / JSON</button><button type="button" class="ats__export" disabled>تصدير التعديلات</button><input class="ats__file" type="file" accept=".txt,.json,text/plain,application/json" hidden></div><div class="ats__meta"><span class="ats__count">لم يتم استيراد ملف بعد</span><label>الصفحة <select class="ats__page" disabled></select></label></div><div class="ats__rows"></div><p class="ats__empty">اختر ملف ترجمة للبدء.</p><button type="button" class="ats__apply" disabled>إنشاء طبقات نص للصفحة المختارة</button><p class="ats__status" role="status"></p></div>';
    document.body.appendChild(panel);
    const toggle=document.createElement("button");toggle.id="ats-toggle";toggle.type="button";toggle.textContent="Auto Typesetting";document.body.appendChild(toggle);
    toggle.addEventListener("click",()=>panel.classList.toggle("is-open"));
    panel.querySelector(".ats__close").addEventListener("click",()=>panel.classList.remove("is-open"));
    panel.querySelector(".ats__import").addEventListener("click",()=>panel.querySelector(".ats__file").click());
    panel.querySelector(".ats__file").addEventListener("change",async ev=>{const f=ev.target.files&&ev.target.files[0];if(!f)return;try{await importFile(f);panel.classList.add("is-open");}catch(err){state.errors=[err.message||String(err)];render();}ev.target.value="";});
    panel.querySelector(".ats__page").addEventListener("change",ev=>{panel.querySelectorAll(".ats__entry").forEach(sync);state.page=ev.target.value;render();});
    panel.querySelector(".ats__rows").addEventListener("input",ev=>{const card=ev.target.closest(".ats__entry");if(card)sync(card);});
    panel.querySelector(".ats__rows").addEventListener("click",ev=>{const btn=ev.target.closest(".ats__remove");if(!btn)return;const card=btn.closest(".ats__entry");state.entries=state.entries.filter(e=>e.id!==card.dataset.id);render();});
    panel.querySelector(".ats__apply").addEventListener("click",()=>{try{apply();state.errors=[];}catch(err){state.errors=[err.message||String(err)];panel.querySelector(".ats__status").textContent=state.errors[0];}});
    panel.querySelector(".ats__export").addEventListener("click",()=>{panel.querySelectorAll(".ats__entry").forEach(sync);exportData();});
    render();
  }
  window.TypeRAutoTypeset={version:1,parseText,parseJSON,get entries(){return state.entries.slice();},open(){mount();$("ats-panel").classList.add("is-open");}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();