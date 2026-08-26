/* Doruk İnşaat — Yönetim Paneli */

import { db, auth, storage } from "../../js/firebase.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs,
  serverTimestamp, deleteField, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref as sRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { collectFields } from "../../js/cms-keys.js";
// slugify sitenin kendisiyle paylaşılır ki panel ile site birebir aynı adresi
// üretsin. projects.js yüklenirken çalışan boot() bu sayfada işlevsizdir:
// panelde [data-projects] / [data-project-detail] kapsayıcısı yok.
import { slugify } from "../../js/projects.js";

/* ============================ küçük yardımcılar =========================== */

const $ = (id) => document.getElementById(id);
const el = (sel, root = document) => root.querySelector(sel);
const els = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function busy(on, text = "Yükleniyor…") {
  $("busyText").textContent = text;
  $("busy").classList.toggle("hidden", !on);
  $("busy").classList.toggle("flex", on);
}

function flash(node, msg, ok = true) {
  node.textContent = msg;
  node.className = "text-sm font-semibold " + (ok ? "text-green-600" : "text-red-600");
  clearTimeout(node._t);
  node._t = setTimeout(() => { node.textContent = ""; }, 4000);
}

/** Sayfadaki göreli bir yolu panelden görüntülenebilir hâle getirir. */
function assetUrl(u) {
  if (!u) return "";
  if (/^(https?:|data:|blob:|\/)/i.test(u)) return u;
  return "../" + u;
}

const AUTH_ERRORS = {
  "auth/invalid-email": "E-posta adresi geçersiz.",
  "auth/user-not-found": "Bu e-posta ile kayıtlı kullanıcı yok.",
  "auth/wrong-password": "Şifre hatalı.",
  "auth/invalid-credential": "E-posta veya şifre hatalı.",
  "auth/too-many-requests": "Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.",
  "auth/network-request-failed": "İnternet bağlantısı kurulamadı."
};

/* ---------- Görsel seçme + Storage'a yükleme ---------- */

function pickFile() {
  return new Promise((resolve) => {
    const input = $("filePicker");
    input.value = "";
    input.onchange = () => resolve(input.files && input.files[0]);
    input.click();
  });
}

async function uploadImage(file) {
  if (!file) return null;
  if (!file.type.startsWith("image/")) { alert("Lütfen bir görsel dosyası seçin."); return null; }
  if (file.size > 8 * 1024 * 1024) { alert("Görsel 8 MB'tan küçük olmalı."); return null; }
  busy(true, "Görsel yükleniyor…");
  try {
    const safe = file.name.replace(/[^\w.\-]+/g, "-").toLowerCase();
    const r = sRef(storage, `site/${Date.now()}-${safe}`);
    await uploadBytes(r, file, { contentType: file.type, cacheControl: "public,max-age=31536000" });
    return await getDownloadURL(r);
  } catch (e) {
    alert("Görsel yüklenemedi: " + e.message);
    return null;
  } finally {
    busy(false);
  }
}

/** Önizleme + "Değiştir" düğmesi olan görsel alanı üretir. */
function imageField(container, value, onChange, { removable = false } = {}) {
  const draw = (v) => {
    container.innerHTML = `
      <div class="flex flex-wrap items-center gap-4">
        <div class="h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
          ${v ? `<img class="h-full w-full object-cover" src="${esc(assetUrl(v))}"/>`
              : `<div class="flex h-full items-center justify-center text-xs text-neutral-400">Görsel yok</div>`}
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-ghost" data-act="up" type="button">
            <span aria-hidden="true" class="material-symbols-outlined text-[18px]">upload</span>${v ? "Değiştir" : "Görsel Yükle"}
          </button>
          ${v && removable ? `<button class="btn btn-danger" data-act="rm" type="button">Kaldır</button>` : ""}
        </div>
      </div>`;
    el('[data-act="up"]', container).onclick = async () => {
      const url = await uploadImage(await pickFile());
      if (url) { onChange(url); draw(url); }
    };
    const rm = el('[data-act="rm"]', container);
    if (rm) rm.onclick = () => { onChange(""); draw(""); };
  };
  draw(value);
}

