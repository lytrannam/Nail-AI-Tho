"use client";

import { useEffect, useRef, useState } from "react";
import { translations, Language } from "../../lib/translations";

// ----------------------------------------------------------------------------------
// PHIEN BAN CHINH THUC: ket hop toan bo bai hoc tu qua trinh thu nghiem:
// - Dan hoa tiet that (khong chi to mau dac)
// - Dung dung khop DIP (khong phai PIP) de kich thuoc mong deu nhau tren 5 ngon
// - Lam muot (smoothing) de giam nhap nhay
// - Co rieng (local "cancelled") cho moi lan chay effect, tranh loi console
// - 5 mau co san, doi tuc thi, KHONG goi AI moi lan doi mau
// ----------------------------------------------------------------------------------

const FINGER_TIP_INDICES = [4, 8, 12, 16, 20];
const FINGER_JOINT_INDICES = [3, 7, 11, 15, 19];
const SMOOTHING = 0.35;

type DesignKind = "solid" | "chrome" | "glitter" | "french";

type Design = {
  id: string;
  vi: string;
  en: string;
  kind: DesignKind;
  color: string;
  accent?: string;
};

const DESIGNS: Design[] = [
  { id: "wine", vi: "Đỏ mận", en: "Wine red", kind: "solid", color: "#7B1E3A" },
  { id: "babypink", vi: "Hồng phấn", en: "Baby pink", kind: "solid", color: "#F4C2C2" },
  { id: "chrome", vi: "Ánh kim Chrome", en: "Chrome", kind: "chrome", color: "#F5D0E0", accent: "#C9A8D6" },
  { id: "glitter", vi: "Lấp lánh", en: "Glitter", kind: "glitter", color: "#8C2F4B" },
  { id: "french", vi: "French tip", en: "French tip", kind: "french", color: "#F2D9C4", accent: "#FFFFFF" },
];

