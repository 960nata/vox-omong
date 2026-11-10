/**
 * Adegan motion graphic -> satu halaman HTML 1280x720 yang dianimasikan lalu direkam jadi video.
 * Bukan slide: latar bergerak terus, teks kinetik per kata, grafik yang menggambar dirinya,
 * kamera yang pelan-pelan maju, dan transisi sapuan warna antar adegan.
 * Fungsi murni (tanpa dependensi server) supaya gampang dites.
 */

export type SceneKind = "title" | "bullets" | "stat" | "chart" | "line" | "timeline" | "quote" | "end";

export interface Scene {
  kind: SceneKind;
  heading: string;
  text?: string;
  items?: string[];
  value?: string;
  label?: string;
  /** chart: batang berlabel */
  data?: { label: string; value: number | string }[];
  /** line: deret angka berurutan (mis. harga per jam/hari) */
  points?: (number | string)[];
  unit?: string;
  photo?: string;
  photoUrl?: string;
  seconds?: number;
}
export interface VideoScript { title: string; scenes: Scene[] }

export interface VideoTheme { bg: string; surface: string; text: string; muted: string; accent: string; accent2: string; cssDisplay: string; cssBody: string }

const KINDS: SceneKind[] = ["title", "bullets", "stat", "chart", "line", "timeline", "quote", "end"];
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** "7.215" / "1.250.000,5" / "12,5%" / 7215 -> angka; gagal -> NaN */
export function toNum(v: number | string | undefined): number {
  if (typeof v === "number") return v;
  const t = String(v ?? "").replace(/[^0-9.,-]/g, "");
  if (!t) return NaN;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ""));
  return Number(t.replace(",", "."));
}
const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toLocaleString("id-ID") : n.toLocaleString("id-ID", { maximumFractionDigits: 2 }));

const DEFAULT_SEC: Record<SceneKind, number> = { title: 4.5, bullets: 6.5, stat: 5, chart: 6.5, line: 6.5, timeline: 7, quote: 5, end: 4 };
export const secOf = (s: Scene) => Math.min(10, Math.max(3, Number(s.seconds) || DEFAULT_SEC[s.kind] || 5));
/** Durasi total termasuk transisi. */
export const totalSeconds = (v: VideoScript) => v.scenes.reduce((a, s) => a + secOf(s), 0) + 0.45 * Math.max(0, v.scenes.length - 1) + 0.6;

/** Buang adegan yang datanya tidak sah (mis. chart tanpa angka) supaya tidak ada layar kosong. */
export function cleanScript(v: VideoScript): VideoScript {
  const scenes = (Array.isArray(v.scenes) ? v.scenes : [])
    .filter((s) => s && typeof s.heading === "string" && s.heading.trim())
    .map((s): Scene => {
      const kind = KINDS.includes(s.kind) ? s.kind : "bullets";
      if (kind === "chart") {
        const data = (s.data || []).filter((d) => d && d.label && Number.isFinite(toNum(d.value))).slice(0, 6);
        return data.length >= 2 ? { ...s, kind, data } : { ...s, kind: s.items?.length ? "bullets" : "title" };
      }
      if (kind === "line") {
        const points = (s.points || []).map(toNum).filter(Number.isFinite).slice(0, 60);
        return points.length >= 3 ? { ...s, kind, points } : { ...s, kind: s.items?.length ? "bullets" : "title" };
      }
      if (kind === "stat" && !s.value) return { ...s, kind: "title" };
      if ((kind === "bullets" || kind === "timeline") && !(s.items || []).length) return { ...s, kind: "title" };
      return { ...s, kind };
    })
    .slice(0, 10);
  return { title: String(v.title || scenes[0]?.heading || "Video").slice(0, 120), scenes };
}

const kin = (t: string) =>
  t.split(/\s+/).filter(Boolean).map((w, i) => `<span class="w"><span style="--w:${i}">${esc(w)}</span></span>`).join(" ");

