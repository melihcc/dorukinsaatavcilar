import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const form = document.getElementById("teklifForm");
const status = document.getElementById("formStatus");
const submitButton = document.getElementById("submitButton");


form.addEventListener("submit", async (e) => {

  e.preventDefault();

   const token = document.querySelector('[name="cf-turnstile-response"]')?.value;

  if (!token) {
    alert("Lütfen güvenlik doğrulamasını tamamlayın.");
    return;
  }

  submitButton.disabled = true;
  submitButton.innerText = "Gönderiliyor...";

  const name = document.getElementById("name").value;
  const phone = document.getElementById("phone").value;
  const email = document.getElementById("email").value;

  const projectType =
    document.querySelector('input[name="projectType"]:checked')?.value || "";

  const message = document.getElementById("message").value;


  try {

    // 1️⃣ Teklifi Firestore'a kaydet

    await addDoc(collection(db, "teklifler"), {
      name,
      phone,
      email,
      projectType,
      message,
      createdAt: serverTimestamp()
    });


    // 2️⃣ Email göndermek için mail collection'a yaz

    await addDoc(collection(db, "mail"), {

      to: ["dorukemlakgayrimenkul@gmail.com"],

      message: {
        subject: "Yeni Teklif Talebi",

        text:
`Yeni teklif formu gönderildi

Ad: ${name}
Telefon: ${phone}
Email: ${email}
Proje Tipi: ${projectType}

Mesaj:
${message}`
      }

    });


    status.classList.remove("hidden");
    status.classList.add("text-green-600");

    status.innerText =
      "✔ Teklif talebiniz gönderildi.";

    form.reset();


  } catch (error) {

    status.classList.remove("hidden");
    status.classList.add("text-red-500");

    status.innerText =
      "Bir hata oluştu.";

    console.error(error);

  }

  submitButton.disabled = false;
  submitButton.innerText = "Teklifi Gönder";

});