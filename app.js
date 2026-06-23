// Denver Road Trip 互動行程網頁 渲染引擎
(function(){
  "use strict";

  let uidCounter = 0;
  function nextUid(){ return "u" + (++uidCounter); }

  function escapeHtml(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;");
  }

  function encodePath(relPath){
    return relPath.split("/").map(encodeURIComponent).join("/");
  }

  function isVideoFile(name){
    const ext = name.split(".").pop().toLowerCase();
    return ["mp4","mov","webm","m4v"].includes(ext);
  }

  // registry of media lists keyed by uid, used by the delegated click handler
  const mediaRegistry = {};

  function renderMediaFrame(uid){
    const list = mediaRegistry[uid];
    if (!list) return "";
    const idx = list.activeIndex || 0;
    const item = list.files[idx];
    const driveId = (typeof driveVideos !== "undefined") ? driveVideos[item] : undefined;
    let inner;
    if (driveId) {
      inner = `<iframe class="drive-video" src="https://drive.google.com/file/d/${driveId}/preview" allow="autoplay" allowfullscreen loading="lazy"></iframe>`;
    } else {
      const src = list.folder + "/" + encodePath(item);
      if (isVideoFile(item)) {
        inner = `<video src="${src}" controls preload="metadata"></video>`;
      } else {
        inner = `<img src="${src}" alt="${escapeHtml(item)}" loading="lazy">`;
      }
    }
    return inner;
  }

  function mediaBoxHtml(files, folder){
    if (!files || files.length === 0) return "";
    const uid = nextUid();
    mediaRegistry[uid] = { files: files, folder: folder, activeIndex: 0 };
    const numsHtml = files.map((f,i)=>`<button class="media-num${i===0?' active':''}" data-uid="${uid}" data-idx="${i}">${i+1}</button>`).join("");
    return `
      <div class="media-box" data-uid="${uid}">
        <div class="media-frame" data-uid="${uid}">${renderMediaFrame(uid)}</div>
        <div class="media-nav">
          <button class="media-arrow" data-uid="${uid}" data-dir="-1" aria-label="上一張">‹</button>
          ${numsHtml}
          <button class="media-arrow" data-uid="${uid}" data-dir="1" aria-label="下一張">›</button>
          <span class="media-count" data-uid="${uid}-count">${files.length>0?(1)+' / '+files.length:''}</span>
        </div>
      </div>`;
  }

  function updateMediaBox(uid){
    const list = mediaRegistry[uid];
    if (!list) return;
    const box = document.querySelector(`.media-box[data-uid="${uid}"]`);
    if (!box) return;
    const frame = box.querySelector(".media-frame");
    frame.innerHTML = renderMediaFrame(uid);
    box.querySelectorAll(".media-num").forEach((btn)=>{
      btn.classList.toggle("active", Number(btn.dataset.idx) === list.activeIndex);
    });
    const count = box.querySelector(".media-count");
    if (count) count.textContent = (list.activeIndex+1) + " / " + list.files.length;
  }

  function titleHtml(name, url){
    const text = escapeHtml(name);
    if (url) {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${text}</a>`;
    }
    return text;
  }

  function bulletsHtml(bullets){
    if (!bullets || bullets.length === 0) return "";
    return `<ul class="bullets">${bullets.map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul>`;
  }

  function subitemHtml(item, folder){
    return `
      <div class="subitem">
        <div class="section-title">${titleHtml(item.x, item.u)}${item.u ? `<a class="link-pill" href="${escapeHtml(item.u)}" target="_blank" rel="noopener">官網</a>` : ""}</div>
        ${bulletsHtml(item.b)}
        ${mediaBoxHtml(item.m, folder)}
      </div>`;
  }

  function choiceSectionHtml(section, folder){
    const groupUid = nextUid();
    const btns = section.c.map((c,i)=>`<button class="choice-btn${i===0?' active':''}" data-group="${groupUid}" data-idx="${i}">${escapeHtml(c.x)}</button>`).join("");
    const panes = section.c.map((c,i)=>`
      <div class="choice-pane${i===0?' active':''}" data-group="${groupUid}" data-idx="${i}">
        ${c.u ? `<div><a class="link-pill" href="${escapeHtml(c.u)}" target="_blank" rel="noopener">${escapeHtml(c.x)} 官網</a></div>` : ""}
        ${bulletsHtml(c.b)}
        ${mediaBoxHtml(c.m, folder)}
      </div>`).join("");
    return `<div class="choice-buttons">${btns}</div><div class="choice-section" data-group="${groupUid}">${panes}</div>`;
  }

  function sectionHtml(section, folder){
    let html = `<div class="section-card">`;
    html += `<span class="section-time">${escapeHtml(section.t)}</span>`;
    const titleName = section.name || section.x;
    html += `<div class="section-title">${titleHtml(titleName, section.u)}${section.u ? `<a class="link-pill" href="${escapeHtml(section.u)}" target="_blank" rel="noopener">官網</a>` : ""}</div>`;
    html += bulletsHtml(section.b);
    if (section.choice && section.c) {
      html += choiceSectionHtml(section, folder);
    }
    html += mediaBoxHtml(section.m, folder);
    if (section.items) {
      html += section.items.map(it => subitemHtml(it, folder)).join("");
    }
    html += `</div>`;
    return html;
  }

  function mapHtml(mapUrl, embedUrl){
    const src = embedUrl || (mapUrl + (mapUrl.includes("?") ? "&output=embed" : "?output=embed"));
    return `
      <div class="map-wrap">
        <iframe src="${escapeHtml(src)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
        <div class="map-actions"><a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener">在 Google Maps 中開啟完整路線 ↗</a></div>
      </div>`;
  }

  function dayPanelHtml(day, index){
    let html = `<div class="day-panel${index===0?' active':''}" id="panel-${index}">`;
    html += `<div class="day-title">🚗 ${escapeHtml(day.day)} ${escapeHtml(day.title)}</div>`;
    html += mapHtml(day.mapUrl, day.embedUrl);
    html += `<div class="timeline">`;
    html += day.sections.map(s => sectionHtml(s, day.folder)).join("");
    html += `</div></div>`;
    return html;
  }

  function render(){
    const tabsEl = document.getElementById("day-tabs");
    const mainEl = document.getElementById("main-content");
    tabsEl.innerHTML = tripData.map((d,i)=>`<button class="day-tab${i===0?' active':''}" data-day="${i}">${escapeHtml(d.day)}</button>`).join("");
    mainEl.innerHTML = tripData.map((d,i)=>dayPanelHtml(d,i)).join("");

    tabsEl.addEventListener("click", (e)=>{
      const btn = e.target.closest(".day-tab");
      if (!btn) return;
      const idx = btn.dataset.day;
      tabsEl.querySelectorAll(".day-tab").forEach(b=>b.classList.toggle("active", b===btn));
      mainEl.querySelectorAll(".day-panel").forEach(p=>p.classList.toggle("active", p.id === "panel-"+idx));
      window.scrollTo({top:0, behavior:"smooth"});
    });

    mainEl.addEventListener("click", (e)=>{
      // choice buttons
      const cbtn = e.target.closest(".choice-btn");
      if (cbtn) {
        const group = cbtn.dataset.group;
        const idx = cbtn.dataset.idx;
        const card = cbtn.closest(".section-card");
        card.querySelectorAll(`.choice-btn[data-group="${group}"]`).forEach(b=>b.classList.toggle("active", b.dataset.idx===idx));
        card.querySelectorAll(`.choice-pane[data-group="${group}"]`).forEach(p=>p.classList.toggle("active", p.dataset.idx===idx));
        return;
      }
      // media number buttons
      const nbtn = e.target.closest(".media-num");
      if (nbtn) {
        const uid = nbtn.dataset.uid;
        mediaRegistry[uid].activeIndex = Number(nbtn.dataset.idx);
        updateMediaBox(uid);
        return;
      }
      // media arrow buttons
      const abtn = e.target.closest(".media-arrow");
      if (abtn) {
        const uid = abtn.dataset.uid;
        const list = mediaRegistry[uid];
        const dir = Number(abtn.dataset.dir);
        list.activeIndex = (list.activeIndex + dir + list.files.length) % list.files.length;
        updateMediaBox(uid);
        return;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", render);
})();
