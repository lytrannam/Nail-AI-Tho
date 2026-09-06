import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { toEmail, customerName, oldDesignImage, newDesignImages } =
      await request.json();

    if (!toEmail) {
      return Response.json(
        { error: "Khách hàng chưa có email." },
        { status: 400 }
      );
    }

    const newDesignsHtml =
      newDesignImages && newDesignImages.length > 0
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
      to: toEmail,
      subject: "Mẫu nail mới dành cho bạn 💅",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>Xin chào ${customerName || "bạn"}! 💅</h2>
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