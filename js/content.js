/* Doruk İnşaat — genel site içerik motoru
 *
 * Yönetim panelinden kaydedilen içerikleri sayfaya uygular:
 *   1) site/settings  → telefon, e-posta, adres, harita, sosyal medya
 *   2) content/{sayfa} → başlık, paragraf ve görsel değişiklikleri
 *
 * HTML'deki mevcut içerik varsayılan olarak kalır; Firestore'da kayıt yoksa
 * ya da bağlantı kurulamazsa sayfa olduğu gibi görünmeye devam eder.
 */

import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { collectFields, applyField, pageId } from "./cms-keys.js";

/* ------------------------------------------------------------------ */
/* 1) Site geneli ayarlar                                              */
/* ------------------------------------------------------------------ */

const URL_KEYS = new Set(["mapsUrl"]);
const GECERLI_EPOSTA = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Değeri boşken tamamen gizlenmesi gereken kutuyu bulur.
 *  `data-site-item` (ör. telefon satırı) veya `data-social-item` işaretli
 *  en yakın ata; yoksa elemanın kendisi. */
function kutu(el) {
  return el.closest("[data-site-item]") || el.closest("[data-social-item]") || el;
}

/** Bir kutunun görünürlüğünü hangi ayar anahtarı belirliyor?
 *  `data-site-item="phone"` → yalnızca telefon boşsa gizlenir.
 *  `data-site-item=""`      → içindeki alanın kendi anahtarı belirler. */
function kutuAnahtari(box, key) {
  return box.getAttribute("data-site-item") || key;
}

export function applySettings(s) {
  if (!s) return;

  document.querySelectorAll("[data-site]").forEach((el) => {
    const key = el.getAttribute("data-site");
    const value = key.split(".").reduce((o, k) => (o == null ? o : o[k]), s);
    const bos = value == null || String(value).trim() === "";

    // Sosyal medya: adres girilmemişse bağlantıyı gizle
    if (key.startsWith("social.")) {
      const box = kutu(el);
      if (bos) { box.style.display = "none"; return; }
      box.style.display = "";
      el.setAttribute("href", value);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
      return;
    }

    // İşaretli satırlar (telefon gibi) panelde doldurulana dek görünmez —
    // ziyaretçiye yanlış/uydurma bir bilgi göstermektense hiç göstermemek yeğdir.
    const box = el.closest("[data-site-item]");
    if (box && kutuAnahtari(box, key) === key) box.style.display = bos ? "none" : "";

    if (bos) return;

    if (URL_KEYS.has(key)) { el.setAttribute("href", value); return; }

    // Panelde bozuk kaydedilmiş bir değer, şablondaki doğru yedeği ezmemeli:
    // "dorukemlakgayrimenkul" gibi yarım bir adres tıklanamaz bir bağlantı üretir.
    if (key === "email" && !GECERLI_EPOSTA.test(String(value).trim())) {
      console.warn("[içerik] Paneldeki e-posta geçersiz, şablondaki adres korundu:", value);
      return;
    }
    if (key === "phone" && String(value).replace(/\D/g, "").length < 10) {
      console.warn("[içerik] Paneldeki telefon eksik görünüyor, şablondaki değer korundu:", value);
      return;
    }

    if (el.tagName === "A") {
      if (key === "phone") el.setAttribute("href", "tel:" + String(value).replace(/[^\d+]/g, ""));
      else if (key === "email") el.setAttribute("href", "mailto:" + String(value).trim());
    }
    el.textContent = value;
  });

  yapisalVeriyiEsitle(s);

  // Hiçbir sosyal hesap girilmemişse başlığıyla birlikte bölümün tamamı gizlenir;
  // aksi hâlde ortada boş bir "Sosyal Medya" başlığı kalırdı.
  document.querySelectorAll("[data-social-group]").forEach((grup) => {
    const acik = [...grup.querySelectorAll("[data-social-item]")]
      .some((i) => i.style.display !== "none");
    grup.style.display = acik ? "" : "none";
  });
}

/* ------------------------------------------------------------------ */
/* 2) Yapısal veri (schema.org) — panel bilgileriyle eşitleme          */
/* ------------------------------------------------------------------ */

/** Telefonu E.164 biçimine yaklaştırır: 0212... -> +90212... */
function telE164(v) {
  const d = String(v || "").replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("+")) return d;
  if (d.startsWith("0")) return "+90" + d.slice(1);
  if (d.startsWith("90")) return "+" + d;
  return "+90" + d;
}

/**
 * Sayfadaki JSON-LD bloğunu paneldeki güncel iletişim bilgileriyle günceller.
 * Böylece firma bilgisi değiştiğinde HTML'e elle dokunmak gerekmez.
 * Geçersiz/eksik değerler yazılmaz — hatalı yapısal veri hiç olmamasından kötüdür.
 */
function yapisalVeriyiEsitle(s) {
  const not = document.querySelector('script[type="application/ld+json"][data-schema="kurulus"]');
  if (!not || !s) return;
  let veri;
  try { veri = JSON.parse(not.textContent); } catch (e) { return; }

  const liste = Array.isArray(veri) ? veri : [veri];
  const kurulus = liste.find((x) => x["@type"] === "GeneralContractor");
  if (!kurulus) return;

  const tel = telE164(s.phone);
  if (tel.length >= 12) kurulus.telephone = tel;

  // E-posta yalnızca gerçekten geçerliyse yazılır
  if (GECERLI_EPOSTA.test(String(s.email || "").trim())) {
    kurulus.email = s.email.trim();
  }

  if (s.address && String(s.address).trim().length > 10) {
    kurulus.address = { ...kurulus.address, streetAddress: String(s.address).trim() };
  }

  const sosyal = Object.values(s.social || {}).filter((u) => /^https?:\/\//i.test(String(u || "")));
  if (sosyal.length) kurulus.sameAs = sosyal;
  if (s.mapsUrl) kurulus.hasMap = s.mapsUrl;

  not.textContent = JSON.stringify(liste.length === 1 ? liste[0] : liste, null, 2);
}

/* ------------------------------------------------------------------ */
/* 3) Sayfa metin ve görselleri                                        */
/* ------------------------------------------------------------------ */

function applyContent(fieldsMap) {
  if (!fieldsMap) return;
  collectFields(document).forEach((f) => {
    const v = fieldsMap[f.key];
    if (v != null && v !== "") applyField(f, v);
  });
}

/* ------------------------------------------------------------------ */

async function boot() {
  const id = pageId();
  try {
    const [settingsSnap, contentSnap] = await Promise.all([
      getDoc(doc(db, "site", "settings")),
      getDoc(doc(db, "content", id))
    ]);
    if (settingsSnap.exists()) applySettings(settingsSnap.data());
    if (contentSnap.exists()) applyContent(contentSnap.data().fields);
  } catch (err) {
    // İçerik çekilemezse sayfa statik hâliyle çalışmaya devam eder.
    console.warn("[içerik] Firestore'dan içerik alınamadı:", err.message);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