/** label/value çiftlerinden oluşan tekrarlanabilir satır listesi. */
function repeater(container, rows, fields, addBtn) {
  const state = Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];

  const draw = () => {
    container.innerHTML = state.length ? "" : `<p class="text-xs text-neutral-400">Henüz satır eklenmedi.</p>`;
    state.forEach((row, i) => {
      const wrap = document.createElement("div");
      wrap.className = "flex flex-wrap items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3";
      wrap.innerHTML = fields.map((f) => `
        <div class="${f.wide ? "min-w-[220px] flex-[2]" : "min-w-[140px] flex-1"}">
          <label class="lbl">${esc(f.label)}</label>
          ${f.textarea
            ? `<textarea class="fld" data-k="${f.key}" style="min-height:4rem">${esc(row[f.key] || "")}</textarea>`
            : `<input class="fld" data-k="${f.key}" placeholder="${esc(f.placeholder || "")}" type="text" value="${esc(row[f.key] || "")}"/>`}
        </div>`).join("") +
        `<button aria-label="Satırı sil" class="mt-6 text-neutral-400 hover:text-red-600" data-del="1" type="button">
           <span aria-hidden="true" class="material-symbols-outlined">delete</span></button>`;
      els("[data-k]", wrap).forEach((inp) => {
        inp.oninput = () => { state[i][inp.dataset.k] = inp.value; };
      });
      el("[data-del]", wrap).onclick = () => { state.splice(i, 1); draw(); };
      container.appendChild(wrap);
    });
  };

  if (addBtn) addBtn.onclick = () => { state.push({}); draw(); };
  draw();
  return () => state.filter((r) => Object.values(r).some((v) => String(v || "").trim()));
}

/* ================================ OTURUM ================================= */

let currentUser = null;

function show(view) {
  // display'i doğrudan yönetiyoruz: Tailwind'in "hidden" ve "flex" sınıfları
  // aynı anda bulunduğunda hangisinin kazanacağı sıraya bağlı olurdu.
  ["viewLogin", "viewDenied", "viewApp"].forEach((v) => {
    const n = $(v);
    if (v !== view) { n.style.display = "none"; return; }
    n.classList.remove("hidden");
    n.style.display = v === "viewApp"
      ? (window.innerWidth >= 1024 ? "grid" : "block")
      : "flex";
  });
}

// Panel açıkken pencere genişliği değişirse düzeni koru
window.addEventListener("resize", () => {
  const app = $("viewApp");
  if (app.style.display && app.style.display !== "none") {
    app.style.display = window.innerWidth >= 1024 ? "grid" : "block";
  }
});

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("loginError");
  err.classList.add("hidden");
  $("loginBtn").disabled = true;
  try {
    await signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginPass").value);
  } catch (ex) {
    err.textContent = AUTH_ERRORS[ex.code] || ("Giriş yapılamadı: " + ex.message);
    err.classList.remove("hidden");
  } finally {
    $("loginBtn").disabled = false;
  }
});

$("resetPass").onclick = async () => {
  const mail = $("loginEmail").value.trim();
  if (!mail) { alert("Önce e-posta adresinizi yazın."); return; }
  try {
    await sendPasswordResetEmail(auth, mail);
    alert("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
  } catch (ex) {
    alert(AUTH_ERRORS[ex.code] || ex.message);
  }
};

$("logout").onclick = () => signOut(auth);
$("deniedOut").onclick = () => signOut(auth);
$("deniedRetry").onclick = () => location.reload();
$("deniedCopy").onclick = () => {
  navigator.clipboard.writeText($("deniedUid").textContent)
    .then(() => alert("UID kopyalandı."), () => {});
};

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) { show("viewLogin"); return; }
  let allowed = false;
  try {
    allowed = (await getDoc(doc(db, "admins", user.uid))).exists();
  } catch (_) { allowed = false; }

  if (!allowed) {
    $("deniedUid").textContent = user.uid;
    $("deniedEmail").textContent = user.email || "";
    show("viewDenied");
    return;
  }
  $("whoami").textContent = user.email || "";
  show("viewApp");
  loadSettings();
  loadPageFields();
  loadProjects();
  loadTeklifler();
});

/* ============================== SEKMELER ================================= */