function lineSvg(s: Scene, i: number): string {
  const p = (s.points || []).map(toNum);
  const W = 1040, H = 330, min = Math.min(...p), max = Math.max(...p), span = max - min || 1;
  const xy = p.map((v, k) => [(k / (p.length - 1)) * W, H - 24 - ((v - min) / span) * (H - 60)] as const);
  const d = "M" + xy.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
  const [lx, ly] = xy[xy.length - 1];
  const chg = p[0] ? ((p[p.length - 1] - p[0]) / Math.abs(p[0])) * 100 : 0;
  const up = chg >= 0;
  const grid = [0, 1, 2, 3].map((g) => `<line class="gl" x1="0" x2="${W}" y1="${(24 + (g * (H - 60)) / 3 + 12).toFixed(0)}" y2="${(24 + (g * (H - 60)) / 3 + 12).toFixed(0)}"/>`).join("");
  return `<div class="lhead"><h2 class="kin">${kin(s.heading)}</h2><div class="chip pop ${up ? "" : "down"}" style="--k:3">${up ? "▲" : "▼"} ${fmt(Math.abs(chg))}%</div></div>
<div class="lwrap"><div class="yax pop" style="--k:1"><span>${fmt(max)}</span><span>${fmt(min)}</span></div>
<svg class="lsvg" viewBox="0 -10 ${W} ${H + 20}" preserveAspectRatio="none"><defs><linearGradient id="ag${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ac)" stop-opacity=".45"/><stop offset="1" stop-color="var(--ac)" stop-opacity="0"/></linearGradient></defs>${grid}<path class="area" d="${d} L${W} ${H} L0 ${H} Z" fill="url(#ag${i})"/><path class="ln" d="${d}" pathLength="1"/></svg>
<div class="ldot" style="left:${((lx / W) * 100).toFixed(2)}%;top:${(((ly + 10) / (H + 20)) * 100).toFixed(2)}%"><i></i><b>${fmt(p[p.length - 1])}${esc(s.unit || "")}</b></div></div>${s.text ? `<p class="pop sm" style="--k:5">${esc(s.text)}</p>` : ""}`;
}

function sceneHtml(s: Scene, i: number, n: number): string {
  const bg = s.photoUrl ? `<div class="ph"><div style="background-image:url('${esc(s.photoUrl)}')"></div></div><div class="veil"></div>` : "";
  let body = "";
  if (s.kind === "bullets") {
    body = `<h2 class="kin">${kin(s.heading)}</h2><div class="cards">${(s.items || []).slice(0, 4).map((t, k) => `<div class="card" style="--k:${k}"><b>${String(k + 1).padStart(2, "0")}</b><span>${esc(t)}</span></div>`).join("")}</div>`;
  } else if (s.kind === "stat") {
    body = `<div class="statrow"><div><div class="big" data-count="${esc(s.value || "")}">${esc(s.value || "")}</div><div class="under"></div><p class="pop" style="--k:2">${esc(s.label || s.heading)}</p>${s.text ? `<p class="pop sm" style="--k:3">${esc(s.text)}</p>` : ""}</div>
<svg class="ring" viewBox="0 0 220 220"><circle class="r0" cx="110" cy="110" r="96"/><circle class="r1" cx="110" cy="110" r="96" pathLength="1"/><circle class="r2" cx="110" cy="110" r="70" pathLength="1"/></svg></div>`;
  } else if (s.kind === "chart") {
    const vals = (s.data || []).map((d) => toNum(d.value));
    const max = Math.max(...vals.map(Math.abs)) || 1;
    body = `<h2 class="kin">${kin(s.heading)}</h2><div class="bars">${(s.data || []).map((d, k) => `<div class="bar" style="--k:${k};--h:${Math.max(4, (Math.abs(vals[k]) / max) * 100).toFixed(1)}%"><em data-count="${esc(fmt(vals[k]))}${esc(s.unit || "")}">${esc(fmt(vals[k]))}${esc(s.unit || "")}</em><i class="${vals[k] === Math.max(...vals) ? "top" : ""}"></i><span>${esc(d.label)}</span></div>`).join("")}</div>`;
  } else if (s.kind === "line") {
    body = lineSvg(s, i);
  } else if (s.kind === "timeline") {
    const it = (s.items || []).slice(0, 5);
    body = `<h2 class="kin">${kin(s.heading)}</h2><div class="tl" style="--n:${it.length}"><div class="tline"></div>${it.map((t, k) => `<div class="tp" style="--k:${k}"><i></i><b>${String(k + 1).padStart(2, "0")}</b><span>${esc(t)}</span></div>`).join("")}</div>`;
  } else if (s.kind === "quote") {
    body = `<div class="qm pop" style="--k:0">“</div><blockquote class="kin">${kin(s.text || s.heading)}</blockquote>${s.text ? `<p class="pop sm" style="--k:6">— ${esc(s.heading)}</p>` : ""}`;
  } else {
    body = `<div class="tag pop" style="--k:0">${s.kind === "end" ? "Penutup" : esc(s.label || "")}</div><h1 class="kin">${kin(s.heading)}</h1><div class="under"></div>${s.text ? `<p class="pop" style="--k:4">${esc(s.text)}</p>` : ""}`;
  }
  return `<section class="sc k-${s.kind}" data-sec="${secOf(s)}" style="--sec:${secOf(s)}s">${bg}<div class="in">${body}</div><div class="cnt">${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}</div></section>`;
}

