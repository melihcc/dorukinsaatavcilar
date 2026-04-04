import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyBoImj9l5uVa35r-0E7N-bH5Xnlgpno-j8",
  authDomain: "doruk-insaat-site.firebaseapp.com",
  projectId: "doruk-insaat-site",
  storageBucket: "doruk-insaat-site.firebasestorage.app",
  messagingSenderId: "761848752729",
  appId: "1:761848752729:web:91784cc2427f97c10d9f48",
  measurementId: "G-PHBTLENRHQ"
};


const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);