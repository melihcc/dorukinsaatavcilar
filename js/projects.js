/* Doruk İnşaat — proje listeleri ve proje detay sayfası
 *
 * Firestore'daki `projects` koleksiyonundan okur ve şu kapsayıcıları doldurur:
 *   [data-projects="featured"]  → ana sayfadaki öne çıkan projeler
 *   [data-projects="all"]       → projeler sayfasındaki tam liste (+ filtreler)
 *   [data-project-detail]       → proje detay sayfasının tamamı
 *
 * Firestore'da kayıt yoksa HTML'deki mevcut örnek içerik olduğu gibi kalır.
 */

import { db } from "./firebase.js";
import { SITE_ORIGIN } from "./site-config.js";
import {
  collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ------------------------------- yardımcılar ------------------------------ */

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const STATUS_LABEL = {
  tamamlanan: "Tamamlanan",
  devam: "Devam Eden",
  planlanan: "Planlanan"
};

/** Başlıktan okunabilir bir adres parçası üretir (panelde slug boş bırakılmışsa). */
export function slugify(s) {
  const tr = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", İ: "i" };
  return String(s || "")
    .replace(/[çğıiöşüİ]/g, (c) => tr[c] || c)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/** Adreste tercihen slug kullanılır; yoksa Firestore kimliğine düşer. */
function projectSlug(p) {
  return (p.slug && p.slug.trim()) || slugify(p.title) || p.id;
}

function detailUrl(p) {
  return "projelerdetay.html?proje=" + encodeURIComponent(projectSlug(p));
}

/** Detay sayfasının başlık/açıklama/canonical etiketlerini projeye göre günceller. */
function applyDetailMeta(p) {
  const title = `${p.title} | Doruk İnşaat Avcılar`;
  const desc = (p.summary || p.description || "")
    .replace(/\s+/g, " ").trim().slice(0, 300) ||
    `${p.title} — Doruk İnşaat’ın Avcılar’daki projelerinden.`;
  const url = `${SITE_ORIGIN}/projelerdetay.html?proje=${encodeURIComponent(projectSlug(p))}`;

  document.title = title;

  const set = (sel, attr, value) => {
    const el = document.head.querySelector(sel);
    if (el) el.setAttribute(attr, value);
  };
  set('meta[name="description"]', "content", desc);
  set('link[rel="canonical"]', "href", url);
  set('meta[property="og:title"]', "content", title);
  set('meta[property="og:description"]', "content", desc);
  set('meta[property="og:url"]', "content", url);
  set('meta[name="twitter:title"]', "content", title);
  set('meta[name="twitter:description"]', "content", desc);
  if (p.cover) {
    set('meta[property="og:image"]', "content", p.cover);
    set('meta[name="twitter:image"]', "content", p.cover);
  }

  // Arama sonuçlarında "Ana Sayfa › Projeler › Proje Adı" yolunu gösterir
  const eskiIz = document.getElementById("proje-izyolu");
  if (eskiIz) eskiIz.remove();
  const iz = document.createElement("script");
  iz.type = "application/ld+json";
  iz.id = "proje-izyolu";
  iz.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: SITE_ORIGIN + "/" },
      { "@type": "ListItem", position: 2, name: "Projeler", item: SITE_ORIGIN + "/projeler.html" },
      { "@type": "ListItem", position: 3, name: p.title, item: url }
    ]
  });
  document.head.appendChild(iz);
}

function paragraphs(text, cls) {
  return String(text || "")
    .split(/\n{2,}|\r\n\r\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => `<p class="${cls}">${esc(t)}</p>`)
    .join("");
}