els("[data-tab]").forEach((btn) => {
  btn.onclick = () => {
    els("[data-tab]").forEach((b) => b.classList.toggle("on", b === btn));
    els("[data-panel]").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== btn.dataset.tab));
    if (window.innerWidth < 1024) $("sideNav").classList.add("hidden");
  };
});

$("sideToggle").onclick = () => {
  const open = $("sideNav").classList.toggle("hidden") === false;
  $("sideFooter").classList.toggle("hidden", !open);
  el(".material-symbols-outlined", $("sideToggle")).textContent = open ? "close" : "menu";
};

/* ========================== 1) GENEL BİLGİLER ============================ */

const SETTING_KEYS = ["phone", "email", "address", "mapsUrl", "workingHours", "footerText"];
const SOCIAL_KEYS = ["facebook", "instagram", "linkedin", "youtube", "whatsapp"];

async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, "site", "settings"));
    const s = snap.exists() ? snap.data() : {};
    SETTING_KEYS.forEach((k) => { if ($("s_" + k)) $("s_" + k).value = s[k] || ""; });
    SOCIAL_KEYS.forEach((k) => { $("s_" + k).value = (s.social && s.social[k]) || ""; });
  } catch (e) {
    flash($("settingsStatus"), "Bilgiler okunamadı: " + e.message, false);
  }
}

/* Kaydetmeden önce basit doğrulama.
   Panelde tek harfi eksik kaydedilen bir e-posta sitedeki tüm iletişim
   bağlantılarını sessizce bozar; bunu kaynağında engelliyoruz. */
function ayarlariDogrula() {
  const eposta = $("s_email").value.trim();
  if (eposta && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(eposta)) {
    return `E-posta adresi eksik veya hatalı görünüyor: "${eposta}". Örnek: ornek@firma.com`;
  }
  const telefon = $("s_phone").value.trim();
  if (telefon && telefon.replace(/\D/g, "").length < 10) {
    return `Telefon numarası eksik görünüyor: "${telefon}". Alan koduyla birlikte yazın.`;
  }
  for (const k of SOCIAL_KEYS) {
    const v = $("s_" + k).value.trim();
    if (v && !/^https?:\/\//i.test(v)) {
      return `Sosyal medya adresleri "https://" ile başlamalı. Hatalı alan: ${k}`;
    }
  }
  return null;
}

$("saveSettings").onclick = async () => {
  const hata = ayarlariDogrula();
  if (hata) { flash($("settingsStatus"), hata, false); return; }

  const data = { social: {}, updatedAt: serverTimestamp() };
  SETTING_KEYS.forEach((k) => { data[k] = $("s_" + k).value.trim(); });
  SOCIAL_KEYS.forEach((k) => { data.social[k] = $("s_" + k).value.trim(); });
  busy(true, "Kaydediliyor…");
  try {
    await setDoc(doc(db, "site", "settings"), data, { merge: true });
    flash($("settingsStatus"), "Kaydedildi ✓");
  } catch (e) {
    flash($("settingsStatus"), "Kaydedilemedi: " + e.message, false);
  } finally {
    busy(false);
  }
};

/* ========================= 2) SAYFA İÇERİKLERİ =========================== */

let pageFields = [];      // sayfadan çıkarılan alanlar
let pageSaved = {};       // Firestore'daki mevcut kayıtlar
let pageEdits = {};       // bu oturumda değiştirilenler

$("pageSelect").onchange = loadPageFields;

async function loadPageFields() {
  const id = $("pageSelect").value;
  $("pagePreview").href = `../${id}.html`;
  $("fieldsBox").innerHTML = `<p class="py-10 text-center text-sm text-neutral-400">Yükleniyor…</p>`;
  pageEdits = {};

  // Kayıtlı içerik okunamasa bile sayfadaki alanlar listelenmeli.
  let warning = "";
  try {
    const snap = await getDoc(doc(db, "content", id));
    pageSaved = (snap.exists() && snap.data().fields) || {};
  } catch (e) {
    pageSaved = {};
    warning = `Kayıtlı içerikler okunamadı (${esc(e.message)}). Aşağıda sitedeki mevcut metinler görünüyor.`;
  }

  try {
    const html = await fetch(`../${id}.html`, { cache: "no-store" }).then((r) => r.text());
    pageFields = collectFields(new DOMParser().parseFromString(html, "text/html"));
    renderFields(warning);
  } catch (e) {
    $("fieldsBox").innerHTML =
      `<p class="rounded-lg bg-red-50 p-4 text-sm text-red-700">Sayfa okunamadı: ${esc(e.message)}</p>`;
  }
}

