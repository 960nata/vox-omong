/**
 * Dijalankan di <head> sebelum render:
 * 1. Pasang tema tersimpan (dark/light) agar tidak berkedip (FOUC).
 * 2. Neutralisir injeksi atribut dari ekstensi browser (Urban VPN/CRX/Bitdefender/LanguageTool)
 *    seperti `bis_skin_checked` agar tidak menyebabkan React 19 Hydration Mismatch.
 * 3. Lindungi konsol agar peringatan palsu akibat ekstensi browser tidak memicu Redbox Dev Overlay Next.js.
 */
export const THEME_STORAGE_KEY = "vox_theme";

export const THEME_BOOT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem("${THEME_STORAGE_KEY}");
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  } catch(e){}

  if (typeof window === "undefined") return;

  try {
    Object.defineProperty(Element.prototype, "bis_skin_checked", {
      get: function() { return "1"; },
      set: function() {},
      configurable: true
    });
    var origSet = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, val) {
      if (name === "bis_skin_checked" || name === "bis_register") return;
      return origSet.apply(this, arguments);
    };
  } catch(e){}

  try {
    var obs = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "attributes" && (m.attributeName === "bis_skin_checked" || m.attributeName === "bis_register")) {
          m.target.removeAttribute(m.attributeName);
        }
      }
    });
    obs.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["bis_skin_checked", "bis_register"] });
  } catch(e){}

  try {
    var currentError = console.error;
    Object.defineProperty(console, "error", {
      configurable: true,
      enumerable: true,
      get: function() {
        return function() {
          var full = "";
          for (var i = 0; i < arguments.length; i++) {
            var a = arguments[i];
            full += typeof a === "string" ? a : (a && a.message ? a.message : (a && a.stack ? a.stack : ""));
          }
          if (full.indexOf("bis_skin_checked") !== -1 || full.indexOf("bis_register") !== -1 || (full.indexOf("hydrat") !== -1 && full.indexOf("extension") !== -1)) {
            return;
          }
          return currentError.apply(console, arguments);
        };
      },
      set: function(fn) {
        currentError = fn;
      }
    });

    window.addEventListener("error", function(e) {
      var msg = (e.message || "") + " " + (e.error ? (e.error.message || "") + (e.error.stack || "") : "");
      if (msg.indexOf("bis_skin_checked") !== -1 || msg.indexOf("bis_register") !== -1) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
  } catch(e){}
})();
`.replace(/\n\s*/g, "");