function buildTexture(design: Design): HTMLCanvasElement {
  const size = 200;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  if (design.kind === "solid") {
    ctx.fillStyle = design.color;
    ctx.fillRect(0, 0, size, size);
  }

  if (design.kind === "chrome") {
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, design.color);
    gradient.addColorStop(0.25, "#FFFFFF");
    gradient.addColorStop(0.5, design.accent || "#C9A8D6");
    gradient.addColorStop(0.75, "#FFFFFF");
    gradient.addColorStop(1, design.color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  if (design.kind === "glitter") {
    ctx.fillStyle = design.color;
    ctx.fillRect(0, 0, size, size);
    // rac cham lap lanh ngau nhien
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.8 + 0.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.7 + 0.3})`;
      ctx.fill();
    }
  }

  if (design.kind === "french") {
    // nen mau da/nude phu toan bo
    ctx.fillStyle = design.color;
    ctx.fillRect(0, 0, size, size);
    // dau trang chiem 30% ben PHAI (huong ve phia dau ngon tay sau khi xoay)
    ctx.fillStyle = design.accent || "#FFFFFF";
    ctx.fillRect(size * 0.7, 0, size * 0.3, size);
  }

  return c;
}

type SmoothedPoint = { x: number; y: number };

export default function LiveTryOnPage() {
  const [lang, setLang] = useState<Language>("vi");
  const [modelReady, setModelReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedDesignId, setSelectedDesignId] = useState(DESIGNS[0].id);
  const [isCapturing, setIsCapturing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const t = translations[lang] as any;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<any>(null);
  const rafIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const textureRef = useRef<HTMLCanvasElement | null>(null);
  const selectedDesignRef = useRef(selectedDesignId);

  const smoothedTipsRef = useRef<(SmoothedPoint | null)[]>([null, null, null, null, null]);
  const smoothedJointsRef = useRef<(SmoothedPoint | null)[]>([null, null, null, null, null]);

  // Cap nhat texture ngay khi doi mau, khong can goi AI, khong can tai lai camera
  useEffect(() => {
    selectedDesignRef.current = selectedDesignId;
    const design = DESIGNS.find((d) => d.id === selectedDesignId) || DESIGNS[0];
    textureRef.current = buildTexture(design);
  }, [selectedDesignId]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        if (!textureRef.current) {
          const design = DESIGNS.find((d) => d.id === selectedDesignRef.current) || DESIGNS[0];
          textureRef.current = buildTexture(design);
        }

        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

        if (cancelled) {
          handLandmarker.close();
          return;
        }
        handLandmarkerRef.current = handLandmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: 720, height: 960 },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        if (cancelled) return;

        setCameraError(null);
        setModelReady(true);
        predictLoop();
      } catch (err) {
        console.error("Live try-on init error:", err);
        if (!cancelled) {
          setCameraError(t.liveTryonCameraError);
        }
      }
    };

    const smooth = (prev: SmoothedPoint | null, next: SmoothedPoint): SmoothedPoint => {
      if (!prev) return next;
      return {
        x: prev.x * SMOOTHING + next.x * (1 - SMOOTHING),
        y: prev.y * SMOOTHING + next.y * (1 - SMOOTHING),
      };
    };

    const predictLoop = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const handLandmarker = handLandmarkerRef.current;
      const texture = textureRef.current;

      if (video && canvas && handLandmarker && texture && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const result = handLandmarker.detectForVideo(video, Date.now());

          if (result.landmarks && result.landmarks.length > 0) {
            const hand = result.landmarks[0];

            for (let i = 0; i < FINGER_TIP_INDICES.length; i++) {
              const tip = hand[FINGER_TIP_INDICES[i]];
              const joint = hand[FINGER_JOINT_INDICES[i]];
              if (!tip || !joint) continue;

              const rawTip = { x: tip.x * canvas.width, y: tip.y * canvas.height };
              const rawJoint = { x: joint.x * canvas.width, y: joint.y * canvas.height };

              const smoothedTip = smooth(smoothedTipsRef.current[i], rawTip);
              const smoothedJoint = smooth(smoothedJointsRef.current[i], rawJoint);

              smoothedTipsRef.current[i] = smoothedTip;
              smoothedJointsRef.current[i] = smoothedJoint;

              const angle = Math.atan2(
                smoothedTip.y - smoothedJoint.y,
                smoothedTip.x - smoothedJoint.x
              );
              const dist = Math.hypot(
                smoothedTip.x - smoothedJoint.x,
                smoothedTip.y - smoothedJoint.y
              );
              const ovalLength = Math.max(dist * 0.95, 14);
              const ovalWidth = ovalLength * 0.7;

              const centerX = smoothedTip.x - Math.cos(angle) * (ovalLength * 0.25);
              const centerY = smoothedTip.y - Math.sin(angle) * (ovalLength * 0.25);

              ctx.save();
              ctx.translate(centerX, centerY);
              ctx.rotate(angle);
              ctx.beginPath();
              ctx.ellipse(0, 0, ovalLength / 2, ovalWidth / 2, 0, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(texture, -ovalLength / 2, -ovalWidth / 2, ovalLength, ovalWidth);
              ctx.restore();

              ctx.save();
              ctx.translate(centerX, centerY);
              ctx.rotate(angle);
              ctx.beginPath();
              ctx.ellipse(0, 0, ovalLength / 2, ovalWidth / 2, 0, 0, Math.PI * 2);
              ctx.lineWidth = 1.5;
              ctx.strokeStyle = "rgba(255,255,255,0.7)";
              ctx.stroke();
              ctx.restore();
            }
          } else {
            smoothedTipsRef.current = [null, null, null, null, null];
            smoothedJointsRef.current = [null, null, null, null, null];
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(predictLoop);
    };

    init();

    return () => {
      cancelled = true;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      handLandmarkerRef.current?.close();
      handLandmarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const design = DESIGNS.find((d) => d.id === selectedDesignId) || DESIGNS[0];

    setIsCapturing(true);
    setGenError(null);
    setResultImage(null);

    try {
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const colorName = `${design.vi} / ${design.en}`;

      const res = await fetch("/api/try-on", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageDataUrl,
          colorHex: design.color,
          colorName,
          style: design.kind,
        }),
      });

      if (!res.ok) throw new Error("try-on request failed");

      const data = await res.json();
      const resultUrl: string | undefined = data.imageUrl || data.image || data.result;
      if (!resultUrl) throw new Error("no image returned");

      setResultImage(resultUrl);
    } catch (err) {
      console.error("Capture/generate error:", err);
      setGenError(t.liveTryonGenError);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display, inherit)", fontSize: 22, margin: 0 }}>
          {t.liveTryonTitle}
        </h1>
        <button
          onClick={() => setLang(lang === "vi" ? "en" : "vi")}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "4px 12px",
            background: "var(--surface)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          🌐 {t.switchLang}
        </button>
      </div>
      <p style={{ color: "var(--foreground-soft)", fontSize: 14, marginTop: 4 }}>
        {t.liveTryonSubtitle}
      </p>

      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "3 / 4",
          borderRadius: 16,
          overflow: "hidden",
          background: "#111",
          marginTop: 16,
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <video ref={videoRef} playsInline muted style={{ display: "none" }} />
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />

        {!modelReady && !cameraError && (
          <div style={overlayCenterStyle}>{t.liveTryonLoadingModel}</div>
        )}
        {cameraError && (
          <div style={{ ...overlayCenterStyle, color: "#ffb4b4" }}>{cameraError}</div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          {t.liveTryonChooseDesign}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {DESIGNS.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDesignId(d.id)}
              title={lang === "vi" ? d.vi : d.en}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: 13,
                cursor: "pointer",
                border:
                  selectedDesignId === d.id
                    ? "2px solid var(--accent)"
                    : "1px solid var(--border)",
                background: selectedDesignId === d.id ? "var(--accent-soft)" : "var(--surface)",
                color: "var(--foreground)",
                fontWeight: selectedDesignId === d.id ? 600 : 400,
              }}
            >
              {lang === "vi" ? d.vi : d.en}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCapture}
        disabled={!modelReady || isCapturing || !!cameraError}
        style={{
          marginTop: 20,
          width: "100%",
          padding: "14px 0",
          borderRadius: 12,
          border: "none",
          background: "var(--accent)",
          color: "white",
          fontSize: 15,
          fontWeight: 600,
          cursor: modelReady && !isCapturing ? "pointer" : "not-allowed",
          opacity: modelReady && !isCapturing ? 1 : 0.6,
          boxShadow: "0 4px 14px rgba(255,45,120,0.3)",
        }}
      >
        {isCapturing ? t.liveTryonCapturing : t.liveTryonCaptureBtn}
      </button>

      {genError && <p style={{ color: "#c0392b", fontSize: 13, marginTop: 10 }}>{genError}</p>}

      {resultImage && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {t.liveTryonResultTitle}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultImage}
            alt="result"
            style={{ width: "100%", borderRadius: 16, display: "block", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
          />
          <button
            onClick={() => setResultImage(null)}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "10px 0",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              cursor: "pointer",
            }}
          >
            {t.liveTryonTryAgain}
          </button>
        </div>
      )}
    </div>
  );
}

const overlayCenterStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "white",
  fontSize: 14,
  textAlign: "center",
  padding: 20,
  background: "rgba(0,0,0,0.35)",
};
