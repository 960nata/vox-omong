/**
 * CSS + JavaScript untuk website yang dirakit dari komponen (siteComposer).
 * Semua warna/font/radius datang dari CSS variables, jadi satu set komponen bisa tampil
 * sangat berbeda (hangat, mewah gelap, berani, futuristik, …) tanpa model menulis HTML.
 */

export const SITE_CSS = String.raw`
*,*::before,*::after{box-sizing:border-box}
*{margin:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--ink);font-family:var(--f-body),system-ui,-apple-system,"Segoe UI",sans-serif;font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:hidden}
body.lock{overflow:hidden}
img,svg{display:block;max-width:100%}
a{color:inherit}
button{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}
::selection{background:color-mix(in srgb,var(--accent) 28%,transparent)}

.wrap{width:min(1180px,100% - clamp(32px,8vw,88px));margin-inline:auto}
section{padding-block:clamp(72px,10vw,136px);position:relative}
h1,h2,h3,h4{font-family:var(--f-display),var(--f-body),Georgia,serif;line-height:1.06;letter-spacing:-.02em;font-weight:700;text-wrap:balance}
h1{font-size:clamp(42px,7.4vw,92px)}
h2{font-size:clamp(32px,4.8vw,60px)}
h3{font-size:clamp(20px,2vw,25px);line-height:1.2;letter-spacing:-.01em}
p{text-wrap:pretty}
em{font-style:italic;color:var(--accent);font-weight:inherit}
.eyebrow{font-family:var(--f-mono),ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-weight:600;display:inline-flex;align-items:center;gap:12px}
.eyebrow::before{content:"";width:30px;height:1.5px;background:currentColor;opacity:.8}
.lead{font-size:clamp(17px,1.55vw,20px);color:var(--muted);max-width:58ch}
.sec-head{max-width:780px;margin-bottom:clamp(36px,5vw,68px)}
.sec-head h2{margin:16px 0 16px}
.sec-head.center{margin-inline:auto;text-align:center}
.sec-head.center .lead{margin-inline:auto}
.sec-head.center .eyebrow::after{content:"";width:30px;height:1.5px;background:currentColor;opacity:.8}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:15px 28px;border-radius:var(--rb);font-weight:600;font-size:16px;line-height:1;text-decoration:none;border:1.5px solid transparent;cursor:pointer;transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,background .25s,color .25s,border-color .25s;white-space:nowrap}
.btn svg{width:18px;height:18px;transition:transform .25s}
.btn:hover svg{transform:translateX(3px)}
.btn:active{transform:scale(.97)}
.btn-primary{background:var(--accent);color:var(--accent-ink);box-shadow:0 10px 28px -12px color-mix(in srgb,var(--accent) 80%,transparent)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 16px 34px -12px color-mix(in srgb,var(--accent) 90%,transparent)}
.btn-ghost{background:transparent;border-color:color-mix(in srgb,var(--ink) 28%,transparent);color:var(--ink)}
.btn-ghost:hover{border-color:var(--ink);background:color-mix(in srgb,var(--ink) 6%,transparent)}
.btn-sm{padding:11px 20px;font-size:14.5px}

/* ---------- navbar ---------- */
.nav{position:fixed;inset:0 0 auto 0;z-index:60;padding:20px 0;transition:background .3s,box-shadow .3s,padding .3s,backdrop-filter .3s}
.nav.scrolled{background:color-mix(in srgb,var(--bg) 84%,transparent);backdrop-filter:blur(16px) saturate(1.4);-webkit-backdrop-filter:blur(16px) saturate(1.4);box-shadow:0 1px 0 var(--line);padding:12px 0}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;gap:28px}
.logo{font-family:var(--f-display),serif;font-weight:700;font-size:23px;letter-spacing:-.02em;text-decoration:none;display:inline-flex;align-items:center;gap:11px;line-height:1}
.logo i{width:13px;height:13px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 5px color-mix(in srgb,var(--accent) 22%,transparent);flex:none}
.links{display:flex;align-items:center;gap:clamp(20px,2.6vw,36px)}
.links a{font-size:15px;font-weight:500;text-decoration:none;color:var(--muted);position:relative;padding:6px 0;transition:color .2s}
.links a::after{content:"";position:absolute;left:0;right:100%;bottom:0;height:1.5px;background:var(--accent);transition:right .3s cubic-bezier(.2,.8,.2,1)}
.links a:hover,.links a.on{color:var(--ink)}
.links a:hover::after,.links a.on::after{right:0}
.nav-cta{display:flex;align-items:center;gap:12px}
.cart-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--ink) 22%,transparent);background:transparent;cursor:pointer;transition:background .2s,transform .2s}
.cart-btn:hover{background:color-mix(in srgb,var(--ink) 7%,transparent);transform:translateY(-1px)}
.cart-btn svg{width:20px;height:20px}
.cart-btn b{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:var(--accent);color:var(--accent-ink);font-size:11px;display:grid;place-items:center;transform:scale(0);transition:transform .3s cubic-bezier(.3,1.6,.5,1)}
.cart-btn b.has{transform:scale(1)}
.burger{display:none;width:46px;height:46px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--ink) 22%,transparent);background:transparent;cursor:pointer;align-items:center;justify-content:center;flex-direction:column;gap:5px}
.burger span{width:18px;height:1.8px;background:currentColor;transition:transform .3s,opacity .3s}
.burger[aria-expanded=true] span:nth-child(1){transform:translateY(6.8px) rotate(45deg)}
.burger[aria-expanded=true] span:nth-child(2){opacity:0}
.burger[aria-expanded=true] span:nth-child(3){transform:translateY(-6.8px) rotate(-45deg)}
.nav.on-dark:not(.scrolled) .logo,.nav.on-dark:not(.scrolled) .links a,.nav.on-dark:not(.scrolled) .cart-btn,.nav.on-dark:not(.scrolled) .burger{color:#fff}
.nav.on-dark:not(.scrolled) .links a:hover{color:#fff}
.nav.on-dark:not(.scrolled) .cart-btn,.nav.on-dark:not(.scrolled) .burger{border-color:rgba(255,255,255,.4)}
.mmenu{position:fixed;inset:0;z-index:55;background:var(--bg);display:flex;flex-direction:column;justify-content:center;gap:6px;padding:90px 8vw 40px;transform:translateY(-100%);transition:transform .5s cubic-bezier(.7,0,.2,1)}
.mmenu.open{transform:none}
.mmenu a{font-family:var(--f-display),serif;font-size:clamp(30px,8vw,44px);font-weight:700;letter-spacing:-.02em;text-decoration:none;padding:8px 0;border-bottom:1px solid var(--line)}
@media(max-width:900px){.links,.nav-cta .btn{display:none}.burger{display:inline-flex}}

/* ---------- hero ---------- */
.hero{padding-top:clamp(120px,15vw,190px);padding-bottom:clamp(64px,9vw,120px);overflow:hidden}
.hero::before{content:"";position:absolute;width:min(720px,80vw);aspect-ratio:1;right:-12%;top:-18%;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 22%,transparent),transparent 68%);filter:blur(10px);pointer-events:none}
.hero h1{margin:22px 0 24px;max-width:15ch}
.hero .lead{margin-bottom:36px}
.cta-row{display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.hero-split .wrap{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(32px,6vw,84px);align-items:center}
.hero .media{position:relative}
.hero .media .ph{aspect-ratio:4/5;border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow);transform:rotate(1.2deg);background:var(--line)}
.hero .media img{width:100%;height:100%;object-fit:cover}
.hero .media::after{content:"";position:absolute;inset:auto auto -22px -22px;width:46%;aspect-ratio:1;border-radius:var(--r-lg);border:1.5px solid var(--accent);opacity:.55;z-index:-1}
.badge{position:absolute;left:-18px;bottom:36px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px 18px;box-shadow:var(--shadow);display:flex;align-items:center;gap:12px;font-weight:600;font-size:15px;animation:float 6s ease-in-out infinite}
.badge svg{width:26px;height:26px;color:var(--accent)}
.badge small{display:block;font-weight:500;color:var(--muted);font-size:12.5px}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.hero-stats{display:flex;flex-wrap:wrap;gap:clamp(22px,4vw,48px);margin-top:clamp(36px,5vw,56px);padding-top:28px;border-top:1px solid var(--line)}
.hero-stats b{display:block;font-family:var(--f-display),serif;font-size:clamp(28px,3.4vw,40px);letter-spacing:-.02em;line-height:1}
.hero-stats span{font-size:14px;color:var(--muted)}
.hero-full{min-height:min(100vh,920px);display:flex;align-items:flex-end;color:#fff;padding-bottom:clamp(56px,8vw,110px)}
.hero-full::before{display:none}
.hero-full .bg{position:absolute;inset:0}
.hero-full .bg img{width:100%;height:100%;object-fit:cover;transform:scale(1.06);animation:kenburns 22s ease-out forwards}
.hero-full .bg::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.38) 50%,rgba(0,0,0,.08) 100%),linear-gradient(180deg,rgba(0,0,0,.42) 0%,rgba(0,0,0,.12) 38%,rgba(0,0,0,.82) 100%)}
@keyframes kenburns{to{transform:scale(1)}}
.hero-full .wrap{position:relative}
.hero-full .lead{color:rgba(255,255,255,.86)}
.hero-full .eyebrow{color:#fff}
.hero-full .btn-ghost{color:#fff;border-color:rgba(255,255,255,.55)}
.hero-full .btn-ghost:hover{background:rgba(255,255,255,.14);border-color:#fff}
.hero-full .hero-stats{border-color:rgba(255,255,255,.28)}
.hero-full .hero-stats span{color:rgba(255,255,255,.78)}
.hero-center{text-align:center}
.hero-center .wrap{display:flex;flex-direction:column;align-items:center}
.hero-center h1{max-width:18ch}
.hero-center .lead{margin-inline:auto}
.hero-center .cta-row{justify-content:center}
.hero-center .strip{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:clamp(40px,6vw,72px);width:100%}
.hero-center .strip .ph{aspect-ratio:3/4;border-radius:var(--r-lg);overflow:hidden;background:var(--line)}
.hero-center .strip .ph:nth-child(2){transform:translateY(-28px)}
.hero-center .strip img{width:100%;height:100%;object-fit:cover}
@media(max-width:860px){.hero-split .wrap{grid-template-columns:1fr}.hero .media{max-width:520px}.badge{left:12px}.hero-center .strip{grid-template-columns:1fr 1fr}.hero-center .strip .ph:nth-child(3){display:none}}

/* ---------- marquee ---------- */
.marquee{padding-block:22px;border-block:1px solid var(--line);overflow:hidden;background:var(--surface)}
.marquee .track{display:flex;gap:56px;width:max-content;animation:slide 38s linear infinite}
.marquee:hover .track{animation-play-state:paused}
.marquee span{font-family:var(--f-display),serif;font-size:clamp(20px,2.4vw,30px);font-weight:600;letter-spacing:-.01em;white-space:nowrap;display:inline-flex;align-items:center;gap:56px;color:var(--ink)}
.marquee span::after{content:"";width:9px;height:9px;border-radius:50%;background:var(--accent)}
@keyframes slide{to{transform:translateX(-50%)}}

/* ---------- cards / grids ---------- */
.grid{display:grid;gap:clamp(16px,2.4vw,30px)}
.g3,.g2{display:flex;flex-wrap:wrap;justify-content:center;align-items:stretch}
.g3>*{flex:1 1 min(100%,300px);max-width:440px}
.g2>*{flex:1 1 min(100%,420px);max-width:640px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;transition:transform .4s cubic-bezier(.2,.8,.2,1),box-shadow .4s,border-color .3s}
.card:hover{transform:translateY(-6px);box-shadow:var(--shadow);border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.feat{padding:clamp(24px,2.6vw,34px);display:grid;gap:14px;align-content:start}
.ico{width:52px;height:52px;border-radius:calc(var(--r) * .8);display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);transition:transform .4s,background .3s,color .3s}
.ico svg{width:26px;height:26px}
.feat:hover .ico{background:var(--accent);color:var(--accent-ink);transform:rotate(-6deg) scale(1.05)}
.feat p{color:var(--muted);font-size:16px}

/* ---------- products ---------- */
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:clamp(24px,3vw,40px)}
.chips button{padding:10px 20px;border-radius:999px;border:1px solid var(--line);background:var(--surface);cursor:pointer;font-weight:500;font-size:15px;transition:all .25s}
.chips button:hover{border-color:var(--accent)}
.chips button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.pcard{display:flex;flex-direction:column}
.pcard .ph{aspect-ratio:4/3;overflow:hidden;background:var(--line);position:relative}
.pcard .ph img{width:100%;height:100%;object-fit:cover;transition:transform .9s cubic-bezier(.2,.8,.2,1)}
.pcard:hover .ph img{transform:scale(1.07)}
.pcard .tag{position:absolute;top:14px;left:14px;padding:6px 12px;border-radius:99px;background:var(--bg);color:var(--ink);font-size:12.5px;font-weight:700;letter-spacing:.02em;box-shadow:0 4px 14px rgba(0,0,0,.14)}
.pcard .pb{padding:22px 24px 24px;display:flex;flex-direction:column;gap:8px;flex:1}
.pcard .pb p{color:var(--muted);font-size:15.5px;flex:1}
.pcard .row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px}
.price{font-family:var(--f-display),serif;font-weight:700;font-size:22px;color:var(--accent);letter-spacing:-.01em}
.add{width:46px;height:46px;border-radius:50%;border:0;cursor:pointer;background:var(--ink);color:var(--bg);display:grid;place-items:center;transition:transform .25s cubic-bezier(.3,1.6,.5,1),background .25s}
.add:hover{background:var(--accent);color:var(--accent-ink);transform:scale(1.1) rotate(90deg)}
.add svg{width:20px;height:20px}
.pcard[hidden]{display:none}

/* ---------- cart drawer ---------- */
.veil{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .35s;z-index:70}
.veil.open{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(440px,100%);background:var(--bg);z-index:80;display:flex;flex-direction:column;transform:translateX(105%);transition:transform .5s cubic-bezier(.7,0,.2,1);box-shadow:-30px 0 60px -30px rgba(0,0,0,.4);border-left:1px solid var(--line)}
.drawer.open{transform:none}
.drawer header{display:flex;align-items:center;justify-content:space-between;padding:22px 26px;border-bottom:1px solid var(--line)}
.drawer header h3{font-size:24px}
.x{width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:var(--surface);cursor:pointer;display:grid;place-items:center;transition:transform .3s}
.x:hover{transform:rotate(90deg)}
.x svg{width:18px;height:18px}
.lines{flex:1;overflow:auto;padding:8px 26px}
.line{display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:center;padding:16px 0;border-bottom:1px solid var(--line)}
.line img,.line .ph0{width:64px;height:64px;border-radius:calc(var(--r) * .7);object-fit:cover;background:var(--line)}
.line b{display:block;font-size:16px;line-height:1.3}
.line small{color:var(--muted)}
.qty{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--line);border-radius:99px;padding:3px;margin-top:6px}
.qty button{width:28px;height:28px;border-radius:50%;border:0;background:transparent;cursor:pointer;font-size:17px;line-height:1}
.qty button:hover{background:var(--line)}
.qty span{min-width:22px;text-align:center;font-weight:600;font-size:14px}
.empty{padding:56px 10px;text-align:center;color:var(--muted)}
.drawer footer{padding:22px 26px 26px;border-top:1px solid var(--line);display:grid;gap:12px;background:var(--surface)}
.total{display:flex;justify-content:space-between;align-items:baseline;font-size:15px;color:var(--muted)}
.total b{font-family:var(--f-display),serif;font-size:28px;color:var(--ink)}
.drawer input{font:inherit;padding:13px 15px;border-radius:calc(var(--r) * .75);border:1.5px solid var(--line);background:var(--bg);color:var(--ink);width:100%}
.drawer input:focus{outline:0;border-color:var(--accent)}
.ok{padding:14px 16px;border-radius:calc(var(--r) * .75);background:color-mix(in srgb,var(--accent) 14%,transparent);font-weight:600;font-size:15px}

/* ---------- gallery ---------- */
.masonry{columns:3 260px;column-gap:clamp(12px,1.6vw,20px)}
.masonry figure{break-inside:avoid;margin-bottom:clamp(12px,1.6vw,20px);border-radius:var(--r);overflow:hidden;cursor:zoom-in;position:relative;background:var(--line)}
.masonry img{width:100%;height:auto;transition:transform .9s cubic-bezier(.2,.8,.2,1),filter .4s}
.masonry figure:hover img{transform:scale(1.05)}
.lb{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.92);display:grid;place-items:center;padding:24px;opacity:0;pointer-events:none;transition:opacity .3s}
.lb.open{opacity:1;pointer-events:auto}
.lb img{max-height:88vh;max-width:min(1200px,94vw);border-radius:var(--r);box-shadow:0 30px 80px rgba(0,0,0,.6)}
.lb .x{position:absolute;top:20px;right:20px;background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.3);color:#fff}

/* ---------- about ---------- */
.split{display:grid;grid-template-columns:1.02fr .98fr;gap:clamp(32px,7vw,110px);align-items:center}
.split.flip .pic{order:2}
.pic{position:relative}
.pic .ph{aspect-ratio:5/6;border-radius:var(--r-lg);overflow:hidden;background:var(--line);box-shadow:var(--shadow)}
.pic img{width:100%;height:100%;object-fit:cover}
.pic::before{content:"";position:absolute;inset:-16px 16px 16px -16px;border:1.5px solid var(--accent);border-radius:var(--r-lg);opacity:.5}
.copy p{color:var(--muted);margin-bottom:16px;max-width:56ch}
.copy h2{margin:16px 0 22px}
.points{list-style:none;padding:0;margin:26px 0 0;display:grid;gap:14px}
.points li{display:flex;gap:14px;align-items:flex-start;font-weight:500}
.points svg{width:22px;height:22px;color:var(--accent);flex:none;margin-top:2px}
@media(max-width:860px){.split{grid-template-columns:1fr}.split.flip .pic{order:0}.pic{max-width:480px}}

/* ---------- steps / stats ---------- */
.steps{counter-reset:s;display:grid;gap:clamp(16px,2.4vw,28px);grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
.step{padding:30px 28px;border-radius:var(--r);border:1px solid var(--line);background:var(--surface);position:relative;counter-increment:s}
.step::before{content:counter(s,decimal-leading-zero);font-family:var(--f-display),serif;font-size:56px;font-weight:700;line-height:1;color:transparent;-webkit-text-stroke:1.5px color-mix(in srgb,var(--accent) 70%,transparent);display:block;margin-bottom:18px}
.step p{color:var(--muted);font-size:16px;margin-top:8px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:clamp(20px,3vw,44px);text-align:center}
.stat b{display:block;font-family:var(--f-display),serif;font-size:clamp(44px,6vw,76px);line-height:1;letter-spacing:-.03em;color:var(--accent)}
.stat span{display:block;margin-top:10px;color:var(--muted);font-size:15.5px}
.band{background:var(--surface);border-block:1px solid var(--line)}

/* ---------- testimonials ---------- */
.quote{padding:clamp(26px,3vw,38px);display:flex;flex-direction:column;gap:22px;position:relative}
.quote::before{content:"\201C";font-family:var(--f-display),serif;font-size:96px;line-height:.6;color:var(--accent);opacity:.9;height:40px}
.quote p{font-size:clamp(17px,1.5vw,19px);line-height:1.6;flex:1}
.who{display:flex;align-items:center;gap:14px}
.av{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));color:var(--accent-ink);display:grid;place-items:center;font-weight:700;font-size:16px;flex:none}
.who b{display:block;line-height:1.2}
.who small{color:var(--muted)}

/* ---------- pricing ---------- */
.plan{padding:clamp(28px,3vw,40px);display:flex;flex-direction:column;gap:20px;position:relative}
.plan.hi{border-color:var(--accent);box-shadow:0 30px 70px -30px color-mix(in srgb,var(--accent) 60%,transparent);transform:translateY(-10px)}
.plan.hi:hover{transform:translateY(-16px)}
.plan .pill{position:absolute;top:-14px;left:50%;translate:-50% 0;padding:6px 16px;border-radius:99px;background:var(--accent);color:var(--accent-ink);font-size:12.5px;font-weight:700;letter-spacing:.04em;white-space:nowrap}
.plan .amt{font-family:var(--f-display),serif;font-size:clamp(38px,4vw,52px);font-weight:700;letter-spacing:-.03em;line-height:1}
.plan .amt small{font-family:var(--f-body),sans-serif;font-size:15px;font-weight:500;color:var(--muted);letter-spacing:0}
.plan ul{list-style:none;padding:0;display:grid;gap:12px;flex:1}
.plan li{display:flex;gap:12px;align-items:flex-start;font-size:16px}
.plan li svg{width:20px;height:20px;color:var(--accent);flex:none;margin-top:3px}
.plan .btn{width:100%}

/* ---------- faq ---------- */
.faq{max-width:860px;margin-inline:auto;display:grid;gap:12px}
.faq details{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:0 26px;transition:border-color .3s,box-shadow .3s}
.faq details[open]{border-color:color-mix(in srgb,var(--accent) 50%,var(--line));box-shadow:var(--shadow)}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 0;font-family:var(--f-display),serif;font-size:clamp(18px,1.8vw,21px);font-weight:600;letter-spacing:-.01em}
.faq summary::-webkit-details-marker{display:none}
.faq summary i{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--line);position:relative;flex:none;transition:transform .35s,background .3s,border-color .3s}
.faq summary i::before,.faq summary i::after{content:"";position:absolute;left:50%;top:50%;width:12px;height:1.8px;background:currentColor;translate:-50% -50%}
.faq summary i::after{rotate:90deg;transition:rotate .35s}
.faq details[open] summary i{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);transform:rotate(180deg)}
.faq details[open] summary i::after{rotate:0deg}
.faq .ans{padding:0 0 24px;color:var(--muted);max-width:68ch}

/* ---------- video ---------- */
.vframe{position:relative;aspect-ratio:16/9;border-radius:var(--r-lg);overflow:hidden;background:#000;box-shadow:var(--shadow)}
.vframe img,.vframe iframe{position:absolute;inset:0;width:100%;height:100%;border:0;object-fit:cover}
.vframe .play{position:absolute;inset:0;width:100%;border:0;cursor:pointer;display:grid;place-items:center;background:linear-gradient(0deg,rgba(0,0,0,.55),rgba(0,0,0,.1))}
.vframe .play span{width:92px;height:92px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;transition:transform .3s cubic-bezier(.3,1.6,.5,1);box-shadow:0 0 0 14px color-mix(in srgb,var(--accent) 28%,transparent)}
.vframe .play:hover span{transform:scale(1.1)}
.vframe .play svg{width:34px;height:34px;margin-left:4px}
.credit{margin-top:14px;font-size:14px;color:var(--muted)}
.credit a{text-underline-offset:3px}

/* ---------- forms / contact ---------- */
.contact{display:grid;grid-template-columns:1fr 1fr;gap:clamp(28px,5vw,72px);align-items:start}
@media(max-width:860px){.contact{grid-template-columns:1fr}}
.form{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:clamp(24px,3vw,40px)}
.form label{display:grid;gap:7px;font-size:14.5px;font-weight:600}
.form .wide{grid-column:1/-1}
.form input,.form textarea,.form select{font:inherit;font-weight:400;color:var(--ink);background:var(--bg);border:1.5px solid var(--line);border-radius:calc(var(--r) * .75);padding:14px 16px;min-height:50px;width:100%;transition:border-color .2s,box-shadow .2s}
.form textarea{min-height:120px;resize:vertical}
.form input:focus,.form textarea:focus,.form select:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent)}
.form .btn{grid-column:1/-1}
.form .ok{grid-column:1/-1}
@media(max-width:560px){.form{grid-template-columns:1fr}}
.info{display:grid;gap:14px}
.irow{display:flex;gap:16px;align-items:flex-start;padding:22px 24px}
.irow .ico{flex:none}
.irow b{display:block;margin-bottom:2px;font-size:16px}
.irow p,.irow li{color:var(--muted);font-size:15.5px}
.irow>div:last-child{flex:1;min-width:0}
.irow ul{list-style:none;padding:0;display:grid;gap:4px;width:100%}
.irow li{display:flex;justify-content:space-between;gap:20px}
.irow li span:last-child{color:var(--ink);font-weight:600}
.map{position:relative;height:200px;border-radius:var(--r);border:1px solid var(--line);overflow:hidden;background:
 linear-gradient(90deg,transparent 49%,color-mix(in srgb,var(--ink) 9%,transparent) 50%,transparent 51%) 0 0/70px 70px,
 linear-gradient(0deg,transparent 49%,color-mix(in srgb,var(--ink) 9%,transparent) 50%,transparent 51%) 0 0/70px 70px,
 color-mix(in srgb,var(--accent) 8%,var(--surface))}
.map::before{content:"";position:absolute;left:-10%;right:-10%;top:55%;height:26px;background:color-mix(in srgb,var(--accent) 18%,transparent);transform:rotate(-8deg)}
.map i{position:absolute;left:50%;top:46%;width:22px;height:22px;border-radius:50% 50% 50% 0;background:var(--accent);transform:translate(-50%,-50%) rotate(-45deg);box-shadow:0 0 0 10px color-mix(in srgb,var(--accent) 24%,transparent);animation:ping 2.4s ease-out infinite}
.map i::after{content:"";position:absolute;inset:6px;border-radius:50%;background:var(--accent-ink)}
.map.real{height:300px;background:var(--surface)}
.map.real::before{display:none}
.map.real iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.maplink{position:absolute;left:12px;bottom:12px;z-index:2;padding:7px 12px;border-radius:99px;background:var(--surface);color:var(--ink);font-size:13px;font-weight:600;text-decoration:none;border:1px solid var(--line);box-shadow:0 4px 14px rgba(0,0,0,.18)}
@keyframes ping{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 45%,transparent)}100%{box-shadow:0 0 0 22px transparent}}

/* ---------- cta / footer ---------- */
.cta{border-radius:calc(var(--r-lg) * 1.15);padding:clamp(40px,7vw,96px) clamp(24px,6vw,80px);background:var(--accent);color:var(--accent-ink);text-align:center;position:relative;overflow:hidden;isolation:isolate}
.cta::before,.cta::after{content:"";position:absolute;border-radius:50%;z-index:-1;background:color-mix(in srgb,var(--accent-ink) 12%,transparent)}
.cta::before{width:420px;aspect-ratio:1;left:-120px;bottom:-200px}
.cta::after{width:300px;aspect-ratio:1;right:-80px;top:-140px}
.cta h2{max-width:18ch;margin:0 auto 16px}
.cta p{max-width:52ch;margin:0 auto 32px;opacity:.88}
.cta .btn{background:var(--accent-ink);color:var(--accent)}
.cta em{color:inherit;text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:6px}
footer.site{background:var(--surface);border-top:1px solid var(--line);padding:clamp(48px,6vw,80px) 0 28px}
.fgrid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:clamp(28px,5vw,64px);padding-bottom:40px;border-bottom:1px solid var(--line)}
.fgrid p{color:var(--muted);max-width:38ch;margin-top:14px;font-size:15.5px}
.fgrid h4{font-family:var(--f-mono),monospace;font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:16px}
.fgrid ul{list-style:none;padding:0;display:grid;gap:10px}
.fgrid a{text-decoration:none;font-size:15.5px;transition:color .2s}
.fgrid a:hover{color:var(--accent)}
.fbase{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding-top:24px;font-size:13.5px;color:var(--muted)}
.fbase a{text-underline-offset:3px}
@media(max-width:760px){.fgrid{grid-template-columns:1fr}}

/* ---------- reveal ---------- */
.rv{opacity:0;transform:translateY(26px);transition:opacity .9s cubic-bezier(.2,.8,.2,1),transform .9s cubic-bezier(.2,.8,.2,1);transition-delay:var(--d,0ms)}
.rv.in{opacity:1;transform:none}
.hero .rv{transition-duration:1.1s}

/* ---------- gaya ---------- */
.r-sharp{--r:3px;--r-lg:4px;--rb:3px}
.r-soft{--r:16px;--r-lg:28px;--rb:12px}
.r-round{--r:24px;--r-lg:40px;--rb:999px}
.st-luxury h1,.st-luxury h2,.st-luxury h3{font-weight:500;letter-spacing:.005em}
.st-luxury .eyebrow{letter-spacing:.32em;font-size:11.5px}
.st-luxury .card{background:transparent}
.st-luxury .btn{text-transform:uppercase;letter-spacing:.14em;font-size:13px;font-weight:600}
.st-bold h1,.st-bold h2{text-transform:uppercase;font-weight:800;letter-spacing:-.035em;line-height:.94}
.st-bold h1{font-size:clamp(44px,8.4vw,112px)}
.st-bold .card,.st-bold .faq details,.st-bold .step{border:2px solid var(--ink);box-shadow:6px 6px 0 var(--ink);border-radius:var(--r)}
.st-bold .card:hover,.st-bold .step:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 var(--ink)}
.st-bold .btn{border:2px solid var(--ink);box-shadow:4px 4px 0 var(--ink)}
.st-bold .btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--ink)}
.st-bold .btn-primary,.st-bold .btn-ghost{color:var(--ink)}
.st-bold .btn-primary{background:var(--accent)}
.st-bold .hero::before{display:none}
.st-tech .eyebrow,.st-tech .price,.st-tech .hero-stats b,.st-tech .stat b{font-family:var(--f-mono),monospace}
.st-tech body,body.st-tech{background-image:linear-gradient(color-mix(in srgb,var(--ink) 4%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--ink) 4%,transparent) 1px,transparent 1px);background-size:56px 56px}
.st-tech .card{backdrop-filter:blur(8px);background:color-mix(in srgb,var(--surface) 80%,transparent)}
.st-tech .btn-primary{box-shadow:0 0 28px -4px color-mix(in srgb,var(--accent) 70%,transparent)}
.st-tech h1 em,.st-tech h2 em{text-shadow:0 0 24px color-mix(in srgb,var(--accent) 60%,transparent)}
.st-playful h1,.st-playful h2{font-weight:800}
.st-playful .card:nth-child(odd){rotate:-.6deg}
.st-playful .card:nth-child(even){rotate:.6deg}
.st-playful .card:hover{rotate:0deg}
.st-editorial h1,.st-editorial h2{font-weight:500;letter-spacing:-.025em}
.st-editorial h1{font-size:clamp(46px,8.2vw,104px);line-height:.98}
.st-soft .card{box-shadow:0 1px 2px rgba(0,0,0,.03)}
.st-vintage{background-image:radial-gradient(rgba(60,40,20,.05) 1px,transparent 1.3px),radial-gradient(rgba(60,40,20,.035) 1px,transparent 1.3px);background-size:23px 23px,37px 37px;background-position:0 0,11px 17px}
.st-vintage h1,.st-vintage h2{letter-spacing:-.01em}
.st-vintage .eyebrow{letter-spacing:.24em}
.st-vintage .eyebrow::before{content:"\2726";width:auto;height:auto;background:none;font-size:12px}
.st-vintage .card,.st-vintage .faq details,.st-vintage .step{border:1.5px solid color-mix(in srgb,var(--ink) 55%,transparent);outline:1px solid color-mix(in srgb,var(--ink) 18%,transparent);outline-offset:4px;box-shadow:none}
.st-vintage .card:hover,.st-vintage .step:hover{transform:translateY(-3px);box-shadow:none;border-color:var(--ink)}
.st-vintage .btn{text-transform:uppercase;letter-spacing:.12em;font-size:13.5px}
.st-vintage .btn-primary{box-shadow:3px 3px 0 var(--ink)}
.st-vintage .btn-primary:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--ink)}
.st-vintage .ph img,.st-vintage .masonry img,.st-vintage .hero-full .bg img,.st-vintage .vframe img{filter:sepia(.3) saturate(.9) contrast(1.04)}
.st-vintage .hero .media .ph{transform:rotate(-1.4deg);border:8px solid var(--surface);box-shadow:0 18px 40px -18px rgba(60,40,20,.5)}
.st-vintage .marquee{border-block:2px solid var(--ink)}

@media(prefers-reduced-motion:reduce){
 *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
 .rv{opacity:1;transform:none}
}
@media print{.nav,.veil,.drawer,.mmenu{display:none}.rv{opacity:1;transform:none}}
`;

