// ============================================================
// Site CallCenter - TOOLS — comportamento
// - menu mobile + link ativo + ano dinâmico
// - header com sombra ao rolar
// - reveal on scroll (IntersectionObserver)
// - cursor tracking (ponto + anel) e glow seguindo o mouse
// - parallax discreto da gem no hero
// ============================================================
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    // ---- Menu mobile ----
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var aberto = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", aberto ? "true" : "false");
      });
      nav.addEventListener("click", function (e) {
        if (e.target.tagName === "A") {
          nav.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    // ---- Ano dinâmico ----
    var ano = document.getElementById("ano");
    if (ano) ano.textContent = new Date().getFullYear();

    // ---- Link ativo conforme a URL ----
    var aqui = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll(".nav a, .docs-aside a").forEach(function (a) {
      var alvo = (a.getAttribute("href") || "").split("/").pop().toLowerCase();
      if (alvo === aqui) a.classList.add("active");
    });

    // ---- Header sombra ao rolar ----
    var header = document.querySelector(".site-header");
    var aoRolar = function () {
      if (!header) return;
      header.classList.toggle("scrolled", window.scrollY > 8);
    };
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });

    // ---- Reveal on scroll ----
    var alvos = document.querySelectorAll("[data-reveal]");
    if ("IntersectionObserver" in window && alvos.length) {
      var io = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
      alvos.forEach(function (el) { io.observe(el); });
    } else {
      alvos.forEach(function (el) { el.classList.add("in"); });
    }

    // ---- Cursor tracking (ponto + anel) ----
    var fino = window.matchMedia("(pointer: fine)").matches;
    var reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fino && !reduz) {
      var dot = document.createElement("span");
      var ring = document.createElement("span");
      dot.className = "cur-dot";
      ring.className = "cur-ring";
      dot.setAttribute("aria-hidden", "true");
      ring.setAttribute("aria-hidden", "true");
      document.body.appendChild(dot);
      document.body.appendChild(ring);

      var mx = -100, my = -100, rx = -100, ry = -100;
      var ligado = false;

      document.addEventListener("mousemove", function (e) {
        mx = e.clientX;
        my = e.clientY;
        if (!ligado) {
          document.body.classList.add("cur-on");
          rx = mx; ry = my;
          ligado = true;
        }
        dot.style.transform = "translate(" + (mx - 3.5) + "px," + (my - 3.5) + "px)";

        // glow do hero acompanha o cursor (--mx / --my)
        var hero = document.querySelector(".hero");
        if (hero) {
          var r = hero.getBoundingClientRect();
          if (e.clientY >= r.top && e.clientY <= r.bottom) {
            hero.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
            hero.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
          }
        }
      }, { passive: true });

      document.addEventListener("mouseleave", function () {
        document.body.classList.remove("cur-on");
        ligado = false;
      });

      // anel com atraso (rAF)
      (function anel() {
        rx += (mx - rx) * 0.16;
        ry += (my - ry) * 0.16;
        ring.style.transform = "translate(" + (rx - 17) + "px," + (ry - 17) + "px)";
        requestAnimationFrame(anel);
      })();

      // cresce sobre elementos interativos
      document.addEventListener("mouseover", function (e) {
        if (e.target.closest("a,button,.card,.feature,.btn")) {
          document.body.classList.add("cur-hover");
        }
      });
      document.addEventListener("mouseout", function (e) {
        if (e.target.closest("a,button,.card,.feature,.btn")) {
          document.body.classList.remove("cur-hover");
        }
      });

      // ---- Parallax discreto da gem ----
      var gem = document.querySelector(".gem-wrap");
      if (gem) {
        document.addEventListener("mousemove", function (e) {
          var dx = (e.clientX / window.innerWidth - 0.5) * 14;
          var dy = (e.clientY / window.innerHeight - 0.5) * 10;
          gem.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)";
        }, { passive: true });
      }
    }
  });
})();
