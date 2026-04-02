export interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  category: string;
  stock: number;
  price: number;
  buy_price: number;
  company: string;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Sale {
  id: number;
  item_id: number | null;
  item_name: string;
  qty: number;
  amount: number;
  buy_price: number;
  payment: 'cash' | 'online' | 'udhaar';
  customer: string;
  phone: string;
  date: string;
  udhaar_paid: 0 | 1;
  notes: string;
}

export interface Return {
  id: number;
  sale_id: number | null;
  item_id: number | null;
  item_name: string;
  qty: number;
  amount: number;
  reason: string;
  date: string;
}

export interface ReportSummary {
  totalSales: number | null;
  cashSales: number | null;
  onlineSales: number | null;
  creditSales: number | null;
  profit: number | null;
  totalItems: number | null;
  pendingCredit: number | null;
}

export interface DailyReport {
  day: string;
  total: number;
  earned: number;
  profit: number;
  count: number;
}

export interface TopPart {
  item_name: string;
  total_qty: number;
  total_amount: number;
}

export interface Bill {
  id: number;
  bill_no: string;
  customer: string;
  phone: string;
  payment: 'cash' | 'online' | 'udhaar';
  subtotal: number;
  discount: number;
  total: number;
  operator: string;
  notes: string;
  date: string;
}

export interface BillItem {
  id: number;
  bill_id: number;
  item_id: number | null;
  item_name: string;
  qty: number;
  price: number;
  buy_price: number;
  amount: number;
}

export interface BillWithItems extends Bill {
  items: BillItem[];
}

export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  note: string;
  date: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  address: string;
  company: string;
  note: string;
  created_at: string;
}