export const SITE_JS = String.raw`
(function () {
  var d = document;
  function q(s, c) { return (c || d).querySelector(s); }
  function qa(s, c) { return [].slice.call((c || d).querySelectorAll(s)); }
  function rp(n) { return "Rp " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

  /* navbar */
  var nav = q(".nav");
  var first = q("main > section");
  if (nav && first && first.classList.contains("hero-full")) nav.classList.add("on-dark");
  function onScroll() { if (nav) nav.classList.toggle("scrolled", window.scrollY > 24); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  var burger = q(".burger"), mm = q(".mmenu");
  function setMenu(open) {
    if (!mm || !burger) return;
    mm.classList.toggle("open", open); burger.setAttribute("aria-expanded", open ? "true" : "false");
    d.body.classList.toggle("lock", open);
  }
  if (burger) burger.addEventListener("click", function () { setMenu(!mm.classList.contains("open")); });
  qa(".mmenu a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });

  /* reveal saat scroll */
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }) : null;
  qa(".rv").forEach(function (el) { if (io) io.observe(el); else el.classList.add("in"); });

  /* menu aktif */
  var links = qa(".links a[href^='#']");
  if (links.length && "IntersectionObserver" in window) {
    var secs = links.map(function (a) { return q(a.getAttribute("href")); }).filter(Boolean);
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    secs.forEach(function (s) { so.observe(s); });
  }

  /* angka menghitung naik */
  function countUp(el) {
    var raw = el.getAttribute("data-count"); if (!raw) return;
    var m = raw.match(/^([^0-9]*)([0-9][0-9.,]*)(.*)$/); if (!m) return;
    var target = parseFloat(m[2].replace(/\./g, "").replace(",", "."));
    if (isNaN(target)) return;
    var dec = (m[2].split(",")[1] || "").length, t0 = null, dur = 1400;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { el.textContent = raw; return; }
    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3), v = target * e;
      el.textContent = m[1] + (dec ? v.toFixed(dec).replace(".", ",") : Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")) + m[3];
      if (p < 1) requestAnimationFrame(step); else el.textContent = raw;
    }
    requestAnimationFrame(step);
  }
  var cio = ("IntersectionObserver" in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } });
  }, { threshold: 0.6 }) : null;
  qa("[data-count]").forEach(function (el) { if (cio) cio.observe(el); });

  /* filter produk */
  qa("[data-filter-group]").forEach(function (grp) {
    var cards = qa(".pcard", grp.parentNode);
    qa("button", grp).forEach(function (b) {
      b.addEventListener("click", function () {
        qa("button", grp).forEach(function (x) { x.classList.toggle("on", x === b); });
        var c = b.getAttribute("data-cat");
        cards.forEach(function (card) { card.hidden = !(c === "*" || card.getAttribute("data-cat") === c); });
      });
    });
  });

  /* keranjang */
  var cart = {}, drawer = q(".drawer"), veil = q(".veil"), badge = q(".cart-btn b");
  function save() { try { localStorage.setItem("vox-cart", JSON.stringify(cart)); } catch (e) {} }
  try { cart = JSON.parse(localStorage.getItem("vox-cart") || "{}") || {}; } catch (e) { cart = {}; }
  function items() { return Object.keys(cart).map(function (k) { return cart[k]; }); }
  function render() {
    var list = items(), n = 0, sum = 0;
    list.forEach(function (i) { n += i.q; sum += i.q * i.p; });
    if (badge) { badge.textContent = n; badge.classList.toggle("has", n > 0); }
    var box = q(".lines"); if (!box) return;
    if (!list.length) { box.innerHTML = '<div class="empty">Keranjangmu masih kosong.<br>Pilih menu favoritmu dulu ya.</div>'; }
    else {
      box.innerHTML = list.map(function (i) {
        return '<div class="line">' + (i.img ? '<img src="' + i.img + '" alt="" loading="lazy">' : '<div class="ph0"></div>') +
          '<div><b>' + i.n + '</b><small>' + rp(i.p) + '</small><div class="qty"><button data-dec="' + i.id + '" aria-label="Kurangi">−</button><span>' + i.q + '</span><button data-inc="' + i.id + '" aria-label="Tambah">+</button></div></div>' +
          '<b>' + rp(i.p * i.q) + '</b></div>';
      }).join("");
    }
    var t = q(".total b"); if (t) t.textContent = rp(sum);
    var co = q("[data-checkout]"); if (co) co.disabled = !list.length;
  }
  function openCart(o) { if (!drawer) return; drawer.classList.toggle("open", o); veil.classList.toggle("open", o); d.body.classList.toggle("lock", o); }
  qa(".cart-btn").forEach(function (b) { b.addEventListener("click", function () { openCart(true); }); });
  qa("[data-close-cart]").forEach(function (b) { b.addEventListener("click", function () { openCart(false); }); });
  if (veil) veil.addEventListener("click", function () { openCart(false); });
  d.addEventListener("keydown", function (e) { if (e.key === "Escape") { openCart(false); closeLb(); } });
  qa("[data-add]").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-add"), c = b.closest(".pcard");
      var img = c && q("img", c);
      if (!cart[id]) cart[id] = { id: id, n: c.getAttribute("data-name"), p: parseFloat(c.getAttribute("data-price")) || 0, q: 0, img: img ? img.getAttribute("src") : "" };
      cart[id].q++; save(); render();
      b.animate([{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: 380 });
      var cb = q(".cart-btn"); if (cb) cb.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 420 });
    });
  });
  d.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-inc],[data-dec]") : null; if (!t) return;
    var id = t.getAttribute("data-inc") || t.getAttribute("data-dec");
    if (!cart[id]) return;
    cart[id].q += t.hasAttribute("data-inc") ? 1 : -1;
    if (cart[id].q <= 0) delete cart[id];
    save(); render();
  });
  var co = q("[data-checkout]");
  if (co) co.addEventListener("click", function () {
    var nm = q("[name=cname]", drawer), ph = q("[name=cphone]", drawer);
    var list = items(); if (!list.length) return;
    var sum = list.reduce(function (s, i) { return s + i.q * i.p; }, 0);
    var summary = list.map(function (i) { return i.q + "x " + i.n; }).join(", ");
    var rec = { nama: (nm && nm.value) || "", whatsapp: (ph && ph.value) || "", pesanan: summary, total: sum };
    var save2 = (window.VOX && VOX.save) ? VOX.save("pesanan", rec) : Promise.resolve();
    var wa = co.getAttribute("data-wa");
    save2.then(function () {
      cart = {}; save(); render();
      var ok = q(".ok", drawer); if (ok) ok.hidden = false;
      if (wa) {
        var msg = "Halo, saya mau pesan: " + summary + ". Total " + rp(sum) + (rec.nama ? ". Atas nama " + rec.nama : "");
        window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
      }
    });
  });
  render();

  /* lightbox */
  var lb = q(".lb");
  function closeLb() { if (lb) lb.classList.remove("open"); }
  qa("[data-zoom]").forEach(function (f) {
    f.addEventListener("click", function () { var i = q("img", lb); i.src = f.getAttribute("data-zoom"); i.alt = f.getAttribute("data-alt") || ""; lb.classList.add("open"); });
  });
  if (lb) lb.addEventListener("click", function (e) { if (e.target === lb || (e.target.closest && e.target.closest(".x"))) closeLb(); });

  /* video facade */
  qa("[data-embed]").forEach(function (f) {
    var b = q(".play", f); if (!b) return;
    b.addEventListener("click", function () {
      var i = d.createElement("iframe");
      i.src = f.getAttribute("data-embed") + "?autoplay=1&rel=0"; i.title = f.getAttribute("data-title") || "Video";
      i.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen"); i.setAttribute("allowfullscreen", "");
      f.innerHTML = ""; f.appendChild(i);
    });
  });

  /* form tersimpan (VOX) */
  qa("form[data-form]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = q("button[type=submit]", f), label = btn.textContent; btn.disabled = true; btn.textContent = "Mengirim…";
      var data = {}; new FormData(f).forEach(function (v, k) { if (typeof v === "string") data[k] = v; });
      var s = (window.VOX && VOX.save) ? VOX.save(f.getAttribute("data-form"), data) : Promise.resolve();
      s.then(function () { var ok = q(".ok", f); if (ok) ok.hidden = false; f.reset(); })
        .catch(function () { alert("Gagal mengirim. Coba lagi sebentar."); })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  });
})();
`;
