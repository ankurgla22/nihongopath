const B="http://localhost:3000";
const pages=["/","/japanese","/japanese/foundation","/japanese/foundation/hiragana-basic","/japanese/n5","/japanese/n5/grammar","/japanese/n2/grammar/wake-dewa-nai","/japanese/n5/vocabulary/1-ohayou-gozaimasu","/japanese/n1/kanji","/japanese/n5/reading","/japanese/n2/listening","/jlpt","/jlpt/strategy","/search?q=学校"];
const get=async(p)=>{const r=await fetch(B+p,{redirect:"manual"});return {status:r.status,h:Object.fromEntries(r.headers),html:await r.text()}};
const titles=new Map(), descs=new Map();
const rx=(html,re)=>(html.match(re)||[])[1];
console.log("=== per-page checks");
for(const p of pages){
  const {status,h,html}=await get(p);
  const title=rx(html,/<title>([^<]*)<\/title>/); const desc=rx(html,/<meta name="description" content="([^"]*)"/);
  const canon=rx(html,/<link rel="canonical" href="([^"]*)"/); const robots=rx(html,/<meta name="robots" content="([^"]*)"/);
  const h1=(html.match(/<h1[\s>]/g)||[]).length; const lang=rx(html,/<html[^>]*lang="([^"]*)"/); const charset=/<meta charSet="utf-8"|<meta charset="utf-8"/i.test(html);
  const viewport=/<meta name="viewport"/.test(html); const og=/property="og:title"/.test(html), ogimg=/property="og:image"/.test(html), tw=/name="twitter:card"/.test(html);
  const imgs=html.match(/<img\b[^>]*>/g)||[]; const noalt=imgs.filter(i=>!/\salt=/.test(i)).length;
  const ld=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>{try{return JSON.parse(m[1])}catch{return {"@type":"INVALID"}}});
  const types=ld.map(x=>x["@type"]).join(",");
  const headings=(html.match(/<h([1-6])[\s>]/g)||[]).map(x=>+x[2]); let badOrder=false; for(let i=1;i<headings.length;i++) if(headings[i]-headings[i-1]>1) badOrder=true;
  titles.set(p,title); descs.set(p,desc);
  console.log(p.padEnd(44), status, `t=${title?"Y":"N"} d=${desc?"Y":"N"} canon=${canon?"Y":"N"} robots=${robots??"-"} h1=${h1} lang=${lang} cs=${charset?"Y":"N"} vp=${viewport?"Y":"N"} og=${og?"Y":"N"} ogimg=${ogimg?"Y":"N"} tw=${tw?"Y":"N"} img=${imgs.length}/noalt=${noalt} hOrder=${badOrder?"skip":"ok"} ld=[${types}]`);
  if(p==="/") console.log("   headers:", ["cache-control","etag","last-modified","content-security-policy"].map(k=>k+"="+(h[k]?h[k].slice(0,40):"-")).join(" | "));
}
console.log("unique titles:", new Set(titles.values()).size, "/", titles.size, "| unique descs:", new Set(descs.values()).size, "/", descs.size);
console.log("=== robots.txt"); const rb=await get("/robots.txt"); console.log(rb.html.slice(0,700));
console.log("=== sitemap part 0 sample"); const sm=await get("/sitemap/0.xml"); console.log(sm.status, sm.html.slice(0,400).replace(/\s+/g," ")); console.log("has lastmod:", /<lastmod>/.test(sm.html), "| entries:", (sm.html.match(/<url>/g)||[]).length);
console.log("=== llms.txt", (await get("/llms.txt")).status, "| /sitemap.xml", (await get("/sitemap.xml")).status, "| bad slug 404:", (await get("/japanese/n1/grammar/nope")).status);
