import type { Page } from "playwright-core";

export type JobListing = { title: string; company: string; location: string; salary: string; url: string; source: string };

/** Ekstraksi dari DOM/JSON-LD halaman yang dibuka; kolom yang tidak tercantum tetap kosong. */
export async function scrapeJobs(page: Page): Promise<JobListing[]> {
  return page.evaluate(() => {
    const rows: { title: string; company: string; location: string; salary: string; url: string; source: string }[] = [];
    const seen = new Set<string>();
    const clean = (v: unknown) => typeof v === "string" || typeof v === "number" ? String(v).replace(/\s+/g, " ").trim().slice(0, 300) : "";
    const safeUrl = (value: string) => {
      try {
        const u = new URL(value, location.href);
        if (!["http:", "https:"].includes(u.protocol)) return "";
        u.hash = "";
        for (const k of [...u.searchParams.keys()]) if (/^(utm_|tracking|refId|trk)/i.test(k)) u.searchParams.delete(k);
        return u.href;
      } catch { return ""; }
    };
    const add = (v: typeof rows[number]) => {
      const url = safeUrl(v.url);
      if (!v.title || !url || rows.length >= 30) return;
      const key = `${url}|${v.title.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ ...v, url });
    };
    const readNode = (v: unknown, depth = 0) => {
      if (!v || depth > 8) return;
      if (Array.isArray(v)) { v.slice(0, 100).forEach(x => readNode(x, depth + 1)); return; }
      if (typeof v !== "object") return;
      const o = v as Record<string, unknown>;
      if (o["@graph"]) readNode(o["@graph"], depth + 1);
      if (o.itemListElement) readNode(o.itemListElement, depth + 1);
      if (o.item) readNode(o.item, depth + 1);
      if (![o["@type"]].flat().includes("JobPosting")) return;
      const org = o.hiringOrganization as Record<string, unknown> | undefined;
      const places = [o.jobLocation].flat().filter(Boolean) as Record<string, unknown>[];
      const locations = places.map(p => {
        const a = p.address as Record<string, unknown> | undefined;
        return a ? [a.addressLocality, a.addressRegion, a.addressCountry].map(clean).filter(Boolean).join(", ") : clean(p.name);
      }).filter(Boolean);
      const base = o.baseSalary as Record<string, unknown> | undefined;
      const amount = base?.value as Record<string, unknown> | string | number | undefined;
      const value = amount && typeof amount === "object"
        ? [amount.minValue, amount.maxValue].map(clean).filter(Boolean).join("–") || clean(amount.value)
        : clean(amount);
      add({ title: clean(o.title), company: clean(org?.name), location: locations.join("; ") || (o.jobLocationType === "TELECOMMUTE" ? "Remote" : ""), salary: value ? `${clean(base?.currency)} ${value}${amount && typeof amount === "object" && amount.unitText ? ` / ${clean(amount.unitText)}` : ""}`.trim() : "", url: clean(o.url) || location.href, source: location.href });
    };
    for (const node of [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0, 30)) {
      if ((node.textContent?.length || 0) > 1_000_000) continue;
      try { readNode(JSON.parse(node.textContent || "null")); } catch { /* data situs tidak valid */ }
    }
    const text = (root: Element, selector: string) => clean(root.querySelector(selector)?.textContent);
    const anchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/jobs/view/"],a[href*="/job/"],a[data-automation="jobTitle"],a.base-card__full-link')].slice(0, 150);
    for (const a of anchors) {
      const r = a.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const card = a.closest('article,li,.base-card,[data-automation="job-card"]') || a.parentElement || a;
      const title = text(card, 'h3,.base-search-card__title,[data-automation="jobTitle"]') || clean(a.textContent);
      if (!title || /^(apply|lamar|lihat|view|sign in)/i.test(title)) continue;
      add({ title, company: text(card, '.base-search-card__subtitle,[data-automation="jobCompany"],[data-automation="jobCompanyLink"],[data-testid="company-name"]'), location: text(card, '.job-search-card__location,[data-automation="jobLocation"],[data-testid="job-location"]'), salary: text(card, '[data-automation="jobSalary"],.job-search-card__salary-info,[data-testid="job-salary"]'), url: a.href, source: location.href });
    }
    return rows;
  });
}

export function formatJobs(rows: JobListing[]): string {
  const cell = (s: string) => s.replace(/[\r\n|]/g, " ").replace(/[\[\]<>*_`]/g, "");
  const link = (url: string) => url.replace(/[\s()<>]/g, c => encodeURIComponent(c));
  return `Ditemukan ${rows.length} lowongan dari halaman yang dibuka. Kolom kosong berarti tidak tercantum.\n\n| Posisi | Perusahaan | Lokasi | Gaji | Tautan |\n|---|---|---|---|---|\n${rows.map(r => `| ${cell(r.title)} | ${cell(r.company) || "—"} | ${cell(r.location) || "—"} | ${cell(r.salary) || "—"} | [Lihat lowongan](${link(r.url)}) |`).join("\n")}`;
}
