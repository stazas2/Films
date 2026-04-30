import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// The bookmarklet body. {{ORIGIN}} is replaced at runtime with the deployed origin
// so the captured link is sent back to the same instance the user opened this page on.
const BOOKMARKLET_SRC = `(function(){
  var O='{{ORIGIN}}';
  var RX=/https?:\\/\\/[^"'\\s\\\\<>()]+\\.m3u8[^"'\\s\\\\<>()]*/gi;
  var RX1=/\\.m3u8(\\?|$|#)/i;
  function scan(w,urls,blocked){
    try{
      w.performance.getEntriesByType('resource').forEach(function(e){
        if(RX1.test(e.name))urls.add(e.name);
      });
    }catch(e){}
    var doc;try{doc=w.document;}catch(e){return;}
    try{
      doc.querySelectorAll('video,source').forEach(function(el){
        var s=el.currentSrc||el.src||el.getAttribute('src')||'';
        if(RX1.test(s))urls.add(s);
      });
    }catch(e){}
    try{
      doc.querySelectorAll('iframe').forEach(function(f){
        var src=f.src||f.getAttribute('src')||'';
        if(!src||src.indexOf('about:')===0||src.indexOf('javascript:')===0||src.indexOf('data:')===0)return;
        var accessible=false;
        try{f.contentDocument&&f.contentDocument.documentElement;accessible=!!(f.contentDocument&&f.contentDocument.documentElement);}catch(e){}
        if(!accessible)blocked.push(src);
      });
    }catch(e){}
    try{
      var html=doc.documentElement&&doc.documentElement.outerHTML;
      if(html){var m;RX.lastIndex=0;while((m=RX.exec(html))!==null)urls.add(m[0]);}
    }catch(e){}
    try{
      for(var i=0;i<w.frames.length;i++)scan(w.frames[i],urls,blocked);
    }catch(e){}
  }
  function find(){
    var urls=new Set();var blocked=[];
    scan(window,urls,blocked);
    return{urls:Array.from(urls),blocked:Array.from(new Set(blocked))};
  }
  function go(u){location.href=O+'/?video='+encodeURIComponent(u);}
  function shortUrl(u){return u.length>60?u.slice(0,30)+'…'+u.slice(-25):u;}
  function describe(text){
    if(!text||text.indexOf('#EXTM3U')===-1)return null;
    var lines=text.split('\\n'),qs=[];
    for(var i=0;i<lines.length;i++){
      if(lines[i].indexOf('#EXT-X-STREAM-INF')!==0)continue;
      var rm=lines[i].match(/RESOLUTION=(\\d+x\\d+)/i);
      var bm=lines[i].match(/BANDWIDTH=(\\d+)/i);
      var res=rm?rm[1]:'';
      var h=res?parseInt(res.split('x')[1],10):0;
      qs.push({h:h,res:res,bw:bm?parseInt(bm[1],10):0});
    }
    if(!qs.length)return 'media';
    qs.sort(function(a,b){return b.h-a.h;});
    return qs.map(function(q){return q.h?q.h+'p':q.res||Math.round(q.bw/1000)+'k';}).join('/');
  }
  function fetchInfo(url){
    return fetch(url,{credentials:'include'}).then(function(r){return r.ok?r.text():'';}).then(describe).catch(function(){return null;});
  }
  function pick(urls){
    if(urls.length===1){
      fetchInfo(urls[0]).then(function(info){
        if(info&&info!=='media'&&!confirm('Найден master playlist:\\n\\n'+shortUrl(urls[0])+'\\n\\nКачества: '+info+'\\n\\nПродолжить?'))return;
        go(urls[0]);
      });
      return;
    }
    Promise.all(urls.map(fetchInfo)).then(function(infos){
      var list=urls.map(function(u,i){
        var tag=infos[i]?(infos[i]==='media'?' [media]':' ['+infos[i]+']'):'';
        return (i+1)+'.'+tag+' '+shortUrl(u);
      }).join('\\n');
      var ans=prompt('Найдено несколько .m3u8 — выбери номер:\\n\\n'+list,'1');
      if(!ans)return;
      var idx=parseInt(ans,10)-1;
      if(idx>=0&&idx<urls.length)go(urls[idx]);
    });
  }
  function offerFrame(blocked){
    var target;
    if(blocked.length===1){
      if(!confirm('Плеер находится во фрейме другого домена:\\n\\n'+blocked[0]+'\\n\\nОткрыть фрейм в новой вкладке? Там нажми Play и кликни эту закладку ещё раз.'))return;
      target=blocked[0];
    }else{
      var list=blocked.map(function(u,i){return (i+1)+'. '+(u.length>80?u.slice(0,77)+'…':u);}).join('\\n');
      var ans=prompt('Найдено несколько фреймов с плеером — выбери номер, чтобы открыть в новой вкладке:\\n\\n'+list,'1');
      if(!ans)return;
      var idx=parseInt(ans,10)-1;
      if(idx<0||idx>=blocked.length)return;
      target=blocked[idx];
    }
    window.open(target,'_blank');
  }
  function handle(r){
    if(r.urls.length){pick(r.urls);return true;}
    if(r.blocked.length){offerFrame(r.blocked);return true;}
    return false;
  }
  if(handle(find()))return;
  if(!confirm('Не нашёл .m3u8 на странице. Запусти плеер (нажми Play), а потом OK — повторю поиск через 5 секунд.'))return;
  setTimeout(function(){
    if(handle(find()))return;
    alert('Так и не нашёл .m3u8. Скорее всего плеер использует MSE/blob или ссылка спрятана в обфусцированном скрипте.');
  },5000);
})();`;

