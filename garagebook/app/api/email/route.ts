import { NextRequest } from 'next/server';
import { apiError, apiOk } from '@/lib/utils';

export interface BillEmailItem {
  item_name: string;
  qty: number;
  price: number;
}

export async function POST(req: NextRequest) {
  try {
    const { to, customerName, shopName, items, subtotal, discount, total, payment, date } = await req.json();

    if (!to || !to.includes('@')) return apiError('Valid email daalo');
    if (!items?.length)            return apiError('Bill mein koi item nahi');

    const rows = (items as BillEmailItem[]).map(i => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${i.item_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${i.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">₹${i.price.toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">₹${(i.qty * i.price).toFixed(2)}</td>
      </tr>`).join('');

    const discountRow = discount > 0 ? `
      <tr>
        <td colspan="3" style="padding:6px 12px;text-align:right;color:#64748b">Discount</td>
        <td style="padding:6px 12px;text-align:right;color:#e94560">-₹${discount.toFixed(2)}</td>
      </tr>` : '';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:#0d1117;padding:24px 28px;display:flex;align-items:center;gap:12px">
      <div style="background:#e94560;width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">🔧</div>
      <div>
        <div style="color:#fff;font-size:16px;font-weight:700">${shopName || 'GarageBook'}</div>
        <div style="color:#484f58;font-size:12px">Auto Parts Bill</div>
      </div>
    </div>

    <!-- Bill Info -->
    <div style="padding:20px 28px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em">Customer</div>
        <div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:2px">${customerName || 'Walk-in'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em">Date</div>
        <div style="font-size:14px;color:#0f172a;margin-top:2px">${date}</div>
      </div>
    </div>

    <!-- Items Table -->
    <div style="padding:0 28px">
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Part</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Rate</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          ${subtotal !== total ? `<tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#64748b;font-size:13px">Subtotal</td><td style="padding:6px 12px;text-align:right;font-size:13px">₹${subtotal.toFixed(2)}</td></tr>` : ''}
          ${discountRow}
          <tr style="background:#f8fafc">
            <td colspan="3" style="padding:12px;text-align:right;font-weight:700;font-size:15px">Total</td>
            <td style="padding:12px;text-align:right;font-weight:700;font-size:18px;color:#e94560">₹${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Payment Badge -->
    <div style="padding:0 28px 20px">
      <span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;
        background:${payment === 'cash' ? '#dcfce7' : payment === 'online' ? '#dbeafe' : '#ffedd5'};
        color:${payment === 'cash' ? '#15803d' : payment === 'online' ? '#1d4ed8' : '#c2410c'}">
        ${payment === 'cash' ? '💵 Cash' : payment === 'online' ? '📱 Online' : '📋 Credit (Udhaar)'}
      </span>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #f1f5f9">
      <p style="margin:0;font-size:12px;color:#94a3b8">Thank you for your business! 🙏</p>
      <p style="margin:4px 0 0;font-size:11px;color:#cbd5e1">Powered by GarageBook</p>
    </div>
  </div>
</body>
</html>`;

    if (!process.env.RESEND_API_KEY) return apiError('Email service configure nahi hai', 503);
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM || 'GarageBook <onboarding@resend.dev>',
      to,
      subject: `Bill from ${shopName || 'GarageBook'} — ₹${total.toFixed(2)}`,
      html,
    });

    if (error) return apiError(error.message, 500);
    return apiOk({ sent: true });
  } catch (e) {
    console.error('[POST /api/email]', e);
    return apiError('Email send nahi hua', 500);
  }
}