async function loadProjects() {
  // orderBy kullanılmıyor: "order" alanı olmayan kayıtlar sorgudan düşerdi.
  const snap = await getDocs(collection(db, "projects"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.published !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/* ------------------------------ kart şablonları --------------------------- */

/** Ana sayfa — görsel üstü yazılı kart */
export function featuredCard(p) {
  return `
<a class="group relative block overflow-hidden rounded-xl" href="${esc(detailUrl(p))}">
<img alt="${esc(p.title)}" class="h-[400px] w-full object-cover transition-transform duration-500 group-hover:scale-110" src="${esc(p.cover || "")}"/>
<div class="absolute inset-0 bg-gradient-to-t from-charcoal to-transparent opacity-80"></div>
<div class="absolute bottom-0 w-full p-8">
<p class="mb-2 text-sm font-bold uppercase text-primary">${esc(p.category || "")}</p>
<h3 class="mb-2 text-2xl font-bold text-white">${esc(p.title)}</h3>
<p class="text-sm text-slate-200 opacity-0 transition-opacity duration-300 group-hover:opacity-100">${esc([p.location, p.year].filter(Boolean).join(" - "))}</p>
</div>
</a>`;
}

/** Projeler sayfası — bilgi kartı */
export function listCard(p) {
  const badgeCls = p.status === "tamamlanan"
    ? "bg-primary text-white"
    : "bg-slate-900 text-white";
  return `
<div class="group flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800" data-status="${esc(p.status || "")}">
<a class="relative block aspect-[4/3] overflow-hidden" href="${esc(detailUrl(p))}">
<div class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-110" style='background-image: url("${esc(p.cover || "")}");'></div>
<div class="absolute left-4 top-4">
<span class="rounded px-3 py-1 text-xs font-bold uppercase tracking-wider ${badgeCls}">${esc(p.location || STATUS_LABEL[p.status] || "")}</span>
</div>
</a>
<div class="flex flex-col gap-2 p-6">
<h3 class="text-xl font-bold text-slate-900 transition-colors group-hover:text-primary dark:text-white">
<a href="${esc(detailUrl(p))}">${esc(p.title)}</a>
</h3>
<p class="text-sm leading-relaxed text-slate-500 dark:text-slate-400">${esc(p.summary || "")}</p>
<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-700">
<div class="flex items-center gap-1 text-slate-400">
<span aria-hidden="true" class="material-symbols-outlined text-sm">location_on</span>
<span class="text-xs">${esc(p.location || "")}</span>
</div>
<a class="flex items-center gap-1 text-sm font-bold text-primary" href="${esc(detailUrl(p))}">Detaylar <span aria-hidden="true" class="material-symbols-outlined text-sm">arrow_forward</span></a>
</div>
</div>
</div>`;
}

/** Detay sayfası altı — ilgili proje kartı */
function relatedCard(p) {
  return `
<a class="group block" href="${esc(detailUrl(p))}">
<div class="mb-4 h-64 overflow-hidden rounded-xl">
<img alt="${esc(p.title)}" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" src="${esc(p.cover || "")}"/>
</div>
<h4 class="mb-2 text-xl font-black tracking-tight">${esc(p.title)}</h4>
<p class="text-sm text-on-surface-variant">${esc([p.location, p.year].filter(Boolean).join(" · "))}</p>
</a>`;
}

/* ----------------------------- detay sayfası ------------------------------ */

function galleryItem(url, i, baslik) {
  const span = i === 0 ? "md:col-span-2 md:row-span-2" : i <= 2 ? "md:col-span-2" : "";
  return `
<div class="group relative overflow-hidden rounded-lg ${span}">
<img alt="${esc(baslik)} — görsel ${i + 1}" class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" src="${esc(url)}"/>
<div class="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/0"></div>
</div>`;
}

export function renderDetail(p, related) {
  const specs = (p.specs || []).filter((s) => s && s.label).map((s) => `
<div class="space-y-1">
<p class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">${esc(s.label)}</p>
<p class="text-sm font-bold">${esc(s.value)}</p>
</div>`).join("");

  const features = (p.features || []).filter((f) => f && f.title).map((f) => `
<div class="flex items-start gap-5 rounded-xl border border-black/5 bg-white p-6 shadow-sm">
<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
<span aria-hidden="true" class="material-symbols-outlined">${esc(f.icon || "check_circle")}</span>
</div>
<div>
<h4 class="mb-1 text-lg font-bold">${esc(f.title)}</h4>
<p class="text-sm text-on-surface-variant">${esc(f.text || "")}</p>
</div>
</div>`).join("");

  const nearby = (p.nearby || []).filter((n) => n && n.label).map((n) => `
<div class="flex justify-between border-b border-black/5 pb-2">
<span class="text-on-surface-variant">${esc(n.label)}</span>
<span class="font-bold">${esc(n.value)}</span>
</div>`).join("");

  const gallery = (p.gallery || []).filter(Boolean);

  return `
<!-- Hero -->
<header class="relative flex min-h-[600px] items-end overflow-hidden" style="height:819px">
<div class="absolute inset-0 bg-zinc-950">
<img alt="${esc(p.title)}" class="h-full w-full object-cover opacity-60" src="${esc(p.cover || "")}"/>
<div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"></div>
</div>
<div class="relative z-10 mx-auto w-full max-w-7xl px-8 pb-16">
<nav class="mb-6 flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-white/70">
<a class="transition-colors hover:text-primary" href="index.html">Ana Sayfa</a>
<span aria-hidden="true" class="material-symbols-outlined text-xs">chevron_right</span>
<a class="transition-colors hover:text-primary" href="projeler.html">Projeler</a>
<span aria-hidden="true" class="material-symbols-outlined text-xs">chevron_right</span>
<span class="text-white">${esc(p.title)}</span>
</nav>
<h1 class="mb-4 text-5xl font-black tracking-tighter text-white md:text-7xl">${esc(p.title)}</h1>
<p class="text-xl font-medium tracking-tight text-primary md:text-2xl">${esc([p.location, p.year].filter(Boolean).join(" | "))}</p>
</div>
</header>

<!-- Proje Hakkında + Künye -->
<section class="bg-surface py-24">
<div class="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-8 lg:grid-cols-12">
<div class="lg:col-span-7">
<h2 class="mb-6 text-xs font-black uppercase tracking-[0.2em] text-primary">Proje Hakkında</h2>
<div class="space-y-6 text-lg font-medium leading-relaxed text-on-surface-variant">
${paragraphs(p.description || p.summary, "") || "<p></p>"}
</div>
</div>
${specs ? `<div class="lg:col-span-5">
<div class="editorial-shadow rounded-xl border-l-4 border-primary bg-surface-container-low p-8">
<h3 class="mb-8 text-2xl font-black tracking-tighter">Proje Künyesi</h3>
<div class="grid grid-cols-2 gap-x-4 gap-y-8">${specs}</div>
</div>
</div>` : ""}
</div>
</section>

${gallery.length ? `<!-- Galeri -->
<section class="bg-zinc-950 py-24">
<div class="mx-auto max-w-7xl px-8">
<h2 class="mb-12 text-center text-3xl font-black tracking-tighter text-white">Görsel Galeri</h2>
<div class="grid auto-rows-[250px] grid-cols-1 gap-4 md:grid-cols-4">
${gallery.map((u, i) => galleryItem(u, i, p.title)).join("")}
</div>
</div>
</section>` : ""}

${features ? `<!-- Özellikler -->
<section class="bg-surface-container-low py-24">
<div class="mx-auto max-w-7xl px-8">
<div class="mb-16 text-center">
<h2 class="mb-4 text-xs font-black uppercase tracking-[0.2em] text-primary">Özellikler &amp; Donatılar</h2>
<p class="text-4xl font-black tracking-tighter">${esc(p.featuresTitle || "Modern Yaşamın Gereklilikleri")}</p>
</div>
<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">${features}</div>
</div>
</section>` : ""}

${(p.locationText || nearby || p.mapImage) ? `<!-- Konum -->
<section class="bg-surface py-24">
<div class="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-8 lg:grid-cols-2">
<div>
<h2 class="mb-6 text-xs font-black uppercase tracking-[0.2em] text-primary">Ulaşım ve Konum</h2>
<h3 class="mb-8 text-4xl font-black leading-tight tracking-tighter">${esc(p.locationTitle || "Her Şeyin Merkezinde")}</h3>
<div class="space-y-6">
${p.locationText ? `<div class="flex items-center gap-4">
<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white">
<span aria-hidden="true" class="material-symbols-outlined">location_on</span>
</div>
<p class="text-lg font-medium">${esc(p.locationText)}</p>
</div>` : ""}
${nearby ? `<div class="space-y-4 rounded-lg bg-surface-container-high p-6">${nearby}</div>` : ""}
</div>
</div>
${p.mapImage ? `<div class="relative h-[450px] overflow-hidden rounded-2xl bg-zinc-200 shadow-2xl">
<img alt="${esc(p.title)} konumu" class="h-full w-full object-cover opacity-80 grayscale" src="${esc(p.mapImage)}"/>
<div class="absolute inset-0 flex items-center justify-center">
<div class="rounded-full bg-primary p-4 shadow-lg">
<span aria-hidden="true" class="material-symbols-outlined text-4xl text-on-primary">pin_drop</span>
</div>
</div>
</div>` : ""}
</div>
</section>` : ""}

<!-- CTA -->
<section class="bg-primary py-20">
<div class="mx-auto max-w-4xl px-8 text-center">
<h2 class="mb-8 text-3xl font-black leading-tight tracking-tighter text-on-primary md:text-5xl">Bu projeye benzer bir dönüşüm mü düşünüyorsunuz?</h2>
<a class="inline-block rounded-lg bg-zinc-950 px-12 py-5 text-lg font-black uppercase tracking-widest text-white shadow-2xl transition-all hover:bg-zinc-800 active:scale-95" href="teklifal.html">Teklif Al</a>
</div>
</section>

${related.length ? `<!-- Diğer projeler -->
<section class="bg-surface-container-low py-24">
<div class="mx-auto max-w-7xl px-8">
<div class="mb-12 flex items-end justify-between">
<div>
<h2 class="mb-4 text-xs font-black uppercase tracking-[0.2em] text-primary">Diğer Projeler</h2>
<h3 class="text-3xl font-black tracking-tighter">İmzamızı Attığımız Bazı Eserler</h3>
</div>
<a class="hidden border-b-2 border-primary pb-1 font-bold text-primary md:block" href="projeler.html">Tümünü İncele</a>
</div>
<div class="grid grid-cols-1 gap-8 md:grid-cols-3">${related.map(relatedCard).join("")}</div>
</div>
</section>` : ""}
`;
}

/* --------------------------------- filtre -------------------------------- */

const ACTIVE_CLS = "bg-primary text-white shadow-lg shadow-primary/20";
const IDLE_CLS = "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary";

let aktifFiltre = "all";

/** Seçili filtreyi kartlara uygular. Liste yeniden çizildiğinde de çağrılır. */
function applyFilter(cards) {
  cards.querySelectorAll("[data-status]").forEach((c) => {
    const uygun = aktifFiltre === "all" || c.getAttribute("data-status") === aktifFiltre;
    c.style.display = uygun ? "" : "none";
  });
}

/** Filtre düğmelerini bağlar. Birden çok kez çağrılabilir; dinleyici bir kez eklenir. */
function wireFilters(scope, cards) {
  const buttons = scope.querySelectorAll("[data-filter]");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    if (btn.dataset.filterBound) return;             // ikinci kez bağlanmasın
    btn.dataset.filterBound = "1";
    btn.addEventListener("click", () => {
      aktifFiltre = btn.getAttribute("data-filter");
      buttons.forEach((b) => {
        const on = b === btn;
        b.className = "px-6 py-2.5 rounded-full font-bold text-sm transition-all " + (on ? ACTIVE_CLS : IDLE_CLS);
      });
      applyFilter(cards);
    });
  });

  applyFilter(cards);
}

/* --------------------------------- başlat -------------------------------- */

/** Adresteki `?proje=` değerine karşılık gelen projeyi bulur.
 *  Önce slug, sonra başlıktan üretilen slug, en son Firestore kimliği denenir —
 *  böylece eski kimlikli bağlantılar da çalışmaya devam eder. */
function findProject(all, wanted) {
  if (!wanted) return null;
  const w = wanted.toLowerCase();
  return all.find((x) => (x.slug || "").toLowerCase() === w)
      || all.find((x) => slugify(x.title) === w)
      || all.find((x) => x.id === wanted)
      || null;
}

async function boot() {
  const featuredBox = document.querySelector('[data-projects="featured"]');
  const listBox = document.querySelector('[data-projects="all"]');
  const detailBox = document.querySelector("[data-project-detail]");

  // Filtreler statik örnek kartlarda da çalışmalı: Firestore'a hiç gidilmese
  // bile bağlanır, liste yenilenince aşağıda yeniden bağlanır.
  if (listBox) wireFilters(listBox.parentElement || document, listBox);

  try {
    if (detailBox) {
      const wanted = new URLSearchParams(location.search).get("proje");
      const all = await loadProjects();
      if (!all.length) return;                       // kayıt yok → statik içerik kalsın
      const p = findProject(all, wanted) || all[0];
      const related = all.filter((x) => x.id !== p.id).slice(0, 3);
      detailBox.innerHTML = renderDetail(p, related);
      applyDetailMeta(p);
      return;
    }

    if (!featuredBox && !listBox) return;
    const all = await loadProjects();
    if (!all.length) return;

    if (featuredBox) {
      const list = all.filter((p) => p.featured);
      featuredBox.innerHTML = (list.length ? list : all).slice(0, 3).map(featuredCard).join("");
    }
    if (listBox) {
      listBox.innerHTML = all.map(listCard).join("");
      wireFilters(listBox.parentElement || document, listBox);
    }
  } catch (err) {
    console.warn("[projeler] Firestore'dan projeler alınamadı:", err.message);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
