/* music/covers.js — модуль скрипта music.js. */
export function install(P) {
  Object.assign(P, { ensureLightbox, coverNode, openCover, closeCover, coverIsOpen });


  function ensureLightbox() {
    if (document.getElementById("coverLightbox") || !document.body) return;
    document.body.insertAdjacentHTML("beforeend", `
<div class="cover-lightbox" id="coverLightbox" hidden role="dialog" aria-modal="true" aria-label="Обложка релиза">
  <button class="cover-lightbox-backdrop" type="button" data-cover-close aria-label="Закрыть обложку"></button>
  <div class="cover-lightbox-frame">
    <img id="coverLightboxImg" alt="" hidden>
    <span class="cover-lightbox-letter" id="coverLightboxLetter" aria-hidden="true">♪</span>
    <p class="cover-lightbox-caption" id="coverLightboxCaption"></p>
    <button class="cover-lightbox-close" id="coverLightboxClose" type="button" data-cover-close aria-label="Закрыть обложку">×</button>
  </div>
</div>`);
  }

  function coverNode(album, image, letter) {
    if (!image || !letter) return;
    const fallbackLetter = album && album.title
      ? album.title.replace(/^!/, "").charAt(0) || "♪"
      : "♪";
    if (album && album.cover) {
      // A missing file must never leave an empty hole: fall back to the letter.
      image.onload = () => { image.hidden = false; letter.hidden = true; };
      image.onerror = () => {
        image.hidden = true;
        letter.hidden = false;
        letter.textContent = fallbackLetter;
      };
      image.src = P.assetUrl(album.cover);
      image.hidden = false;
      letter.hidden = true;
    } else {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
      image.hidden = true;
      letter.hidden = false;
      letter.textContent = fallbackLetter;
    }
  }

  function openCover(source) {
    if (!P.ui.lightbox || !source) return;
    const image = source.tagName === "IMG" ? source : source.querySelector("img");
    const letterNode = source.querySelector(".album-cover-letter, .album-card-cover-letter");
    const hasImage = image && image.getAttribute("src") && !image.hidden;
    const img = P.ui.lightboxImg;
    const letter = P.ui.lightboxLetter;
    if (hasImage) {
      img.src = image.currentSrc || image.src;
      img.hidden = false;
      letter.hidden = true;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      letter.hidden = false;
      letter.textContent = (letterNode?.textContent || "♪").trim() || "♪";
    }
    if (P.ui.lightboxCaption) {
      P.ui.lightboxCaption.textContent = source.dataset.coverTitle
        || P.ui.albumTitle?.textContent
        || "";
    }
    if (P.lightboxTimer) { window.clearTimeout(P.lightboxTimer); P.lightboxTimer = 0; }
    P.ui.lightbox.hidden = false;
    P.ui.lightbox.classList.remove("is-closing");
    document.body.classList.add("cover-lightbox-open");
    void P.ui.lightbox.offsetWidth;
    P.ui.lightbox.classList.add("is-open");
    P.ui.lightbox.querySelector("[data-cover-close]")?.focus({ preventScroll: true });
  }

  function closeCover() {
    if (!P.ui.lightbox || P.ui.lightbox.hidden) return;
    P.ui.lightbox.classList.remove("is-open");
    P.ui.lightbox.classList.add("is-closing");
    document.body.classList.remove("cover-lightbox-open");
    if (P.lightboxTimer) window.clearTimeout(P.lightboxTimer);
    P.lightboxTimer = window.setTimeout(() => {
      if (!P.ui.lightbox.classList.contains("is-open")) {
        P.ui.lightbox.hidden = true;
        P.ui.lightbox.classList.remove("is-closing");
      }
      P.lightboxTimer = 0;
    }, 300);
  }

  function coverIsOpen() {
    return !!(P.ui.lightbox && !P.ui.lightbox.hidden && P.ui.lightbox.classList.contains("is-open"));
  }}
