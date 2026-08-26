/* Doruk İnşaat – tüm sayfalarda ortak davranışlar
   (mobil menü, tema değiştirme, footer telif yılı) */
(function () {
  "use strict";

  /* --- Mobil menü aç/kapat --- */
  var toggle = document.querySelector("[data-menu-toggle]");
  var panel = document.getElementById("mobil-menu");
  var icon = document.querySelector("[data-menu-icon]");

  function setMenu(open) {
    if (!panel || !toggle) return;
    panel.classList.toggle("hidden", !open);
    toggle.setAttribute("aria-expanded", String(open));
    if (icon) icon.textContent = open ? "close" : "menu";
  }

  if (toggle && panel) {
    toggle.addEventListener("click", function () {
      setMenu(panel.classList.contains("hidden"));
    });

    // Masaüstü genişliğine geçilince paneli kapat
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 768) setMenu(false);
    });

    // Escape ile kapat
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
    });
  }

  /* --- Aydınlık / karanlık tema ---
     Sınıf, sayfa <head> içindeki küçük betikle daha ilk boyamadan önce
     uygulanır; burada yalnızca değiştirme düğmesi yönetilir. */
  var TEMA_ANAHTARI = "doruk-tema";
  var kok = document.documentElement;

  function temaUygula(tema) {
    kok.classList.toggle("dark", tema === "dark");
    kok.classList.toggle("light", tema !== "dark");
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(tema === "dark"));
    });
  }

  temaUygula(kok.classList.contains("dark") ? "dark" : "light");

  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var yeni = kok.classList.contains("dark") ? "light" : "dark";
      temaUygula(yeni);
      try { localStorage.setItem(TEMA_ANAHTARI, yeni); } catch (e) { /* yok sayılır */ }
    });
  });

  // Kullanıcı kendi seçimini yapmadıysa işletim sistemi tercihini izle
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
      var secim = null;
      try { secim = localStorage.getItem(TEMA_ANAHTARI); } catch (err) { /* yok sayılır */ }
      if (!secim) temaUygula(e.matches ? "dark" : "light");
    });
  }

  /* --- Footer telif yılı --- */
  var year = String(new Date().getFullYear());
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = year;
  });
})();
