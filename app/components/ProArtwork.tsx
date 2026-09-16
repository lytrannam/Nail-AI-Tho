import Image from "next/image";
import Link from "next/link";
import styles from "./ProArtwork.module.css";

const copy = {
  welcome: ["Không gian riêng cho thợ nail", "Your own nail artist space", "Giới thiệu phong cách của bạn, lưu mẫu nail và kết nối với khách hàng.", "Showcase your style, keep your designs and connect with your clients."],
  customers: ["Chăm chút từng khách hàng", "A personal touch for every client", "Mẫu nail, sở thích và những lần hẹn — cùng bạn tạo nên trải nghiệm riêng.", "Designs, preferences and appointments — for a more personal experience."],
  portfolio: ["Dấu ấn trên từng bộ móng", "Your signature in every design", "Xây dựng bộ sưu tập từ những tác phẩm của chính bạn.", "Build a collection of your own nail artistry."],
  qr: ["Một lần quét, thêm kết nối", "One scan, a new connection", "Chia sẻ mã QR cá nhân để khách dễ dàng tìm đến bạn.", "Share your personal QR code so clients can find you easily."],
  stats: ["Nhìn lại hành trình của bạn", "See your progress", "Theo dõi hoạt động với khách hàng của bạn.", "Keep track of your activity with your clients."],
  profile: ["Phong cách của bạn. Dấu ấn của bạn.", "Your style. Your signature.", "Hoàn thiện hồ sơ cá nhân để khách nhận ra bạn.", "Make your personal profile unmistakably yours."],
} as const;

export default function ProArtwork({ variant, lang = "vi" }: { variant: keyof typeof copy; lang?: "vi" | "en" }) {
  const vi = lang === "vi";
  const text = copy[variant];
  const portrait = variant === "profile" || variant === "welcome";
  const source = portrait ? "artist-signature.png" : variant === "qr" || variant === "stats" ? "minimal.png" : "floral.png";
  return (
    <section className={styles.panel} aria-label={vi ? "Không gian thợ nail cá nhân" : "Independent nail artist space"}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>AL NAIL AI · FOR NAIL ARTISTS</p>
        <h2>{text[vi ? 0 : 1]}</h2>
        <p className={styles.description}>{text[vi ? 2 : 3]}</p>
        {variant === "welcome" && <Link className={styles.link} href="/login">{vi ? "Vào không gian thợ nail" : "Enter your artist space"}<span aria-hidden="true"> →</span></Link>}
      </div>
      <div className={styles.art}>
        <Image src={`/pro-assets/${source}`} alt={vi ? "Ảnh minh họa mẫu nail hồng với chi tiết trang trí tinh tế" : "Illustrative pink manicure with delicate nail art"} fill sizes="(max-width: 520px) 120px, 260px" style={{ objectFit: "cover" }} />
      </div>
    </section>
  );
}
