import pptxgen from "pptxgenjs";
import { SlideDeckData } from "../types";

export async function exportToPptxFile(deck: SlideDeckData) {
  if (typeof window === "undefined") return;

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = deck.deckTitle;

  deck.slides.forEach((s, idx) => {
    const slide = pres.addSlide();
    
    // Dark Industrial Studio Theme (#0b0d13)
    slide.background = { color: "0B0D13" };

    // Accent line in Terracotta Orange
    slide.addShape(pres.ShapeType.rect, {
      x: 0.6,
      y: 0.6,
      w: 0.08,
      h: 0.7,
      fill: { color: "EA580C" },
    });

    // Top Category / Subtitle
    slide.addText(`VOX·AI STUDIO | SLIDE ${idx + 1} OF ${deck.slides.length}`, {
      x: 0.85,
      y: 0.6,
      w: 8.0,
      h: 0.3,
      fontSize: 10,
      color: "EA580C",
      fontFace: "Courier New",
      bold: true,
    });

    // Slide Title
    slide.addText(s.title, {
      x: 0.85,
      y: 0.9,
      w: 11.5,
      h: 0.9,
      fontSize: 26,
      color: "FFFFFF",
      fontFace: "Segoe UI",
      bold: true,
    });

    // Bullets list
    const bulletItems = s.bullets.map((b) => ({
      text: b,
      options: {
        fontSize: 15,
        color: "D1D5DB",
        bullet: true,
        breakLine: true,
      },
    }));

    slide.addText(bulletItems, {
      x: 0.85,
      y: 2.2,
      w: 11.0,
      h: 4.0,
      fontFace: "Segoe UI",
      margin: 0.1,
    });

    // Bottom Presenter Note if present
    if (s.speakerNotes) {
      slide.addNotes(s.speakerNotes);
      slide.addText(`Presenter Note: ${s.speakerNotes}`, {
        x: 0.85,
        y: 6.4,
        w: 11.0,
        h: 0.5,
        fontSize: 10,
        color: "718096",
        italic: true,
      });
    }
  });

  const filename = `${deck.deckTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.pptx`;
  await pres.writeFile({ fileName: filename });
}
