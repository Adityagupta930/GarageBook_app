import { NextRequest } from 'next/server';
import { apiError, apiOk } from '@/lib/utils';

export interface BillEmailItem { item_name: string; qty: number; price: number; }

export async function POST(req: NextRequest) {
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) return apiError('Email service configure nahi hai', 503);

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

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:#0d1117;padding:24px 28px">
      <div style="color:#fff;font-size:16px;font-weight:700">🔧 ${shopName || 'GarageBook'}</div>
      <div style="color:#484f58;font-size:12px">Auto Parts Bill</div>
    </div>
    <div style="padding:20px 28px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between">
      <div><div style="font-size:11px;color:#94a3b8">CUSTOMER</div><div style="font-weight:600">${customerName || 'Walk-in'}</div></div>
      <div style="text-align:right"><div style="font-size:11px;color:#94a3b8">DATE</div><div>${date}</div></div>
    </div>
    <div style="padding:0 28px">
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b">PART</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b">QTY</th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b">RATE</th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b">TOTAL</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          ${discount > 0 ? `<tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#64748b">Subtotal</td><td style="padding:6px 12px;text-align:right">₹${subtotal.toFixed(2)}</td></tr><tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#e94560">Discount</td><td style="padding:6px 12px;text-align:right;color:#e94560">-₹${discount.toFixed(2)}</td></tr>` : ''}
          <tr style="background:#f8fafc"><td colspan="3" style="padding:12px;text-align:right;font-weight:700;font-size:15px">Total</td><td style="padding:12px;text-align:right;font-weight:700;font-size:18px;color:#e94560">₹${total.toFixed(2)}</td></tr>
        </tfoot>
      </table>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #f1f5f9">
      <p style="margin:0;font-size:12px;color:#94a3b8">Thank you for your business! 🙏</p>
    </div>
  </div>
</body></html>`;

    // Dynamic import to avoid build-time initialization
    const ResendModule = await import('resend');
    const resend = new ResendModule.Resend(key);

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