function buildHref(origin: string): string {
  // Collapse whitespace so the href stays readable and a few hundred bytes shorter.
  const compact = BOOKMARKLET_SRC.replace(/\s+/g, ' ').trim();
  return 'javascript:' + compact.replace('{{ORIGIN}}', origin);
}

export default function Bookmarklet() {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const o = window.location.origin;
    setOrigin(o);
    if (linkRef.current) {
      // Set via setAttribute to bypass React's noisy javascript:-href warning.
      linkRef.current.setAttribute('href', buildHref(o));
    }
  }, []);

  const copySource = () => {
    if (!origin) return;
    navigator.clipboard.writeText(buildHref(origin)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative min-h-screen p-4 sm:p-8 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-400/10 blur-[120px]" />
      </div>

      <div className="max-w-2xl mx-auto space-y-8 animate-rise-in">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-ink-300 hover:text-ink-50 transition-colors inline-flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            На главную
          </Link>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-balance">
            Захватчик <span className="italic text-amber-400">ссылок</span>
          </h1>
          <p className="text-ink-200 text-[15px] leading-relaxed">
            Букмарклет, который ловит <code className="font-mono text-amber-300">.m3u8</code> прямо со
            страницы плеера и кидает её в новую комнату — без DevTools.
          </p>
        </div>

        {/* Drag-me link */}
        <div className="glass rounded-2xl p-6 space-y-4 shadow-card">
          <p className="text-xs uppercase tracking-wider text-ink-300 font-medium">Шаг 1 — установка</p>
          <p className="text-sm text-ink-100">
            Перетащи кнопку ниже в панель закладок (если её не видно —{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[11px] font-mono">Ctrl+Shift+B</kbd>{' '}
            в Chrome).
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              ref={linkRef}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert('Перетащи эту кнопку в панель закладок, не кликай по ней здесь.');
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-ink-950 font-semibold shadow-card transition-colors cursor-grab active:cursor-grabbing select-none"
              draggable
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Кинуть в watch-together
            </a>
            <button
              onClick={copySource}
              className="text-xs text-ink-300 hover:text-ink-50 transition-colors underline decoration-dotted underline-offset-4"
            >
              {copied ? '✓ Скопировано' : 'или скопировать код'}
            </button>
          </div>
          <p className="text-xs text-ink-300">
            Origin: <span className="font-mono text-ink-100">{origin || '...'}</span>
          </p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-3 shadow-card">
          <p className="text-xs uppercase tracking-wider text-ink-300 font-medium">Шаг 2 — захват</p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-ink-100">
            <li>Открой страницу с фильмом и нажми Play (хотя бы пару секунд).</li>
            <li>Кликни букмарклет в панели закладок.</li>
            <li>
              <b className="text-ink-100">Если плеер во фрейме</b> (kinogo, rezka, etc) — букмарклет спросит «открыть фрейм в новой вкладке?», согласись. В новой вкладке нажми Play и кликни букмарклет ещё раз.
            </li>
            <li>Если найдено несколько ссылок — выбери основной плейлист (обычно <code className="font-mono text-amber-300">master.m3u8</code> или <code className="font-mono text-amber-300">index.m3u8</code>).</li>
            <li>Откроется главная watch-together с уже захваченной ссылкой — введи имя и создай комнату.</li>
          </ol>
        </div>

        <div className="glass rounded-2xl p-6 space-y-3 shadow-card border border-white/5">
          <p className="text-xs uppercase tracking-wider text-ink-300 font-medium">Если не сработало</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-ink-200">
            <li>
              <b className="text-ink-100">Не открывается новая вкладка с фреймом</b> — браузер мог заблокировать всплывающее окно. Разреши pop-up для сайта плеера и попробуй ещё раз.
            </li>
            <li>
              <b className="text-ink-100">Ссылка вообще не светится</b> — плеер использует MSE/blob или обфусцирует загрузку. Букмарклет тут не поможет, придётся через DevTools → Network вручную.
            </li>
            <li>
              <b className="text-ink-100">403 после захвата</b> — стрим привязан к IP того, кто получил ссылку. Render-сервер ходит за видео со своего IP, пройдёт не всегда.
            </li>
            <li>
              <b className="text-ink-100">Несколько .m3u8</b> — нормально, обычно дорожки качества. Бери первую или ту, где в URL <code className="font-mono">master</code>/<code className="font-mono">index</code>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