function renderFields(warning = "") {
  const box = $("fieldsBox");
  const warnHtml = warning
    ? `<p class="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">${warning}</p>` : "";
  if (!pageFields.length) {
    box.innerHTML = warnHtml +
      `<p class="py-10 text-center text-sm text-neutral-400">Bu sayfada düzenlenebilir alan bulunamadı.</p>`;
    return;
  }

  // bölümlere göre grupla
  const groups = new Map();
  pageFields.forEach((f) => {
    if (!groups.has(f.section)) groups.set(f.section, []);
    groups.get(f.section).push(f);
  });

  box.innerHTML = warnHtml;
  let first = true;
  groups.forEach((list, section) => {
    const d = document.createElement("details");
    d.className = "card mb-4";
    if (first) { d.open = true; first = false; }
    d.innerHTML = `<summary>
        <span aria-hidden="true" class="material-symbols-outlined chev text-[18px]">chevron_right</span>
        ${esc(section)}
        <span class="ml-auto text-xs font-semibold text-neutral-400">${list.length} alan</span>
      </summary>
      <div class="space-y-6 p-6"></div>`;
    const body = el("div", d);

    list.forEach((f) => {
      const saved = pageSaved[f.key];
      const value = saved != null ? saved : f.value;
      const changed = saved != null;
      const row = document.createElement("div");

      if (f.type === "image") {
        row.innerHTML = `<div class="mb-2 flex items-center gap-2">
            <span class="lbl mb-0">Görsel</span>
            ${changed ? `<span class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">değiştirildi</span>
            <button class="text-[11px] font-bold text-neutral-400 underline hover:text-primary" data-reset="1" type="button">sitedekine döndür</button>` : ""}
          </div>
          <div data-img="1"></div>`;
        imageField(el("[data-img]", row), value, (v) => { pageEdits[f.key] = v; }, { removable: false });
      } else {
        row.innerHTML = `<div class="mb-1.5 flex items-center gap-2">
            <span class="lbl mb-0">${esc(f.el.tagName.toLowerCase().startsWith("h") ? "Başlık" : "Metin")}</span>
            ${changed ? `<span class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">değiştirildi</span>
            <button class="text-[11px] font-bold text-neutral-400 underline hover:text-primary" data-reset="1" type="button">sitedekine döndür</button>` : ""}
          </div>
          ${f.multiline
            ? `<textarea class="fld" data-in="1">${esc(value)}</textarea>`
            : `<input class="fld" data-in="1" type="text" value="${esc(value)}"/>`}`;
        const inp = el("[data-in]", row);
        inp.oninput = () => { pageEdits[f.key] = inp.value; };
      }

      const reset = el("[data-reset]", row);
      if (reset) reset.onclick = () => { pageEdits[f.key] = null; delete pageSaved[f.key]; renderFields(); };

      body.appendChild(row);
    });

    box.appendChild(d);
  });
}

$("saveContent").onclick = async () => {
  const id = $("pageSelect").value;
  const keys = Object.keys(pageEdits);
  if (!keys.length) { flash($("contentStatus"), "Değişiklik yok."); return; }

  const payload = { updatedAt: serverTimestamp(), fields: {} };
  keys.forEach((k) => {
    payload.fields[k] = pageEdits[k] === null ? deleteField() : pageEdits[k];
  });

  busy(true, "Kaydediliyor…");
  try {
    await setDoc(doc(db, "content", id), payload, { merge: true });
    keys.forEach((k) => {
      if (pageEdits[k] === null) delete pageSaved[k];
      else pageSaved[k] = pageEdits[k];
    });
    pageEdits = {};
    renderFields();
    flash($("contentStatus"), "Kaydedildi ✓");
  } catch (e) {
    flash($("contentStatus"), "Kaydedilemedi: " + e.message, false);
  } finally {
    busy(false);
  }
};

