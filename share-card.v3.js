/* 閲覧URLのカード表示（DiscordやXで「左に正方形アイコン・右にPC名」）
   キャラごとに share/<キャラID>.html と share/<キャラID>.jpg を GitHub（coc-sheet リポジトリ）に保存し、
   共有URL（share/〜.html）を開くと今までの閲覧URLへ自動で移動する。閲覧URL自体は変えない。 */
(function(){
  const REPO='8i10/coc-sheet', BRANCH='main', SITE='https://8i10.github.io/coc-sheet/';
  const TK='coc_gh_token', SIG='coc_share_sig_';
  const ls={ get:k=>{ try{return localStorage.getItem(k);}catch(e){return null;} }, set:(k,v)=>{ try{localStorage.setItem(k,v);}catch(e){} }, del:k=>{ try{localStorage.removeItem(k);}catch(e){} } };
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const b64utf8=s=>btoa(unescape(encodeURIComponent(s)));
  function fixDropbox(url){
    if(!url)return '';
    if(url.includes('dropbox.com')){ let u=url.replace('www.dropbox.com','dl.dropboxusercontent.com').replace('dropbox.com','dl.dropboxusercontent.com'); u=u.replace(/([?&])dl=[01]/,'$1raw=1'); if(!/[?&]raw=1/.test(u))u+=(u.includes('?')?'&':'?')+'raw=1'; return u; }
    return url;
  }
  function shareUrl(id){ return SITE+'share/'+encodeURIComponent(id)+'.html'; }
  function hasToken(){ return !!ls.get(TK); }
  // トークン：未設定なら入力してもらう（このブラウザにのみ保存）
  function getToken(ask){
    let t=ls.get(TK);
    if(!t&&ask){
      t=(prompt('カード表示用のページをGitHubに保存するため、GitHubのトークンを入力してください。\n（coc-sheet リポジトリの Contents: Read and write 権限。このブラウザにのみ保存されます）\n\nキャンセルすると、カードなしの閲覧URLをコピーします。')||'').trim();
      if(t)ls.set(TK,t);
    }
    return t||'';
  }
  function resetToken(){ ls.del(TK); }
  // アイコンのクロップ範囲（紹介ページ用クロップがあればそれ、なければアイコンのクロップ）
  function cropOf(inp){
    const n=v=>{ const x=parseFloat(v); return isNaN(x)?null:x; };
    const pos=(inp.charImagePos||'50% 30%').split(' ');
    const gs=n(inp.gal_crop_s), gx=n(inp.gal_crop_x), gy=n(inp.gal_crop_y);
    return { s:gs!=null?gs:(n(inp.charImageScale)||1.3), x:(gx!=null&&gy!=null)?gx:(parseFloat(pos[0])||50), y:(gx!=null&&gy!=null)?gy:(parseFloat(pos[1]||pos[0])||30) };
  }
  // 正方形にクロップしたJPEG（base64）。読み込めない・書き出せない時は null
  function cropJpeg(url,c){
    return new Promise(res=>{
      if(!url)return res(null);
      const im=new Image(); im.crossOrigin='anonymous';
      im.onload=()=>{
        try{
          const N=240, W=im.naturalWidth, H=im.naturalHeight; if(!W||!H)return res(null);
          const dw=c.s*N, dh=dw*H/W;                 // 表示枠Nに対する画像の表示サイズ（一覧のアイコンと同じ計算）
          const ox=(N-dw)*c.x/100, oy=(N-dh)*c.y/100;
          const cv=document.createElement('canvas'); cv.width=N; cv.height=N;
          const g=cv.getContext('2d'); g.fillStyle='#f2f2f2'; g.fillRect(0,0,N,N);
          g.drawImage(im,ox,oy,dw,dh);
          res(cv.toDataURL('image/jpeg',0.8).split(',')[1]); // 早く保存できるよう小さめ・画質控えめ
        }catch(e){ res(null); }
      };
      im.onerror=()=>res(null);
      im.src=url+(url.includes('?')?'&':'?')+'_sc='+Date.now();
    });
  }
  // 保存（前回保存時のファイルIDを覚えておき、事前の確認通信を省いて1回で保存。食い違った時だけ確認して再保存）
  async function put(token,path,b64,msg){
    const api='https://api.github.com/repos/'+REPO+'/contents/'+path;
    const h={'Authorization':'token '+token,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'};
    const SK='coc_share_sha_'+path;
    const send=async sha=>{ const body={message:msg,content:b64,branch:BRANCH}; if(sha)body.sha=sha; return fetch(api,{method:'PUT',headers:h,body:JSON.stringify(body)}); };
    let res=await send(ls.get(SK));
    if(res.status===409||res.status===422){
      let sha=null;
      try{ const r=await fetch(api+'?ref='+BRANCH+'&t='+Date.now(),{headers:h,cache:'no-store'}); if(r.ok){ const j=await r.json(); sha=j.sha||null; } }catch(e){}
      res=await send(sha);
    }
    if(!res.ok){ const e=await res.json().catch(()=>({})); if(res.status===401)resetToken(); throw new Error('GitHub '+res.status+' '+(e.message||'')); }
    try{ const j=await res.json(); if(j&&j.content&&j.content.sha)ls.set(SK,j.content.sha); }catch(e){}
  }
  function pageHtml(id,title,desc,img,dest){
    return '<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'+
      '<title>'+esc(title)+'</title>\n'+
      '<meta property="og:type" content="website">\n'+
      '<meta property="og:title" content="'+esc(title)+'">\n'+
      '<meta property="og:description" content="'+esc(desc)+'">\n'+
      '<meta property="og:url" content="'+esc(shareUrl(id))+'">\n'+
      (img?'<meta property="og:image" content="'+esc(img)+'">\n':'')+
      '<meta name="twitter:card" content="summary">\n'+
      '<meta name="twitter:title" content="'+esc(title)+'">\n'+
      '<meta name="twitter:description" content="'+esc(desc)+'">\n'+
      (img?'<meta name="twitter:image" content="'+esc(img)+'">\n':'')+
      '<meta http-equiv="refresh" content="0; url='+esc(dest)+'">\n'+
      '</head>\n<body>\n<a href="'+esc(dest)+'">'+esc(title)+' のキャラクターシートを開く</a>\n'+
      '<script>location.replace('+JSON.stringify(dest)+');<\/script>\n</body>\n</html>\n';
  }
  // 作成・更新（内容が前回と同じなら何もしない）。sheet=キャラシートのデータ、viewPath='view.html?id=…&r=…'
  async function publish(id,sheet,viewPath,opt){
    opt=opt||{};
    const token=getToken(!!opt.ask); if(!token)return false;
    const inp=(sheet&&sheet.inputs)||{};
    const title=(inp.pcname||'キャラクター').trim();
    // Xはカードにタイトル（PC名）を出さないことがあるため、説明文の先頭にもPC名を入れる
    const desc=[title,inp.job,inp.age?(String(inp.age).trim()+(/^\d+$/.test(String(inp.age).trim())?'歳':'')):''].filter(v=>v&&String(v).trim()).join(' / ')||'キャラクターシート';
    const img=fixDropbox(inp.charImage||'');
    const c=cropOf(inp);
    const dest='../'+viewPath;
    const sig=JSON.stringify([title,desc,img,c,dest]);
    if(!opt.force && ls.get(SIG+id)===sig)return true;
    // 画像は画像・クロップが変わった時だけ保存し直す（PC名などだけの変更ならページ1つの保存で済む）
    const isig=JSON.stringify([img,c]);
    let ogImg=ls.get(SIG+'img_'+id+'_url')||'';
    if(opt.force || ls.get(SIG+'img_'+id)!==isig || !ogImg){
      const jpg=await cropJpeg(img,c);
      ogImg=img;
      if(jpg){ await put(token,'share/'+id+'.jpg',jpg,'share image '+id); ogImg=SITE+'share/'+encodeURIComponent(id)+'.jpg?v='+Date.now(); }
      ls.set(SIG+'img_'+id,isig); ls.set(SIG+'img_'+id+'_url',ogImg);
    }
    await put(token,'share/'+id+'.html',b64utf8(pageHtml(id,title,desc,ogImg,dest)),'share page '+id);
    ls.set(SIG+id,sig);
    return true;
  }
  // このキャラのカードを前に作ったか（シート保存時の自動更新用）
  function published(id){ return !!ls.get(SIG+id); }
  window.ShareCard={shareUrl,publish,published,hasToken,getToken,resetToken};
})();
