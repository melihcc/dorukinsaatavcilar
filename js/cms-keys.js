/* Doruk İnşaat — CMS alan keşfi (ortak modül)
 *
 * Hem genel site (js/content.js) hem de yönetim paneli (admin/js/admin.js)
 * bu dosyayı kullanır. Böylece iki taraf da aynı "anahtar"ları üretir.
 *
 * Anahtar mantığı: anahtar, elemanın HTML dosyasındaki ORİJİNAL içeriğinden
 * türetilir (etiket + içerik hash'i). Bu sayede sayfadaki bölümlerin sırası
 * değişse bile kayıtlı içerikler doğru yerde kalır.
 */

/* ---------- Hangi elemanlar düzenlenebilir? ---------- */

const TEXT_TAGS = new Set([
  "H1", "H2", "H3", "H4", "H5", "H6", "P", "LI", "BLOCKQUOTE", "FIGCAPTION",
  // Aşağıdakiler yalnızca düz metin içerdiklerinde ve yeterince uzun
  // olduklarında toplanır (ikon ve tek harflik ayraçlar elenir).
  "SPAN", "BUTTON"
]);

// SPAN/BUTTON için asgari uzunluk — "/", "—" gibi süsleri eler
const SHORT_TAGS = new Set(["SPAN", "BUTTON"]);
const SHORT_MIN = 3;

// Bu etiketlerin içindeki hiçbir şey düzenlenemez
const BLOCKED_ANCESTORS = new Set([
  "HEADER", "FOOTER", "NAV", "SCRIPT", "STYLE", "SVG", "NOSCRIPT", "TEMPLATE",
  "SELECT", "OPTION", "TEXTAREA"
]);

const BG_URL = /url\((['"]?)(.*?)\1\)/i;

/* ---------- Yardımcılar ---------- */

function hash8(str) {
  // djb2 — kısa ve çakışması düşük
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36).padStart(6, "0").slice(0, 8);
}

function norm(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function isBlocked(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (BLOCKED_ANCESTORS.has(n.tagName)) return true;
    if (n.hasAttribute("data-cms-skip")) return true;
    if (n.classList && n.classList.contains("material-symbols-outlined")) return true;
    if (n.hasAttribute("data-projects") || n.hasAttribute("data-project-detail")) return true;
  }
  return false;
}

/** Eleman yalnızca düz metin mi içeriyor? (iç içe etiket yoksa güvenle düzenlenebilir) */
function isPlainText(el) {
  if (!el.firstChild) return false;
  for (const n of el.childNodes) {
    if (n.nodeType === 1) return false;          // içinde etiket var
    if (n.nodeType !== 3 && n.nodeType !== 8) return false;
  }
  return norm(el.textContent).length >= 2;
}

/** İkon (material-symbols) metinlerini saymadan görünen yazıyı verir. */
function visibleText(el) {
  if (!el) return "";
  let out = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.nodeValue;
    else if (n.nodeType === 1 && !n.classList.contains("material-symbols-outlined")) {
      out += visibleText(n);
    }
  });
  return norm(out);
}

/** Elemanın ait olduğu bölüm için okunabilir bir başlık üretir. */
function sectionLabel(el) {
  const sec = el.closest("section, main > div, article, [data-cms-section]");
  if (sec && sec.hasAttribute("data-cms-section")) return sec.getAttribute("data-cms-section");
  if (sec) {
    const t = visibleText(sec.querySelector("h1, h2, h3"));
    if (t) return t.length > 44 ? t.slice(0, 44) + "…" : t;
    if (sec.id) return sec.id;
  }
  return "Diğer";
}

/* ---------- Alan toplama ---------- */

/**
 * Bir doküman/eleman içindeki tüm düzenlenebilir alanları bulur.
 * @param {Document|Element} root
 * @returns {Array<{key,type,label,section,value,el}>}
 */
export function collectFields(root) {
  const scope = root.body || root;
  const fields = [];
  const used = new Map();

  const keyFor = (tag, seed) => {
    const base = tag.toLowerCase() + "-" + hash8(seed);
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    return n === 1 ? base : base + "-" + n;
  };

  /* Metin alanları */
  scope.querySelectorAll([...TEXT_TAGS].join(",")).forEach((el) => {
    if (isBlocked(el) || !isPlainText(el)) return;
    const value = norm(el.textContent);
    if (SHORT_TAGS.has(el.tagName) && value.length < SHORT_MIN) return;
    fields.push({
      key: keyFor(el.tagName, value),
      type: "text",
      multiline: value.length > 90,
      label: value.length > 60 ? value.slice(0, 60) + "…" : value,
      section: sectionLabel(el),
      value,
      el
    });
  });

  /* <img> görselleri */
  scope.querySelectorAll("img").forEach((el) => {
    if (isBlocked(el)) return;
    const src = el.getAttribute("src") || "";
    if (!src) return;
    fields.push({
      key: keyFor("IMG", src),
      type: "image",
      label: el.getAttribute("alt") || el.getAttribute("aria-label") || "Görsel",
      section: sectionLabel(el),
      value: src,
      el
    });
  });

  /* style="background-image:url(...)" görselleri */
  scope.querySelectorAll('[style*="background-image"]').forEach((el) => {
    if (isBlocked(el)) return;
    const m = BG_URL.exec(el.getAttribute("style") || "");
    if (!m || !m[2]) return;
    fields.push({
      key: keyFor("BG", m[2]),
      type: "image",
      label: el.getAttribute("aria-label") || el.getAttribute("alt") || "Arka plan görseli",
      section: sectionLabel(el),
      value: m[2],
      el
    });
  });

  return fields;
}

/** Kayıtlı bir değeri canlı sayfadaki elemana uygular. */
export function applyField(field, value) {
  if (value == null || value === "") return;
  const el = field.el;
  if (!el) return;
  if (field.type === "text") {
    el.textContent = value;
  } else if (el.tagName === "IMG") {
    el.setAttribute("src", value);
  } else {
    const style = el.getAttribute("style") || "";
    el.setAttribute("style", style.replace(BG_URL, `url("${value}")`));
  }
}

/** Sayfa kimliği: dosya adından üretilir (index, projeler, iletisim …) */
export function pageId(pathname) {
  const p = (pathname || location.pathname).split("/").pop() || "index.html";
  return p.replace(/\.html?$/i, "") || "index";
}