/* ============================== 3) PROJELER ============================== */

let projects = [];
let editingId = null;
let getSpecs = () => [], getFeatures = () => [], getNearby = () => [];
let draft = { cover: "", gallery: [], mapImage: "" };

const STATUS_LABEL = { tamamlanan: "Tamamlanan", devam: "Devam Eden", planlanan: "Planlanan" };

async function loadProjects() {
  try {
    const snap = await getDocs(collection(db, "projects"));
    projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    renderProjectList();
  } catch (e) {
    $("projList").innerHTML = `<p class="rounded-lg bg-red-50 p-4 text-sm text-red-700">Projeler okunamadı: ${esc(e.message)}</p>`;
  }
}

function renderProjectList() {
  const box = $("projList");
  if (!projects.length) {
    box.innerHTML = `<div class="card p-10 text-center">
        <p class="mb-1 font-bold">Henüz proje eklenmedi</p>
        <p class="text-sm text-neutral-500">İlk projeyi eklediğinizde sitedeki örnek projelerin yerini alır.</p>
      </div>`;
    return;
  }
  box.innerHTML = "";
  projects.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "card flex flex-wrap items-center gap-4 p-4";
    card.innerHTML = `
      <div class="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        ${p.cover ? `<img class="h-full w-full object-cover" src="${esc(p.cover)}"/>` : ""}
      </div>
      <div class="min-w-[160px] flex-1">
        <p class="font-bold">${esc(p.title || "(adsız proje)")}</p>
        <p class="mt-0.5 text-xs text-neutral-500">${esc([p.location, p.year].filter(Boolean).join(" · "))}</p>
        <div class="mt-1.5 flex flex-wrap gap-1.5">
          <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold">${esc(STATUS_LABEL[p.status] || "—")}</span>
          ${p.featured ? `<span class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">öne çıkan</span>` : ""}
          ${p.published === false ? `<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">yayında değil</span>` : ""}
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button aria-label="Yukarı taşı" class="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-ink" data-up="1" ${i === 0 ? "disabled" : ""} type="button"><span aria-hidden="true" class="material-symbols-outlined text-[20px]">arrow_upward</span></button>
        <button aria-label="Aşağı taşı" class="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-ink" data-down="1" ${i === projects.length - 1 ? "disabled" : ""} type="button"><span aria-hidden="true" class="material-symbols-outlined text-[20px]">arrow_downward</span></button>
        <button class="btn btn-ghost ml-2" data-edit="1" type="button">Düzenle</button>
      </div>`;
    el("[data-edit]", card).onclick = () => openProject(p);
    el("[data-up]", card).onclick = () => moveProject(i, -1);
    el("[data-down]", card).onclick = () => moveProject(i, 1);
    box.appendChild(card);
  });
}

async function moveProject(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= projects.length) return;
  [projects[i], projects[j]] = [projects[j], projects[i]];
  renderProjectList();
  busy(true, "Sıralama kaydediliyor…");
  try {
    await Promise.all(projects.map((p, k) => updateDoc(doc(db, "projects", p.id), { order: k })));
    projects.forEach((p, k) => { p.order = k; });
  } catch (e) {
    alert("Sıralama kaydedilemedi: " + e.message);
  } finally {
    busy(false);
  }
}

function openProject(p) {
  editingId = p ? p.id : null;
  const d = p || {};
  $("projEditTitle").textContent = p ? "Projeyi Düzenle" : "Yeni Proje";
  $("projDelete").style.display = p ? "" : "none";

  $("p_title").value = d.title || "";
  $("p_slug").value = d.slug || "";
  slugOnizle();
  $("p_category").value = d.category || "";
  $("p_location").value = d.location || "";
  $("p_year").value = d.year || "";
  $("p_status").value = d.status || "tamamlanan";
  $("p_order").value = d.order ?? projects.length;
  $("p_summary").value = d.summary || "";
  $("p_description").value = d.description || "";
  $("p_featured").checked = !!d.featured;
  $("p_published").checked = d.published !== false;
  $("p_locationTitle").value = d.locationTitle || "";
  $("p_locationText").value = d.locationText || "";

  draft = { cover: d.cover || "", gallery: [...(d.gallery || [])], mapImage: d.mapImage || "" };

  imageField($("p_coverBox"), draft.cover, (v) => { draft.cover = v; }, { removable: true });
  imageField($("p_mapBox"), draft.mapImage, (v) => { draft.mapImage = v; }, { removable: true });
  renderGallery();

  getSpecs = repeater($("p_specs"), d.specs, [
    { key: "label", label: "Başlık", placeholder: "İnşaat Alanı" },
    { key: "value", label: "Değer", placeholder: "12.500 m²" }
  ], $("p_specsAdd"));

  getFeatures = repeater($("p_features"), d.features, [
    { key: "icon", label: "İkon adı", placeholder: "verified" },
    { key: "title", label: "Başlık", placeholder: "Depreme dayanıklı yapı" },
    { key: "text", label: "Açıklama", wide: true }
  ], $("p_featuresAdd"));

  getNearby = repeater($("p_nearby"), d.nearby, [
    { key: "label", label: "Yer", placeholder: "Metrobüs Durağı" },
    { key: "value", label: "Mesafe", placeholder: "2 Dakika" }
  ], $("p_nearbyAdd"));

  $("projListView").classList.add("hidden");
  $("projEditView").classList.remove("hidden");
  window.scrollTo(0, 0);
}

function renderGallery() {
  const box = $("p_gallery");
  box.innerHTML = draft.gallery.length ? "" :
    `<p class="col-span-full text-xs text-neutral-400">Henüz görsel eklenmedi.</p>`;
  draft.gallery.forEach((url, i) => {
    const d = document.createElement("div");
    d.className = "group relative aspect-[4/3] overflow-hidden rounded-lg border border-neutral-200";
    d.innerHTML = `<img class="h-full w-full object-cover" src="${esc(url)}"/>
      <div class="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button aria-label="Sola al" class="px-1 text-white" data-l="1" type="button"><span aria-hidden="true" class="material-symbols-outlined text-[18px]">chevron_left</span></button>
        <button aria-label="Sil" class="px-1 text-white" data-x="1" type="button"><span aria-hidden="true" class="material-symbols-outlined text-[18px]">delete</span></button>
        <button aria-label="Sağa al" class="px-1 text-white" data-r="1" type="button"><span aria-hidden="true" class="material-symbols-outlined text-[18px]">chevron_right</span></button>
      </div>`;
    el("[data-x]", d).onclick = () => { draft.gallery.splice(i, 1); renderGallery(); };
    el("[data-l]", d).onclick = () => { if (i > 0) { [draft.gallery[i - 1], draft.gallery[i]] = [draft.gallery[i], draft.gallery[i - 1]]; renderGallery(); } };
    el("[data-r]", d).onclick = () => { if (i < draft.gallery.length - 1) { [draft.gallery[i + 1], draft.gallery[i]] = [draft.gallery[i], draft.gallery[i + 1]]; renderGallery(); } };
    box.appendChild(d);
  });
}

$("p_galleryAdd").onclick = async () => {
  const url = await uploadImage(await pickFile());
  if (url) { draft.gallery.push(url); renderGallery(); }
};

/* Adres eki: boşken proje adından ne üretileceğini canlı gösterir. */
function slugOnizle() {
  const deger = $("p_slug").value.trim() || slugify($("p_title").value) || "…";
  $("p_slugPreview").textContent = deger;
}
$("p_slug").oninput = slugOnizle;
$("p_title").addEventListener("input", slugOnizle);

$("projNew").onclick = () => openProject(null);
$("projBack").onclick = () => {
  $("projEditView").classList.add("hidden");
  $("projListView").classList.remove("hidden");
};

$("projSave").onclick = async () => {
  const title = $("p_title").value.trim();
  if (!title) { flash($("projStatus"), "Proje adı zorunlu.", false); return; }

  const data = {
    title,
    slug: ($("p_slug").value.trim() || slugify(title)),
    category: $("p_category").value.trim(),
    location: $("p_location").value.trim(),
    year: $("p_year").value.trim(),
    status: $("p_status").value,
    order: Number($("p_order").value) || 0,
    summary: $("p_summary").value.trim(),
    description: $("p_description").value.trim(),
    featured: $("p_featured").checked,
    published: $("p_published").checked,
    locationTitle: $("p_locationTitle").value.trim(),
    locationText: $("p_locationText").value.trim(),
    cover: draft.cover,
    gallery: draft.gallery,
    mapImage: draft.mapImage,
    specs: getSpecs(),
    features: getFeatures(),
    nearby: getNearby(),
    updatedAt: serverTimestamp()
  };

  busy(true, "Kaydediliyor…");
  try {
    if (editingId) {
      await updateDoc(doc(db, "projects", editingId), data);
    } else {
      data.createdAt = serverTimestamp();
      const r = await addDoc(collection(db, "projects"), data);
      editingId = r.id;
      $("projDelete").style.display = "";
      $("projEditTitle").textContent = "Projeyi Düzenle";
    }
    await loadProjects();
    flash($("projStatus"), "Kaydedildi ✓");
  } catch (e) {
    flash($("projStatus"), "Kaydedilemedi: " + e.message, false);
  } finally {
    busy(false);
  }
};

$("projDelete").onclick = async () => {
  if (!editingId) return;
  if (!confirm("Bu proje kalıcı olarak silinecek. Devam edilsin mi?")) return;
  busy(true, "Siliniyor…");
  try {
    await deleteDoc(doc(db, "projects", editingId));
    await loadProjects();
    $("projBack").click();
  } catch (e) {
    flash($("projStatus"), "Silinemedi: " + e.message, false);
  } finally {
    busy(false);
  }
};

/* =========================== 4) TEKLİF TALEPLERİ ========================= */

async function loadTeklifler() {
  const box = $("teklifList");
  try {
    let docs;
    try {
      docs = (await getDocs(query(collection(db, "teklifler"), orderBy("createdAt", "desc")))).docs;
    } catch (_) {
      docs = (await getDocs(collection(db, "teklifler"))).docs;
    }
    if (!docs.length) {
      box.innerHTML = `<div class="card p-10 text-center text-sm text-neutral-500">Henüz teklif talebi yok.</div>`;
      return;
    }
    box.innerHTML = docs.map((d) => {
      const t = d.data();
      const when = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString("tr-TR") : "";
      return `<div class="card p-5" data-teklif="${esc(d.id)}">
        <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p class="font-bold">${esc(t.name || "—")}</p>
          <div class="flex items-center gap-3">
            <p class="text-xs text-neutral-400">${esc(when)}</p>
            <button aria-label="Talebi sil" class="rounded p-1 text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-600" data-sil="1" title="Talebi sil" type="button">
              <span aria-hidden="true" class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
        <div class="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-600">
          ${t.phone ? `<a class="hover:text-primary" href="tel:${esc(String(t.phone).replace(/[^\d+]/g, ""))}">${esc(t.phone)}</a>` : ""}
          ${t.email ? `<a class="hover:text-primary" href="mailto:${esc(t.email)}">${esc(t.email)}</a>` : ""}
          ${t.projectType ? `<span class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold">${esc(t.projectType)}</span>` : ""}
        </div>
        ${t.message ? `<p class="whitespace-pre-line text-sm leading-relaxed text-neutral-700">${esc(t.message)}</p>` : ""}
      </div>`;
    }).join("");

    // Talep silme — kurallar zaten yöneticiye izin veriyordu, panelde karşılığı yoktu.
    els("[data-teklif]", box).forEach((kart) => {
      el("[data-sil]", kart).onclick = async () => {
        const ad = el(".font-bold", kart).textContent;
        if (!confirm(`"${ad}" adlı talep kalıcı olarak silinecek. Devam edilsin mi?`)) return;
        busy(true, "Siliniyor…");
        try {
          await deleteDoc(doc(db, "teklifler", kart.dataset.teklif));
          await loadTeklifler();
        } catch (e) {
          alert("Talep silinemedi: " + e.message);
        } finally {
          busy(false);
        }
      };
    });
  } catch (e) {
    box.innerHTML = `<p class="rounded-lg bg-red-50 p-4 text-sm text-red-700">Talepler okunamadı: ${esc(e.message)}</p>`;
  }
}
