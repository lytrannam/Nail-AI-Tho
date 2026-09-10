"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { HandLandmarker as HandLandmarkerType } from "@mediapipe/tasks-vision";

type Lang = "vi" | "en";

interface ColorOption {
  id: string;
  hex: string;
  vi: string;
  en: string;
}

interface StyleOption {
  id: "plain" | "light" | "detailed";
  vi: string;
  en: string;
}

const COLORS: ColorOption[] = [
  { id: "wine", hex: "#7B1E3A", vi: "Đỏ mận", en: "Wine red" },
  { id: "babypink", hex: "#F4C2C2", vi: "Hồng phấn", en: "Baby pink" },
  { id: "milkywhite", hex: "#F5F0E6", vi: "Trắng sữa", en: "Milky white" },
  { id: "nudebeige", hex: "#D9B99B", vi: "Nude be", en: "Nude beige" },
  { id: "velvetblack", hex: "#1C1C1C", vi: "Đen nhung", en: "Velvet black" },
  { id: "tealgreen", hex: "#2E8B79", vi: "Xanh ngọc", en: "Teal green" },
];

const STYLES: StyleOption[] = [
  { id: "plain", vi: "Trơn", en: "Plain" },
  { id: "light", vi: "Nhẹ", en: "Light" },
  { id: "detailed", vi: "Cầu kỳ", en: "Detailed" },
];

const FINGER_TIP_INDICES = [4, 8, 12, 16, 20];
const FINGER_JOINT_INDICES = [3, 6, 10, 14, 18];

const T = {
  title: { vi: "Thử màu trực tiếp qua camera", en: "Live Camera Try-On" },
  subtitle: {
    vi: "Đưa tay vào khung hình, chọn màu, rồi chụp ảnh đẹp",
    en: "Put your hand in frame, pick a color, then capture a polished photo",
  },
  loadingModel: { vi: "Đang tải mô hình nhận diện tay…", en: "Loading hand detection model…" },
  cameraError: {
    vi: "Không thể truy cập camera. Hãy cho phép quyền camera trên trình duyệt.",
    en: "Could not access the camera. Please allow camera permission in your browser.",
  },
  colorLabel: { vi: "Chọn màu", en: "Pick a color" },
  styleLabel: { vi: "Mức độ họa tiết", en: "Pattern level" },
  captureBtn: { vi: "Chọn màu này, làm ảnh đẹp", en: "Pick this color, make it pretty" },
  capturing: { vi: "Đang tạo ảnh đẹp…", en: "Generating your photo…" },
  tryAgain: { vi: "Thử lại", en: "Try again" },
  resultTitle: { vi: "Kết quả", en: "Result" },
  genError: { vi: "Tạo ảnh thất bại, thử lại nhé.", en: "Generation failed, please try again." },
} as const;

