import { SlideDeckData } from "../types";

export interface VideoRenderOptions {
  fps?: number;
  slideDurationSec?: number;
  onProgress?: (progressPercent: number, currentSlide: number, totalSlides: number) => void;
}

export async function renderSlideDeckToVideo(
  deck: SlideDeckData,
  options: VideoRenderOptions = {}
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("Video rendering is only supported in browser environments.");
  }

  const fps = options.fps || 30;
  const slideDurationSec = options.slideDurationSec || 3.5;
  const totalSlides = deck.slides.length;
  const totalFramesPerSlide = Math.floor(fps * slideDurationSec);

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D canvas context");

  const stream = canvas.captureStream(fps);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  } catch {
    recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      resolve(blob);
    };
  });

  recorder.start();

  for (let sIdx = 0; sIdx < totalSlides; sIdx++) {
    const slide = deck.slides[sIdx];

    for (let frame = 0; frame < totalFramesPerSlide; frame++) {
      const progressInSlide = frame / totalFramesPerSlide;

      // 1. Cyber Dark Gradient Background
      const grad = ctx.createLinearGradient(0, 0, 1280, 720);
      grad.addColorStop(0, "#080a0f");
      grad.addColorStop(0.5, "#121522");
      grad.addColorStop(1, "#07090d");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);

      // Subtle Background Grid
      ctx.strokeStyle = "rgba(40, 48, 66, 0.2)";
      ctx.lineWidth = 1;
      for (let x = 0; x < 1280; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 720);
        ctx.stroke();
      }
      for (let y = 0; y < 720; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1280, y);
        ctx.stroke();
      }

      // Top Terracotta Accent Bar
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(80, 60, 8, 45);

      // Deck Subtitle
      ctx.font = "bold 15px 'Courier New', monospace";
      ctx.fillStyle = "#ea580c";
      ctx.fillText("VOX·AI PRESENTATION ENGINE", 100, 78);

      ctx.font = "13px 'Courier New', monospace";
      ctx.fillStyle = "#718096";
      ctx.fillText(`SLIDE ${sIdx + 1} OF ${totalSlides}`, 100, 98);

      // Slide Title (Alpha fade-in + slide transition)
      const titleAlpha = Math.min(1, frame / 10);
      const titleOffset = Math.max(0, (1 - frame / 10) * 15);
      ctx.globalAlpha = titleAlpha;
      ctx.font = "bold 38px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(slide.title, 80, 180 + titleOffset);
      ctx.globalAlpha = 1;

      // Divider line
      ctx.strokeStyle = "#273142";
      ctx.beginPath();
      ctx.moveTo(80, 210);
      ctx.lineTo(1200, 210);
      ctx.stroke();

      // Bullets (Cascading animation)
      slide.bullets.forEach((bullet, bIdx) => {
        const bulletStartFrame = 10 + bIdx * 16;
        if (frame >= bulletStartFrame) {
          const bAlpha = Math.min(1, (frame - bulletStartFrame) / 10);
          const bOffset = Math.max(0, (1 - (frame - bulletStartFrame) / 10) * 12);
          ctx.globalAlpha = bAlpha;

          // Glowing Bullet Dot
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.arc(95, 275 + bIdx * 65 + bOffset, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = "22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillStyle = "#cbd5e1";
          ctx.fillText(bullet, 120, 283 + bIdx * 65 + bOffset);
          ctx.globalAlpha = 1;
        }
      });

      // Speaker Notes Bar at bottom
      if (slide.speakerNotes) {
        ctx.fillStyle = "rgba(18, 22, 32, 0.85)";
        ctx.fillRect(80, 590, 1120, 55);
        ctx.strokeStyle = "#2d3748";
        ctx.strokeRect(80, 590, 1120, 55);

        ctx.font = "italic 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`Speaker Note: ${slide.speakerNotes}`, 100, 624);
      }

      // Dynamic Slide Progress Bar at the bottom
      const overallProgress = (sIdx + progressInSlide) / totalSlides;
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(0, 712, 1280 * overallProgress, 8);

      await new Promise((r) => setTimeout(r, 1000 / fps));
    }

    if (options.onProgress) {
      const pct = Math.round(((sIdx + 1) / totalSlides) * 100);
      options.onProgress(pct, sIdx + 1, totalSlides);
    }
  }

  recorder.stop();
  return await recordPromise;
}
