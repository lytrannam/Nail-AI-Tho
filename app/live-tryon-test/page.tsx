"use client";

import { useEffect, useRef, useState } from "react";
import type { HandLandmarker as HandLandmarkerType } from "@mediapipe/tasks-vision";

// ----------------------------------------------------------------------------------
// PHIEN BAN 3: them ky thuat "lam muot" (smoothing) de giam nhap nhay.
// Moi diem tren tay duoc "tron" giua vi tri cu va vi tri moi, thay vi nhay thang
// sang vi tri moi ngay lap tuc.
// ----------------------------------------------------------------------------------

const FINGER_TIP_INDICES = [4, 8, 12, 16, 20];
const FINGER_JOINT_INDICES = [3, 7, 11, 15, 19];

// He so lam muot: cang gan 1 thi cang muot nhung cang "tre" (lag) theo tay thuc te.
// 0.35 la muc can bang hop ly giua muot va nhanh nhay.
const SMOOTHING = 0.35;

function createChromeTexture(): HTMLCanvasElement {
  const size = 200;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#F5D0E0");
  gradient.addColorStop(0.25, "#FFFFFF");
  gradient.addColorStop(0.5, "#C9A8D6");
  gradient.addColorStop(0.75, "#FFFFFF");
  gradient.addColorStop(1, "#F5D0E0");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return c;
}

type SmoothedPoint = { x: number; y: number };

export default function LiveTryOnTestPage() {
  const [modelReady, setModelReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarkerType | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const textureRef = useRef<HTMLCanvasElement | null>(null);

  // Luu vi tri "da lam muot" cua tung dau ngon tay va khop ngon tay, qua tung khung hinh.
  const smoothedTipsRef = useRef<(SmoothedPoint | null)[]>([null, null, null, null, null]);
  const smoothedJointsRef = useRef<(SmoothedPoint | null)[]>([null, null, null, null, null]);

  useEffect(() => {
    let cancelled = false; // co rieng cua LAN CHAY NAY, khong dung chung voi lan khac
    textureRef.current = createChromeTexture();

    const init = async () => {
      try {
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
          video: { facingMode: "user", width: 720, height: 960 },
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

        setCameraError(null);
        setModelReady(true);
        predictLoop();
      } catch (err) {
        console.error("Test init error:", err);
        if (!cancelled) {
          setCameraError("Không thể khởi động. Xem Console để biết chi tiết.");
        }
      }
    };

    // Ham lam muot: tron vi tri cu va vi tri moi theo he so SMOOTHING
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

              // Mong tay chi chiem khoang 35% chieu dai dot ngon cuoi, khong phai
              // toan bo khoang cach den khop. Rieng chieu rong thi mong kha "map",
              // nen ty le rong/dai lon hon truoc.
              const ovalLength = Math.max(dist * 0.95, 14);
              const ovalWidth = ovalLength * 0.7;

              // Dich tam oval lui mot chut ve phia khop (khong dat dung o dau tuyet
              // doi cua ngon tay), vi dau ngon tay (landmark tip) thuong nam o phan
              // thit dau ngon, hoi vuot qua mep mong that mot chut.
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
            // Khong thay tay trong khung hinh nay: xoa het vi tri cu de tranh
            // hinh oval "dung im" o cho cu khi tay da di chuyen ra khoi camera.
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
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px" }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>🧪 Thử nghiệm v8: sửa cờ hủy dùng chung (fix triệt để lỗi console)</h1>
      <p style={{ color: "#777", fontSize: 13, marginTop: 6 }}>
        So sánh với bản trước: hình oval phải bớt rung/giật hơn hẳn.
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
        }}
      >
        <video ref={videoRef} playsInline muted style={{ display: "none" }} />
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />

        {!modelReady && !cameraError && (
          <div
            style={{
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
            }}
          >
            Đang tải model...
          </div>
        )}
        {cameraError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffb4b4",
              fontSize: 14,
              textAlign: "center",
              padding: 20,
              background: "rgba(0,0,0,0.35)",
            }}
          >
            {cameraError}
          </div>
        )}
      </div>
    </div>
  );
}
