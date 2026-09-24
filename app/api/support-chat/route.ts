import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMinutes: number
): Promise<boolean> {
  const windowMs = windowMinutes * 60 * 1000;

  const { data, error: selectError } = await supabaseAdmin
    .from("api_rate_limits")
    .select("count, window_start")
    .eq("key", key)
    .maybeSingle();

  if (selectError) {
    throw new Error("rate_limit_infra_error");
  }

  const now = Date.now();

  if (!data || now - new Date(data.window_start).getTime() > windowMs) {
    const { error: upsertError } = await supabaseAdmin
      .from("api_rate_limits")
      .upsert({
        key,
        count: 1,
        window_start: new Date().toISOString(),
      });

    if (upsertError) {
      throw new Error("rate_limit_infra_error");
    }

    return true;
  }

  if (data.count >= maxRequests) {
    return false;
  }

  const { error: updateError } = await supabaseAdmin
    .from("api_rate_limits")
    .update({ count: data.count + 1 })
    .eq("key", key);

  if (updateError) {
    throw new Error("rate_limit_infra_error");
  }

  return true;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

// "Kien thuc nen" ve app - AI CHI duoc tra loi dua tren dung noi dung nay,
// khong duoc bia dat them thong tin ngoai pham vi nay.
const KNOWLEDGE_BASE = `
THONG TIN VE APP AL NAIL AI:

1. DANG KY & DUNG THU:
- Tao tai khoan bang email + mat khau tai trang /login.
- Sau khi dang ky, phai kiem tra email (ke ca muc Spam) va bam vao link xac nhan
  truoc khi dang nhap lan dau.
- Hien app dang mien phi hoan toan trong giai doan thu nghiem, chua thu tien.
- Cac goi tra phi du kien trong tuong lai (chua ap dung): Tho ca nhan $9.99/thang,
  Salon nhieu tho $6.99-7.99/tho/thang. Xem chi tiet o trang /pricing.

2. KHACH CUA TOI (/customers): luu ten, sdt, email khach; tu nhac khi khach qua
   3 tuan chua quay lai; co the gui email nhac qua nut "Gui nhac".

3. PORTFOLIO (/portfolio): tho tai anh nail da lam len, AI tu phan loai theo
   tong da va do kho; co nut "Chia se" tu dong them ma QR + watermark "Made
   with AL Nail AI" len anh.

4. HO SO CA NHAN (/profile): dat ten hien thi, anh dai dien, link Instagram/
   TikTok/Facebook; bat "Cong khai" de co trang rieng (/u/tenkhach) + ma QR
   cho khach quet vao xem Portfolio.

5. LIVE CAMERA TRY-ON (/live-tryon): dua tay khach vao camera, chon mau/kieu
   co san (do man, hong phan, chrome, lap lanh, french tip) de xem thu ngay
   lap tuc, khong ton phi. Sau khi khach ung y, bam nut de AI tao 1 anh that
   dep, chan thuc (mat vai chuc giay).

6. TRANG CHU (/): khach tu chup tay, AI goi y 4 mau hop tong da; co the thu
   len tay toi da 2 lan de so sanh; neu khong dang nhap van co the luu thong
   tin lai qua "Save & show to technician".

7. MOI THO MOI (/invite): co ma QR in ra dan o tiem, tho moi quet vao se tu
   tao tai khoan rieng cua ho (khong dung chung tai khoan).

8. LOI THUONG GAP:
- Khong nhan duoc email xac nhan: kiem tra muc Spam; Supabase gioi han gui
  toi da vai email/gio, cho vai phut roi thu lai.
- Camera khong mo duoc: kiem tra da cho phep quyen camera cho trinh duyet
  chua (bieu tuong o dau thanh dia chi).
- Anh AI bi lech mot chut o 1-2 ngon tay: day la gioi han binh thuong cua
  cong nghe AI hien nay, co the bam "Thu lai" de tao lai.
`;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    // Toi da 15 cau hoi/IP/gio - du dung binh thuong, chan duoc lam dung.
    const allowed = await checkRateLimit(`support-chat:${ip}`, 15, 60);

    if (!allowed) {
      return Response.json(
        { error: "Đã hỏi quá nhiều lần, vui lòng thử lại sau." },
        { status: 429 }
      );
    }

    const { question, lang } = await request.json();

    if (!question || typeof question !== "string" || question.length > 500) {
      return Response.json({ error: "Câu hỏi không hợp lệ." }, { status: 400 });
    }

    const languageInstruction =
      lang === "en"
        ? "Answer in English."
        : "Trả lời bằng tiếng Việt.";

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system" as any,
          content: `Bạn là trợ lý hỗ trợ của app "AL Nail AI". CHỈ được trả lời dựa trên
đúng thông tin trong phần KIẾN THỨC dưới đây - không được bịa thêm thông tin nào khác.
Nếu câu hỏi nằm ngoài phạm vi kiến thức này, hoặc bạn không chắc chắn, hãy trả lời:
"Mình chưa chắc về việc này, bạn liên hệ trực tiếp qua email lytrannam82@gmail.com để được hỗ trợ nhé."
Trả lời ngắn gọn, thân thiện, tối đa 4-5 câu. ${languageInstruction}

KIẾN THỨC:
${KNOWLEDGE_BASE}`,
        },
        {
          role: "user",
          content: [{ type: "input_text", text: question }],
        },
      ],
    });

    const answer = response.output_text || "";

    return Response.json({ answer });
  } catch (error) {
    console.error("support-chat error:", error);
    return Response.json(
      { error: "Không thể trả lời lúc này, thử lại sau nhé." },
      { status: 500 }
    );
  }
}