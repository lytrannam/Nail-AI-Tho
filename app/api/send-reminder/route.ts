import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const { data } = await supabaseAdmin
    .from("api_rate_limits")
    .select("count, window_start")
    .eq("key", key)
    .maybeSingle();

  const now = Date.now();

  if (!data || now - new Date(data.window_start).getTime() > windowMs) {
    await supabaseAdmin.from("api_rate_limits").upsert({
      key,
      count: 1,
      window_start: new Date().toISOString(),
    });
    return true;
  }

  if (data.count >= maxRequests) {
    return false;
  }

  await supabaseAdmin
    .from("api_rate_limits")
    .update({ count: data.count + 1 })
    .eq("key", key);

  return true;
}

// Tranh chen ma HTML/link la vao trong ten khach khi hien thi trong email
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: Request) {
  try {
    // BUOC 1: Xac minh nguoi goi THUC SU da dang nhap (khong tin client)
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return Response.json(
        { error: "Bạn cần đăng nhập để dùng tính năng này." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return Response.json(
        { error: "Phiên đăng nhập không hợp lệ." },
        { status: 401 }
      );
    }

    // BUOC 2: Gioi han so email gui/nguoi dung/ngay, tranh spam hang loat
    const allowed = await checkRateLimit(`send-reminder:${user.id}`, 100, 1440);

    if (!allowed) {
      return Response.json(
        { error: "Đã đạt giới hạn gửi email hôm nay. Vui lòng thử lại vào ngày mai." },
        { status: 429 }
      );
    }

    // BUOC 3: Client CHI duoc gui customerId - moi thu khac server tu tra cuu
    const { customerId } = await request.json();

    if (!customerId) {
      return Response.json({ error: "Thiếu mã khách hàng." }, { status: 400 });
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("id, user_id, name, email, selected_design_image, all_design_images")
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      return Response.json({ error: "Không tìm thấy khách hàng." }, { status: 404 });
    }

    // BUOC 4: Xac nhan dung khach nay THUOC VE dung nguoi dang goi API
    if (customer.user_id !== user.id) {
      return Response.json(
        { error: "Bạn không có quyền gửi email cho khách này." },
        { status: 403 }
      );
    }

    if (!customer.email) {
      return Response.json(
        { error: "Khách hàng chưa có email." },
        { status: 400 }
      );
    }

    const customerName = customer.name ? escapeHtml(customer.name) : "bạn";
    const oldDesignImage = customer.selected_design_image;
    const newDesignImages = (customer.all_design_images || []).filter(
      (img: string) => img !== oldDesignImage
    );

    const newDesignsHtml =
      newDesignImages.length > 0
        ? `
        <h3>✨ Vài mẫu mới hợp với bạn</h3>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${newDesignImages
            .map(
              (img: string) =>
                `<img src="${img}" alt="Mẫu nail gợi ý" style="width: 150px; border-radius: 10px;" />`
            )
            .join("")}
        </div>
        `
        : "";

    const oldDesignHtml = oldDesignImage
      ? `
        <h3>Mẫu bạn đã làm lần trước</h3>
        <img src="${oldDesignImage}" alt="Mẫu nail cũ" style="width: 200px; border-radius: 10px;" />
      `
      : "";

    const { data, error } = await resend.emails.send({
      from: "AL Nail AI <onboarding@resend.dev>",
      to: customer.email,
      subject: "Mẫu nail mới dành cho bạn 💅",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>Xin chào ${customerName}! 💅</h2>
          <p>Đã lâu bạn chưa ghé tiệm — đây là mẫu cũ và vài gợi ý mới hợp với bạn!</p>
          ${oldDesignHtml}
          ${newDesignsHtml}
          <p style="margin-top: 20px;">Đặt lịch ngay để làm mới bộ móng nhé!</p>
        </div>
      `,
    });

    if (error) {
      console.error(error);
      return Response.json({ error: "Không thể gửi email." }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Có lỗi xảy ra." }, { status: 500 });
  }
}