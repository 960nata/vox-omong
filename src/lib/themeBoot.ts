/** Dijalankan di <head> sebelum render: pasang tema tersimpan supaya tidak berkedip. */
export const THEME_STORAGE_KEY = "vox_theme";
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}`;
