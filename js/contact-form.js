/* Doruk İnşaat — iletişim sayfası mesaj formu
 *
 * Mesajlar teklif talepleriyle aynı `teklifler` koleksiyonuna yazılır ve
 * yönetim panelindeki "Teklif Talepleri" listesinde "İletişim Formu"
 * etiketiyle görünür. Böylece gelen tüm talepler tek yerde toplanır ve
 * Firestore kurallarında değişiklik gerekmez.
 */

import { db } from "./firebase.js";
import { MAIL_ALICI } from "./site-config.js";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ETIKET = "İletişim Formu";

const form = document.getElementById("contactForm");
if (form) {
  const durumEl = document.getElementById("contactStatus");
  const buton = document.getElementById("contactSubmit");
  const butonIcerik = buton.innerHTML;
  const turnstileKutu = form.querySelector(".cf-turnstile");

  const deger = (id) => document.getElementById(id).value.trim();

  function durum(mesaj, tur) {
    durumEl.textContent = mesaj;
    durumEl.classList.remove("hidden", "text-green-600", "text-red-600");
    durumEl.classList.add(tur === "ok" ? "text-green-600" : "text-red-600");
  }

  function meshgul(acik) {
    buton.disabled = acik;
    buton.innerHTML = acik ? "Gönderiliyor..." : butonIcerik;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = deger("contactName");
    const email = deger("contactEmail");
    const phone = deger("contactPhone");
    const message = deger("contactMessage");

    // Size ulaşabilmemiz için en az bir iletişim kanalı gerekli
    if (!email && !phone) {
      durum("Size dönebilmemiz için e-posta veya telefon bilgilerinizden birini girin.", "hata");
      return;
    }

    const token = form.querySelector('[name="cf-turnstile-response"]')?.value;
    if (!token) {
      durum("Lütfen güvenlik doğrulamasını tamamlayın.", "hata");
      return;
    }

    meshgul(true);

    try {
      await addDoc(collection(db, "teklifler"), {
        name,
        phone,
        email,
        projectType: ETIKET,
        message,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      durum("Mesajınız gönderilemedi. Lütfen tekrar deneyin ya da bize telefonla ulaşın.", "hata");
      meshgul(false);
      return;
    }

    // Bilgilendirme e-postası ayrı denenir: kuyruğa yazılamasa bile
    // mesaj panele düştüğü için ziyaretçiye hata gösterilmez.
    try {
      await addDoc(collection(db, "mail"), {
        to: [MAIL_ALICI],
        message: {
          subject: `Yeni ${ETIKET} mesajı — ${name}`,
          text:
            `Sitedeki iletişim formundan yeni bir mesaj geldi.\n\n` +
            `Ad Soyad: ${name}\n` +
            `Telefon: ${phone || "—"}\n` +
            `E-posta: ${email || "—"}\n\n` +
            `Mesaj:\n${message}`,
        },
      });
    } catch (err) {
      console.error("Bilgilendirme e-postası kuyruğa alınamadı:", err);
    }

    form.reset();
    window.turnstile?.reset(turnstileKutu);
    durum("✔ Mesajınız bize ulaştı. En kısa sürede size dönüş yapacağız.", "ok");
    meshgul(false);
  });
}
