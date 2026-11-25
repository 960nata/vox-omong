import { describe, expect, it } from "vitest";
import { missedRuns, nextCronRun, parseCron, zonedParts, CronError } from "@/lib/engine/cron";

describe("cron", () => {
  it("menolak ekspresi yang bukan 5 field", () => {
    expect(() => parseCron("0 7 * *")).toThrow(CronError);
  });

  it("menolak nilai di luar jangkauan", () => {
    expect(() => parseCron("0 99 * * *")).toThrow(CronError);
  });

  it("menghitung jadwal harian di timezone target, bukan UTC", () => {
    // 07:00 WIB = 00:00 UTC hari yang sama.
    const next = nextCronRun("0 7 * * *", "Asia/Jakarta", new Date("2026-03-10T01:00:00Z"));
    expect(next?.toISOString()).toBe("2026-03-11T00:00:00.000Z");
    expect(zonedParts(next!, "Asia/Jakarta")).toMatchObject({ hour: 7, minute: 0, day: 11 });
  });

  it("mengerti langkah dan daftar", () => {
    const next = nextCronRun("*/15 * * * *", "UTC", new Date("2026-01-01T10:02:00Z"));
    expect(next?.toISOString()).toBe("2026-01-01T10:15:00.000Z");
  });

  it("menghormati hari dalam seminggu", () => {
    // 2026-11-25 hari Rabu; Jumat (5) berikutnya 2026-11-27.
    const next = nextCronRun("30 9 * * 5", "UTC", new Date("2026-11-25T12:00:00Z"));
    expect(next?.toISOString()).toBe("2026-11-27T09:30:00.000Z");
  });

  it("tetap jam 7 lokal walau timezone-nya kena DST", () => {
    // New York pindah ke DST pada 8 Maret 2026.
    const before = nextCronRun("0 7 * * *", "America/New_York", new Date("2026-03-06T13:00:00Z"));
    const after = nextCronRun("0 7 * * *", "America/New_York", new Date("2026-03-10T13:00:00Z"));
    expect(zonedParts(before!, "America/New_York").hour).toBe(7);
    expect(zonedParts(after!, "America/New_York").hour).toBe(7);
    expect(before!.toISOString().slice(11, 16)).not.toBe(after!.toISOString().slice(11, 16));
  });

  it("mendaftar jadwal yang terlewat di antara dua waktu", () => {
    const missed = missedRuns(
      "0 * * * *",
      "UTC",
      new Date("2026-01-01T00:10:00Z"),
      new Date("2026-01-01T03:05:00Z")
    );
    expect(missed.map((d) => d.toISOString())).toEqual([
      "2026-01-01T01:00:00.000Z",
      "2026-01-01T02:00:00.000Z",
      "2026-01-01T03:00:00.000Z",
    ]);
  });
});
