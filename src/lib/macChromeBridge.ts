import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface ChromeTabInfo {
  title: string;
  url: string;
}

export interface ChromeScrapeResult {
  success: boolean;
  title?: string;
  url?: string;
  text?: string;
  error?: string;
  needsPermission?: boolean;
}

/** Periksa apakah Google Chrome sedang aktif berjalan di macOS */
export async function isMacChromeRunning(): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  try {
    const { stdout } = await execFileAsync("osascript", ["-e", 'tell application "Google Chrome" to return (count of windows)']);
    const count = parseInt(stdout.trim(), 10);
    return !isNaN(count) && count > 0;
  } catch {
    return false;
  }
}

/** Buka tab baru di jendela aktif Google Chrome nyata milik pengguna */
export async function openTabInUserChrome(targetUrl: string): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  try {
    const script = `
      tell application "Google Chrome"
        activate
        if (count of windows) = 0 then
          make new window
          set URL of active tab of front window to "${targetUrl}"
        else
          tell front window
            make new tab with properties {URL:"${targetUrl}"}
          end tell
        end if
        return "OK"
      end tell
    `;
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    return stdout.includes("OK");
  } catch {
    return false;
  }
}

/** Cari tab yang sedang membuka URL serupa atau buka tab baru, lalu ekstrak teksnya */
export async function scrapeUserChromeTab(targetUrl: string, autoOpen = true): Promise<ChromeScrapeResult> {
  if (process.platform !== "darwin") {
    return { success: false, error: "Fitur integrasi Chrome lokal langsung saat ini hanya aktif di macOS." };
  }

  const isRunning = await isMacChromeRunning();
  if (!isRunning) {
    return { success: false, error: "Google Chrome belum berjalan di desktop Mac kamu." };
  }

  // Jika diminta buka tab dan belum ada tab yang cocok
  if (autoOpen) {
    try {
      const checkScript = `
        tell application "Google Chrome"
          repeat with w in windows
            repeat with t in tabs of w
              if URL of t contains "${targetUrl}" or "${targetUrl}" contains URL of t then
                return (name of t & "|||" & URL of t)
              end if
            end repeat
          end repeat
          return "NOT_FOUND"
        end tell
      `;
      const { stdout: checkOut } = await execFileAsync("osascript", ["-e", checkScript]);
      if (checkOut.trim() === "NOT_FOUND") {
        await openTabInUserChrome(targetUrl);
        // Tunggu sejenak agar halaman di tab baru mulai dimuat
        await new Promise((r) => setTimeout(r, 2500));
      }
    } catch {
      // lanjut ke langkah pembacaan
    }
  }

  // Coba eksekusi ekstraksi DOM via AppleScript
  try {
    const jsPayload = `
      (function() {
        var h1 = document.querySelector('h1')?.innerText || '';
        var headline = document.querySelector('.text-body-medium, [data-generated-suggestion-target]')?.innerText || '';
        var about = document.querySelector('#about ~ div, section:has(#about)')?.innerText || '';
        var exp = document.querySelector('#experience ~ div, section:has(#experience)')?.innerText || '';
        var skills = document.querySelector('#skills ~ div, section:has(#skills)')?.innerText || '';
        var body = document.body ? document.body.innerText : '';
        return JSON.stringify({
          title: document.title,
          h1: h1,
          headline: headline,
          about: about,
          experience: exp,
          skills: skills,
          fullText: body.slice(0, 12000)
        });
      })()
    `.replace(/\n\s*/g, " ");

    const readScript = `
      tell application "Google Chrome"
        repeat with w in windows
          repeat with t in tabs of w
            if URL of t contains "${targetUrl}" or "${targetUrl}" contains URL of t or URL of t contains "linkedin.com/in/" then
              set tabTitle to (name of t)
              set tabUrl to (URL of t)
              set tabData to (execute t javascript "${jsPayload.replace(/"/g, '\\"')}")
              return tabTitle & "|||" & tabUrl & "|||" & tabData
            end if
          end repeat
        end repeat
        return "NOT_FOUND"
      end tell
    `;

    const { stdout } = await execFileAsync("osascript", ["-e", readScript]);
    const trimmed = stdout.trim();
    if (trimmed === "NOT_FOUND") {
      return { success: false, error: "Tab dengan URL tersebut tidak ditemukan di Google Chrome." };
    }

    const parts = trimmed.split("|||");
    const title = parts[0] || "";
    const tabUrl = parts[1] || "";
    const rawJson = parts.slice(2).join("|||");

    try {
      const parsed = JSON.parse(rawJson);
      const structuredText = [
        parsed.h1 ? `Nama: ${parsed.h1}` : "",
        parsed.headline ? `Headline: ${parsed.headline}` : "",
        parsed.about ? `About / Ringkasan:\n${parsed.about}` : "",
        parsed.experience ? `Pengalaman Kerja:\n${parsed.experience}` : "",
        parsed.skills ? `Keahlian / Skills:\n${parsed.skills}` : "",
        `--- Konten Halaman Penuh ---\n${parsed.fullText}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      return {
        success: true,
        title,
        url: tabUrl,
        text: structuredText,
      };
    } catch {
      return {
        success: true,
        title,
        url: tabUrl,
        text: rawJson || "Konten berhasil diakses dari tab Google Chrome.",
      };
    }
  } catch (err: unknown) {
    const msg = (err as Error).message || "";
    if (msg.includes("Allow JavaScript from Apple Events") || msg.includes("Eksekusi JavaScript melalui AppleScript dinonaktifkan")) {
      return {
        success: false,
        needsPermission: true,
        error: "Google Chrome membutuhkan izin eksekusi JavaScript sekali saja di menu: View > Developer > Allow JavaScript from Apple Events.",
      };
    }
    return {
      success: false,
      error: `Gagal membaca dari Google Chrome: ${msg}`,
    };
  }
}