export function scriptToHtml(script: VideoScript, t: VideoTheme): string {
  const v = cleanScript(script);
  const c = (h: string) => `#${h.replace(/^#/, "")}`;
  const E = "cubic-bezier(.2,.9,.2,1)";
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>${esc(v.title)}</title><style>
:root{--bg:${c(t.bg)};--sf:${c(t.surface)};--tx:${c(t.text)};--mu:${c(t.muted)};--ac:${c(t.accent)};--a2:${c(t.accent2)}}
*{box-sizing:border-box;margin:0}html,body{width:1280px;height:720px;overflow:hidden;background:var(--bg);color:var(--tx);font-family:${t.cssBody}}
/* latar yang terus bergerak */
.fx{position:fixed;inset:0;overflow:hidden}
.blob{position:absolute;width:760px;height:760px;border-radius:50%;filter:blur(110px);opacity:.34}
.b1{background:var(--ac);left:-260px;top:-320px;animation:d1 16s ease-in-out infinite alternate}
.b2{background:var(--a2);right:-300px;bottom:-360px;animation:d2 21s ease-in-out infinite alternate}
.grid{position:absolute;inset:-90px;opacity:.07;background-image:linear-gradient(var(--tx) 1px,transparent 1px),linear-gradient(90deg,var(--tx) 1px,transparent 1px);background-size:90px 90px;animation:pan 14s linear infinite}
.orb{position:absolute;border:2px solid var(--ac);border-radius:50%;opacity:.22}
.o1{width:340px;height:340px;right:-90px;top:-110px;animation:spin 40s linear infinite;border-style:dashed}
.o2{width:150px;height:150px;left:70px;bottom:-60px;animation:bob 9s ease-in-out infinite alternate;border-color:var(--a2)}
/* adegan */
.sc{position:absolute;inset:0;display:flex;align-items:center;padding:70px 110px;visibility:hidden}
.sc.on{visibility:visible}
.in{position:relative;width:100%;transform-origin:35% 50%}
.on .in{animation:cam var(--sec) linear both}
.bye .in{animation:bye .42s cubic-bezier(.6,0,.9,.4) both}
.cnt{position:absolute;right:56px;top:44px;font:600 15px/1 ui-monospace,Menlo,monospace;letter-spacing:.18em;color:var(--mu);opacity:0}
.on .cnt{animation:fade .6s .5s both}
.ph{position:absolute;inset:0;overflow:hidden;clip-path:inset(0 100% 0 0)}
.ph>div{position:absolute;inset:-6%;background-size:cover;background-position:center}
.on .ph{animation:reveal 1.1s ${E} both}.on .ph>div{animation:ken 11s ease-out both}
.veil{position:absolute;inset:0;background:linear-gradient(105deg,var(--bg) 22%,color-mix(in srgb,var(--bg) 78%,transparent) 58%,color-mix(in srgb,var(--bg) 35%,transparent))}
/* tipografi kinetik */
h1,h2,blockquote{font-family:${t.cssDisplay};letter-spacing:-.025em}
h1{font-size:88px;line-height:1.02;max-width:15ch}h2{font-size:54px;line-height:1.08;margin-bottom:38px;max-width:22ch}
blockquote{font-size:58px;line-height:1.14;max-width:20ch}
.w{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .04em .14em}
.w>span{display:inline-block;transform:translateY(115%) rotate(7deg);transform-origin:0 100%}
.on .w>span{animation:word .85s ${E} both;animation-delay:calc(.12s + var(--w)*.085s)}
p{font-size:28px;line-height:1.42;color:var(--mu);margin-top:22px;max-width:34ch}.sm{font-size:22px}
.pop{opacity:0}.on .pop{animation:rise .75s ${E} both;animation-delay:calc(.35s + var(--k)*.16s)}
.tag{display:inline-block;font:700 15px/1 ui-monospace,Menlo,monospace;letter-spacing:.22em;text-transform:uppercase;color:var(--ac);margin-bottom:26px}
.tag:empty{display:none}
.under{height:8px;width:220px;margin-top:30px;border-radius:9px;background:linear-gradient(90deg,var(--ac),var(--a2));transform:scaleX(0);transform-origin:left}
.on .under{animation:grow 1s ${E} .7s both}
/* kartu poin */
.cards{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.card{display:flex;gap:20px;align-items:center;padding:24px 28px;border-radius:20px;background:color-mix(in srgb,var(--sf) 82%,transparent);border:1px solid color-mix(in srgb,var(--tx) 14%,transparent);font-size:27px;line-height:1.25;opacity:0}
.card b{font:700 18px/1 ui-monospace,Menlo,monospace;color:var(--bg);background:var(--ac);border-radius:12px;padding:12px 11px;flex:none}
.on .card{animation:card .8s ${E} both;animation-delay:calc(.75s + var(--k)*.42s)}
/* angka besar */
.statrow{display:flex;align-items:center;justify-content:space-between;gap:40px}
.big{font-family:${t.cssDisplay};font-size:190px;font-weight:700;line-height:.95;letter-spacing:-.04em;background:linear-gradient(100deg,var(--ac),var(--a2));-webkit-background-clip:text;background-clip:text;color:transparent;opacity:0}
.on .big{animation:zoom .9s ${E} .1s both}
.ring{width:330px;height:330px;flex:none;overflow:visible}
.ring circle{fill:none;stroke-width:10}.r0{stroke:color-mix(in srgb,var(--tx) 12%,transparent)}
.r1{stroke:var(--ac);stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;transform-origin:center;transform:rotate(-90deg)}
.r2{stroke:var(--a2);stroke-width:4;stroke-dasharray:.02 .03;transform-origin:center}
.on .r1{animation:draw72 1.8s ${E} .3s both}.on .r2{animation:spin 18s linear infinite}
/* grafik batang */
.bars{display:flex;align-items:flex-end;gap:34px;height:360px;padding-top:48px}
.bar{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:12px;min-width:0}
.bar i{display:block;width:100%;height:var(--h);border-radius:16px 16px 4px 4px;background:color-mix(in srgb,var(--ac) 55%,var(--sf));transform:scaleY(0);transform-origin:bottom}
.bar i.top{background:linear-gradient(180deg,var(--ac),var(--a2))}
.bar em{font:700 26px/1 ${t.cssBody};font-style:normal;opacity:0}.bar span{font-size:20px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;opacity:0}
.on .bar i{animation:barUp 1s ${E} both;animation-delay:calc(.7s + var(--k)*.16s)}
.on .bar em{animation:rise .6s ${E} both;animation-delay:calc(1.4s + var(--k)*.16s)}.on .bar span{animation:fade .6s both;animation-delay:calc(.6s + var(--k)*.16s)}
/* grafik garis */
.lhead{display:flex;align-items:flex-start;justify-content:space-between;gap:24px}
.chip{font:700 26px/1 ${t.cssBody};padding:14px 20px;border-radius:99px;background:var(--ac);color:var(--bg);white-space:nowrap}
.chip.down{background:transparent;color:var(--tx);box-shadow:inset 0 0 0 2px var(--tx)}
.lwrap{position:relative;height:340px;margin-left:86px}
.yax{position:absolute;left:-86px;top:8px;bottom:22px;display:flex;flex-direction:column;justify-content:space-between;font:600 17px/1 ui-monospace,Menlo,monospace;color:var(--mu)}
.lsvg{width:100%;height:100%;overflow:visible}.gl{stroke:color-mix(in srgb,var(--tx) 13%,transparent);stroke-width:1.5;vector-effect:non-scaling-stroke}
.ln{fill:none;stroke:var(--ac);stroke-width:6;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;stroke-dasharray:1;stroke-dashoffset:1}
.area{opacity:0}.on .ln{animation:draw 2.4s cubic-bezier(.6,0,.2,1) .7s both}.on .area{animation:fade 1.2s 2.2s both}
.ldot{position:absolute;transform:translate(-50%,-50%);opacity:0}.on .ldot{animation:fade .3s 3s both}
.ldot i{display:block;width:20px;height:20px;border-radius:50%;background:var(--ac);box-shadow:0 0 0 0 var(--ac);animation:ping 1.4s ease-out 3s infinite}
.ldot b{position:absolute;right:26px;top:-38px;font:700 26px/1 ${t.cssBody};background:var(--tx);color:var(--bg);padding:9px 14px;border-radius:12px;white-space:nowrap}
/* linimasa */
.tl{position:relative;display:grid;grid-template-columns:repeat(var(--n),1fr);gap:22px;padding-top:44px}
.tline{position:absolute;left:0;right:0;top:12px;height:4px;border-radius:4px;background:linear-gradient(90deg,var(--ac),var(--a2));transform:scaleX(0);transform-origin:left}
.on .tline{animation:grow calc(.5s*var(--n) + .6s) linear .6s both}
.tp{position:relative;opacity:0;font-size:23px;line-height:1.3}.tp i{position:absolute;top:-43px;left:0;width:26px;height:26px;border-radius:50%;background:var(--bg);border:5px solid var(--ac)}
.tp b{display:block;font:700 16px/1 ui-monospace,Menlo,monospace;color:var(--ac);letter-spacing:.14em;margin-bottom:10px}
.on .tp{animation:rise .7s ${E} both;animation-delay:calc(.8s + var(--k)*.5s)}
.qm{font-family:${t.cssDisplay};font-size:200px;line-height:.6;color:var(--ac);height:90px}
.k-end .in{text-align:center}.k-end h1{margin-inline:auto}.k-end .under{margin-inline:auto;transform-origin:center}.k-end p{margin-inline:auto}
/* transisi sapuan */
.sh{position:fixed;inset:-2%;z-index:9;transform:translate(-104%,0);pointer-events:none}
#s1{background:var(--ac)}#s2{background:var(--tx)}
.sh.go{animation:sweep .86s cubic-bezier(.7,0,.25,1) both}#s2.go{animation-delay:.07s}
.v .sh{transform:translate(0,104%)}.v .sh.go{animation-name:sweepv}
#bar{position:fixed;left:0;bottom:0;height:6px;z-index:8;background:linear-gradient(90deg,var(--ac),var(--a2));width:100%;transform:scaleX(0);transform-origin:left}
#out{position:fixed;inset:0;z-index:10;background:var(--bg);opacity:0;pointer-events:none;transition:opacity .5s}
@keyframes d1{to{transform:translate(260px,180px) scale(1.25)}}@keyframes d2{to{transform:translate(-300px,-160px) scale(1.15)}}
@keyframes pan{to{transform:translate(90px,90px)}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes bob{to{transform:translate(60px,-90px) scale(1.3)}}
@keyframes cam{from{transform:scale(1)}to{transform:scale(1.05) translateX(10px)}}
@keyframes bye{to{transform:translateY(-46px) scale(.98);opacity:0}}
@keyframes word{to{transform:none}}@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes rise{from{opacity:0;transform:translateY(34px)}to{opacity:1;transform:none}}
@keyframes card{from{opacity:0;transform:translateX(-60px) scale(.94)}to{opacity:1;transform:none}}
@keyframes zoom{from{opacity:0;transform:scale(.6);filter:blur(14px)}to{opacity:1;transform:none;filter:none}}
@keyframes grow{to{transform:scaleX(1)}}@keyframes barUp{to{transform:scaleY(1)}}
@keyframes draw{to{stroke-dashoffset:0}}@keyframes draw72{to{stroke-dashoffset:.28}}
@keyframes reveal{to{clip-path:inset(0 0 0 0)}}@keyframes ken{from{transform:scale(1.12)}to{transform:scale(1)}}
@keyframes ping{to{box-shadow:0 0 0 26px transparent}}
@keyframes sweep{0%{transform:translate(-104%,0)}42%,58%{transform:none}100%{transform:translate(104%,0)}}
@keyframes sweepv{0%{transform:translate(0,104%)}42%,58%{transform:none}100%{transform:translate(0,-104%)}}
</style></head><body>
<div class="fx"><div class="blob b1"></div><div class="blob b2"></div><div class="grid"></div><div class="orb o1"></div><div class="orb o2"></div></div>
${v.scenes.map((s, i) => sceneHtml(s, i, v.scenes.length)).join("\n")}
<div class="sh" id="s1"></div><div class="sh" id="s2"></div><div id="bar"></div><div id="out"></div>
<script>
(function(){
var sc=[].slice.call(document.querySelectorAll('.sc')),bar=document.getElementById('bar'),s1=document.getElementById('s1'),s2=document.getElementById('s2');
var total=sc.reduce(function(a,s){return a+ +s.dataset.sec},0)+0.45*(sc.length-1);
function count(el,delay){var raw=el.getAttribute('data-count')||'',m=raw.match(/^([^0-9-]*)(-?[0-9][0-9.,]*)(.*)$/);if(!m)return;
 var thou=/^-?[0-9]{1,3}([.,][0-9]{3})+$/.test(m[2]),dec=!thou&&/[.,]/.test(m[2]),n=parseFloat(thou?m[2].replace(/[.,]/g,''):m[2].replace(',','.'));if(isNaN(n))return;
 el.textContent=m[1]+'0'+m[3];
 setTimeout(function(){var t0=performance.now();(function f(t){var p=Math.min(1,(t-t0)/1500),e=1-Math.pow(1-p,4),v=n*e;
  el.textContent=m[1]+(dec?v.toFixed(m[2].split(/[.,]/)[1].length).replace('.',','):Math.round(v).toLocaleString('id-ID'))+m[3];if(p<1)requestAnimationFrame(f)})(t0)},delay)}
function show(i){var s=sc[i];s.classList.add('on');[].forEach.call(s.querySelectorAll('[data-count]'),function(el,k){count(el,s.classList.contains('k-chart')?1400+k*160:250)})}
function sweep(i){document.body.classList.toggle('v',i%2===1);[s1,s2].forEach(function(x){x.classList.remove('go');void x.offsetWidth;x.classList.add('go')})}
window.__start=function(){var i=0;bar.style.transition='transform '+total+'s linear';requestAnimationFrame(function(){bar.style.transform='scaleX(1)'});show(0);
 (function loop(){var cur=sc[i];setTimeout(function(){
  if(i>=sc.length-1){document.getElementById('out').style.opacity=1;setTimeout(function(){window.__done=true},600);return}
  cur.classList.add('bye');sweep(i);
  setTimeout(function(){cur.classList.remove('on','bye');i++;show(i);loop()},400)
 },+cur.dataset.sec*1000)})()};
window.__total=total+0.6;
if(!window.__headless)addEventListener('load',function(){setTimeout(window.__start,150)});
})();
</script></body></html>`;
}
