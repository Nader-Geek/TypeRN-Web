// Normalize ManhuaRMTL OCR JSON and fetch its chapter OCR export when CORS permits.
(() => {
  "use strict";
  const first = (o, keys) => {
    for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
    return null;
  };
  const str = v => String(v == null ? "" : v).trim();
  const num = v => v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  const base = v => {
    try { return decodeURIComponent(String(v).split(/[?#]/)[0].split("/").pop()); }
    catch (_) { return String(v).split("/").pop(); }
  };
  const textValue = r => first(r, ["translatedText","translated_text","translation","targetText","target_text","translated","text","content","ocrText","ocr_text","recognizedText","recognized_text","sourceText","source_text","originalText","original_text","value"]);
  const pointsOf = r => first(r, ["polygon","points","poly","vertices","quad","coordinates"]);
  function pointsBounds(points) {
    if (!Array.isArray(points)) return null;
    const pts = points.map(p => Array.isArray(p) ? [num(p[0]),num(p[1])] : [num(p && (p.x ?? p.left)),num(p && (p.y ?? p.top))])
      .filter(p => p.every(Number.isFinite));
    if (pts.length < 2) return null;
    const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
    return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),points:pts};
  }
  function boundsOf(r, W, H) {
    const points = pointsBounds(pointsOf(r));
    let b = first(r, ["bounds","bbox","boundingBox","bounding_box","rect","box","coordinates"]);
    let x=null,y=null,w=null,h=null;
    if (points && points.w>0 && points.h>0) ({x,y,w,h}=points);
    if (x===null && Array.isArray(b) && b.length>=4) {
      x=num(b[0]); y=num(b[1]);
      const c=num(b[2]), d=num(b[3]);
      const xyxy = r && (r.bbox===b || r.boundingBox===b || r.bounding_box===b || r.coordinate_format==="xyxy" || r.format==="xyxy");
      w=xyxy?c-x:c; h=xyxy?d-y:d;
    } else if (x===null && b && typeof b==="object") {
      x=num(b.left ?? b.x ?? b.x1 ?? b.minX);
      y=num(b.top ?? b.y ?? b.y1 ?? b.minY);
      const right=num(b.right ?? b.x2 ?? b.maxX), bottom=num(b.bottom ?? b.y2 ?? b.maxY);
      w=right!==null && x!==null?right-x:num(b.width ?? b.w);
      h=bottom!==null && y!==null?bottom-y:num(b.height ?? b.h);
    }
    if (x===null) {
      x=num(r && (r.x ?? r.left ?? r.x1));
      y=num(r && (r.y ?? r.top ?? r.y1));
      const right=num(r && (r.right ?? r.x2)), bottom=num(r && (r.bottom ?? r.y2));
      w=right!==null && x!==null?right-x:num(r && (r.width ?? r.w));
      h=bottom!==null && y!==null?bottom-y:num(r && (r.height ?? r.h));
    }
    if ([x,y,w,h].some(v=>v===null)) {
      const cx=num(r && (r.centerX ?? r.center_x ?? r.cx));
      const cy=num(r && (r.centerY ?? r.center_y ?? r.cy));
      const fw=num(r && (r.width ?? r.w)), fh=num(r && (r.height ?? r.h));
      if ([cx,cy,fw,fh].every(v=>v!==null)) { x=cx-fw/2; y=cy-fh/2; w=fw; h=fh; }
    }
    if (![x,y,w,h].every(Number.isFinite) || w<=0 || h<=0) return null;
    if (W && H && Math.max(Math.abs(x),Math.abs(y),Math.abs(w),Math.abs(h)) <= 1.5) {
      x*=W; w*=W; y*=H; h*=H;
    }
    x=Math.max(0,x); y=Math.max(0,y);
    w=Math.max(1,Math.min(W?W-x:w,w)); h=Math.max(1,Math.min(H?H-y:h,h));
    return {x,y,w,h,points:points?points.points:null};
  }
  const regionList = p => {
    const a=first(p,["regions","texts","text_regions","ocr","ocrResults","ocr_results","lines","items","annotations","results","data"]);
    if (Array.isArray(a)) return a;
    if (a && typeof a==="object") {
      const nested=first(a,["regions","texts","items","lines","results"]);
      if (Array.isArray(nested)) return nested;
    }
    return p && (textValue(p)!=null || pointsOf(p) || p.bbox || p.bounds) ? [p] : [];
  };
  const pageName = (p,i) => {
    const v=first(p,["file","filename","image","imageName","image_name","src","url","name","pageName","page_name"]);
    if (v!=null) return String(v);
    const n=first(p,["pageNumber","page_number","pageIndex","page_index","number","index","page"]);
    return n==null?String(i+1):String(Number(n)+((p.pageIndex!=null||p.page_index!=null||p.index!=null)?1:0));
  };
  const natural = (a,b) => a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"});
  async function normalize(data, files) {
    files=Array.from(files||[]);
    const byName=new Map(files.map(f=>[base(f.name),f]));
    const sorted=files.slice().sort(natural);
    let root=data&&typeof data==="object"?data:{};
    const inner=first(root,["data","result","ocrData","ocr_data"]);
    if (inner && typeof inner==="object" && !Array.isArray(inner) && !root.pages) root=inner;
    let rawPages=Array.isArray(root)?root:first(root,["pages","chapterPages","chapter_pages","images","pageResults","page_results"]);
    if (!Array.isArray(rawPages)) {
      let rows=regionList(root);
      if (!rows.length && Array.isArray(root.texts)) rows=root.texts;
      const groups=new Map();
      for (const row of rows) {
        const key=String(first(row,["image","file","filename","pageName","page_name","page","pageIndex","page_index"])??"1");
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(row);
      }
      rawPages=Array.from(groups.entries()).map(([key,regions])=>({file:key,regions}));
    }
    if (!rawPages.length) throw new Error("لم أجد صفحات أو نصوص OCR داخل ملف ManhuaRMTL JSON.");
    const pages=[];
    let hasTranslation=false;
    for(let i=0;i<rawPages.length;i++){
      const p=rawPages[i]&&typeof rawPages[i]==="object"?rawPages[i]:{regions:[]};
      const name=pageName(p,i);
      let file=byName.get(base(name))||byName.get(base(first(p,["file","filename","image","src","url"])||""));
      if(!file) file=sorted[i] || (sorted.length===1?sorted[0]:null);
      if(!file){
        const remote=first(p,["imageUrl","image_url","image","src","url"]);
        if(typeof remote==="string" && /^https?:\/\//i.test(remote)){
          try{
            const response=await fetch(remote,{mode:"cors"});
            if(!response.ok) throw new Error("HTTP "+response.status);
            const blob=await response.blob();
            file=new File([blob],base(remote)||("page_"+(i+1)+".jpg"),{type:blob.type||"image/jpeg"});
          }catch(_){}
        }
      }
      if(!file) throw new Error("لم أجد صورة الصفحة "+name+". أرفق صور الصفحات مع ملف OCR أو استخدم ZIP يحتوي الصور وملف JSON.");
      let W=num(p.width),H=num(p.height);
      try{const bmp=await createImageBitmap(file);W=W||bmp.width;H=H||bmp.height;bmp.close();}catch(_){}
      const rows=regionList(p);
      const regions=[];
      for(let j=0;j<rows.length;j++){
        const r=rows[j]&&typeof rows[j]==="object"?rows[j]:{text:rows[j]};
        const txt=str(textValue(r));
        if(!txt) continue;
        const b=boundsOf(r,W,H);
        const translated=str(first(r,["translatedText","translated_text","translation","targetText","target_text","translated"]));
        if(translated)hasTranslation=true;
        const type=str(first(r,["det_class","class","type","kind","category","tag"])).toLowerCase();
        const free=/free|outside|narrat|caption|ot|system/.test(type);
        regions.push({
          id:Number.isFinite(Number(r.id))?Number(r.id):j,
          kind:free?"free_text":"dialogue",
          det_class:free?"text_free":"text_bubble",
          rect:b?[b.x,b.y,b.w,b.h]:null,
          angle:num(r.angle)||0,
          tone:str(r.tone||r.style||""),
          source:str(first(r,["sourceText","source_text","ocrText","ocr_text","originalText","original_text","recognizedText","recognized_text","text","content"])),
          text:translated||txt,
          polys:b&&b.points?[b.points]:[],
          confidence:num(r.confidence ?? r.score)
        });
      }
      const valid=regions.filter(r=>Array.isArray(r.rect)&&r.rect.length===4);
      valid.sort((a,b)=>a.rect[1]-b.rect[1] || (String(root.reading_order||"rtl")==="ltr"?a.rect[0]-b.rect[0]:b.rect[0]-a.rect[0]));
      valid.forEach((r,j)=>r.id=j);
      pages.push({index:i,file:file.name,width:W||0,height:H||0,origin:file.name,regions:valid,fileObj:file});
    }
    const total=pages.reduce((n,p)=>n+p.regions.length,0);
    if(!total) throw new Error("ملف OCR لا يحتوي على إحداثيات صالحة للفقاعات. تأكد أن JSON يتضمن bbox أو x/y/width/height أو polygon لكل نص.");
    return {
      format:"manga-autotranslate/typer-job",
      version:1,
      reading_order:str(root.reading_order||root.readingOrder||"rtl"),
      translated:Boolean(root.translated||hasTranslation),
      detected:true,
      source:"ManhuaRMTL OCR JSON",
      pages
    };
  }
  function attr(tag,name) {
    const lower=String(tag||"").toLowerCase();
    const key=name.toLowerCase()+"=";
    const at=lower.indexOf(key);
    if(at<0)return null;
    const value=String(tag).slice(at+key.length).trim();
    const quote=value[0];
    if(quote==="\""||quote==="'"){
      const end=value.indexOf(quote,1);
      return end>0?value.slice(1,end):null;
    }
    return value.split(/[\s>]/)[0]||null;
  }
  async function fromUrl(raw, files) {
    let url;
    try{url=new URL(raw);}catch(_){throw new Error("أدخل رابط فصل Manhuarm أو رابط ملف OCR JSON صحيحًا.");}
    let jsonUrl=url;
    if(!url.pathname.toLowerCase().endsWith(".json") && !url.pathname.toLowerCase().includes("/ocr-data/")){
      let html;
      try{
        const response=await fetch(url.href,{mode:"cors",credentials:"omit"});
        if(!response.ok)throw new Error("HTTP "+response.status);
        html=await response.text();
      }catch(e){
        throw new Error("تعذّر قراءة صفحة ManhuaRMTL من المتصفح (قد يمنع الموقع CORS). نزّل ملف OCR JSON من الصفحة وأرفقه مباشرة، أو أدخل رابط JSON المباشر.");
      }
      const marker=html.toLowerCase().indexOf("id=\"chapterinput\"");
      const marker2=html.toLowerCase().indexOf("id='chapterinput'");
      const at=marker>=0?marker:marker2;
      const start=at>=0?html.lastIndexOf("<",at):-1;
      const end=at>=0?html.indexOf(">",at):-1;
      const tag=start>=0&&end>start?html.slice(start,end+1):"";
      let id=attr(tag,"data-id")||attr(tag,"data-chapter-id");
      if(!id){
        const p=html.toLowerCase().indexOf("chapterinput");
        if(p>=0){
          const chunk=html.slice(p,p+500);
          id=attr(chunk,"data-id")||attr(chunk,"data-chapter-id");
        }
      }
      if(!id)throw new Error("لم أجد chapterInput data-id في صفحة ManhuaRMTL. أرفق ملف OCR JSON مباشرة.");
      jsonUrl=new URL("/wp-content/uploads/ocr-data/"+encodeURIComponent(id)+".json",url.origin);
    }
    let response;
    try{response=await fetch(jsonUrl.href,{mode:"cors",credentials:"omit"});}catch(_){throw new Error("المتصفح منع الوصول إلى ملف OCR في ManhuaRMTL بسبب CORS. نزّل JSON من الموقع ثم استورده مع صور الصفحات.");}
    if(!response.ok)throw new Error("تعذّر تحميل OCR JSON من ManhuaRMTL (HTTP "+response.status+").");
    let data;
    try{data=await response.json();}catch(_){throw new Error("الملف الذي أعاده Manhuarm ليس JSON صالحًا.");}
    return normalize(data,files);
  }
  window.TypeRManhuarm={normalize,fromUrl,boundsOf};
})();