export default function LiveTryOnPage() {
  const [lang, setLang] = useState<Lang>("vi");
  const [modelReady, setModelReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<ColorOption>(COLORS[0]);
  const [selectedStyle, setSelectedStyle] = useState<StyleOption>(STYLES[0]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarkerType | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const colorRef = useRef(selectedColor);

  useEffect(() => {
    colorRef.current = selectedColor;
  }, [selectedColor]);

  const t = useCallback((key: keyof typeof T) => T[key][lang], [lang]);

  const drawOvalOnTip = (
    ctx: CanvasRenderingContext2D,
    tipX: number,
    tipY: number,
    jointX: number,
    jointY: number,
    color: string
  ) => {
    const angle = Math.atan2(tipY - jointY, tipX - jointX);
    const dist = Math.hypot(tipX - jointX, tipY - jointY);
    const ovalLength = Math.max(dist * 0.9, 14);
    const ovalWidth = ovalLength * 0.55;

    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, ovalLength / 2, ovalWidth / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.stroke();
    ctx.restore();
  };


 useEffect(() => {
  cancelledRef.current = false;

  const predictLoop = () => {
    if (cancelledRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const handLandmarker = handLandmarkerRef.current;

    if (video && canvas && handLandmarker && video.readyState >= 2) {
      try {
        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const result = handLandmarker.detectForVideo(
            video,
            performance.now()
          );

          if (result.landmarks && result.landmarks.length > 0) {
            for (const hand of result.landmarks) {
              for (let i = 0; i < FINGER_TIP_INDICES.length; i++) {
                const tip = hand[FINGER_TIP_INDICES[i]];
                const joint = hand[FINGER_JOINT_INDICES[i]];

                if (!tip || !joint) continue;

                drawOvalOnTip(
                  ctx,
                  tip.x * canvas.width,
                  tip.y * canvas.height,
                  joint.x * canvas.width,
                  joint.y * canvas.height,
                  colorRef.current.hex
                );
              }
            }
          }
        }
      } catch (err) {
        console.error("Hand detection error:", err);
      }
    }

    rafIdRef.current = requestAnimationFrame(predictLoop);
  };

  const init = async () => {
    try {
      // Mở camera trước
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      if (cancelledRef.current) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();

      // Camera đã chạy thành công
      setCameraError(null);

      // Sau đó tải MediaPipe
      const { FilesetResolver, HandLandmarker } =
        await import("@mediapipe/tasks-vision");

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      const handLandmarker =
        await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

      if (cancelledRef.current) {
        handLandmarker.close();
        return;
      }

      handLandmarkerRef.current = handLandmarker;

      setModelReady(true);
      predictLoop();
    } catch (err) {
      console.error("Live try-on init error:", err);

      if (!cancelledRef.current) {
        const error = err as Error;

        if (
          error.name === "NotAllowedError" ||
          error.name === "NotFoundError" ||
          error.name === "NotReadableError" ||
          error.name === "OverconstrainedError"
        ) {
          setCameraError(t("cameraError"));
        } else {
          setCameraError(
            lang === "vi"
              ? "Camera đã mở nhưng mô hình nhận diện tay bị lỗi."
              : "Camera opened, but the hand detection model failed."
          );
        }
      }
    }
  };

  init();

  return () => {
    cancelledRef.current = true;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    handLandmarkerRef.current?.close();
    handLandmarkerRef.current = null;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  const handleCapture = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsCapturing(true);
    setGenError(null);
    setResultImage(null);

    try {
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const colorName = `${selectedColor.vi} / ${selectedColor.en}`;

      const res = await fetch("/api/try-on", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageDataUrl,
          colorHex: selectedColor.hex,
          colorName,
          style: selectedStyle.id,
        }),
      });

      if (!res.ok) throw new Error("try-on request failed");

      const data = await res.json();
      const resultUrl: string | undefined = data.imageUrl || data.image || data.result;
      if (!resultUrl) throw new Error("no image returned");

      setResultImage(resultUrl);
    } catch (err) {
      console.error("Capture/generate error:", err);
      setGenError(t("genError"));
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display, inherit)", fontSize: 22, margin: 0 }}>
          {t("title")}
        </h1>
        <button
          onClick={() => setLang(lang === "vi" ? "en" : "vi")}
          style={{
            border: "1px solid #ddd",
            borderRadius: 999,
            padding: "4px 12px",
            background: "white",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {lang === "vi" ? "English" : "Tiếng Việt"}
        </button>
      </div>
      <p style={{ color: "#777", fontSize: 14, marginTop: 4 }}>{t("subtitle")}</p>

      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "3 / 4",
          borderRadius: 16,
          overflow: "hidden",
          background: "#111",
          marginTop: 16,
        }}
      >
        <video ref={videoRef} playsInline muted style={{ display: "none" }} />
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />

        {!modelReady && !cameraError && (
          <div style={overlayCenterStyle}>{t("loadingModel")}</div>
        )}
        {cameraError && (
          <div style={{ ...overlayCenterStyle, color: "#ffb4b4" }}>{cameraError}</div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t("colorLabel")}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedColor(c)}
              title={lang === "vi" ? c.vi : c.en}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: c.hex,
                border:
                  selectedColor.id === c.id
                    ? "3px solid var(--accent, #b03a5b)"
                    : "2px solid #ddd",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t("styleLabel")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStyle(s)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 10,
                border:
                  selectedStyle.id === s.id
                    ? "2px solid var(--accent, #b03a5b)"
                    : "1px solid #ddd",
                background: selectedStyle.id === s.id ? "#fdf1f4" : "white",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {lang === "vi" ? s.vi : s.en}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleCapture}
        disabled={!modelReady || isCapturing || !!cameraError}
        style={{
          marginTop: 20,
          width: "100%",
          padding: "14px 0",
          borderRadius: 12,
          border: "none",
          background: "var(--accent, #b03a5b)",
          color: "white",
          fontSize: 15,
          fontWeight: 600,
          cursor: modelReady && !isCapturing ? "pointer" : "not-allowed",
          opacity: modelReady && !isCapturing ? 1 : 0.6,
        }}
      >
        {isCapturing ? t("capturing") : t("captureBtn")}
      </button>

      {genError && (
        <p style={{ color: "#c0392b", fontSize: 13, marginTop: 10 }}>{genError}</p>
      )}

      {resultImage && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t("resultTitle")}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultImage}
            alt="result"
            style={{ width: "100%", borderRadius: 16, display: "block" }}
          />
          <button
            onClick={() => setResultImage(null)}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "10px 0",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
            }}
          >
            {t("tryAgain")}
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