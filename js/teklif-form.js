/* Doruk İnşaat — teklif alma formu
 *
 * Talepler `teklifler` koleksiyonuna yazılır, bilgilendirme e-postası ise
 * Trigger Email eklentisinin `mail` kuyruğuna bırakılır.
 *
 * Not: Turnstile doğrulaması yalnızca tarayıcıda kontrol edilir; asıl koruma
 * firestore.rules dosyasındadır (alıcı adresi sabit, alanlar sınırlı).
 */

import { db } from "./firebase.js";
import { MAIL_ALICI } from "./site-config.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("teklifForm");
if (form) {
  const durumEl = document.getElementById("formStatus");
  const buton = document.getElementById("submitButton");
  const butonIcerik = buton.innerHTML;

  const deger = (id) => document.getElementById(id).value.trim();

  function durum(mesaj, tur) {
    durumEl.textContent = mesaj;
    durumEl.classList.remove("hidden", "text-green-600", "text-red-600");
    durumEl.classList.add(tur === "ok" ? "text-green-600" : "text-red-600");
  }

  function mesgul(acik) {
    buton.disabled = acik;
    buton.innerHTML = acik ? "Gönderiliyor..." : butonIcerik;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = form.querySelector('[name="cf-turnstile-response"]')?.value;
    if (!token) {
      durum("Lütfen güvenlik doğrulamasını tamamlayın.", "hata");
      return;
    }

    const name = deger("name");
    const phone = deger("phone");
    const email = deger("email");
    const message = deger("message");
    const projectType =
      form.querySelector('input[name="projectType"]:checked')?.value || "";

    mesgul(true);

    try {
      await addDoc(collection(db, "teklifler"), {
        name,
        phone,
        email,
        projectType,
        message,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      durum("Talebiniz gönderilemedi. Lütfen tekrar deneyin ya da bize telefonla ulaşın.", "hata");
      mesgul(false);
      return;
    }

    // Bilgilendirme e-postası ayrı denenir: kuyruğa yazılamasa bile talep
    // panele düştüğü için ziyaretçiye hata gösterilmez.
    try {
      await addDoc(collection(db, "mail"), {
        to: [MAIL_ALICI],
        message: {
          subject: `Yeni teklif talebi — ${name}`,
          text:
            `Siteden yeni bir teklif talebi geldi.\n\n` +
            `Ad Soyad: ${name}\n` +
            `Telefon: ${phone || "—"}\n` +
            `E-posta: ${email || "—"}\n` +
            `Proje Tipi: ${projectType || "—"}\n\n` +
            `Mesaj:\n${message || "—"}`
        }
      });
    } catch (err) {
      console.error("Bilgilendirme e-postası kuyruğa alınamadı:", err);
    }

    form.reset();
    // Doğrulama tek kullanımlıktır: yeni gönderim için pencereyi tazele
    window.turnstile?.reset(form.querySelector(".cf-turnstile"));
    durum("✔ Teklif talebiniz bize ulaştı. En kısa sürede size dönüş yapacağız.", "ok");
    mesgul(false);
  });
}
