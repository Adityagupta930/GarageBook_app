-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

create table if not exists inventory (
  id         bigserial primary key,
  name       text not null,
  sku        text default '',
  category   text default '',
  stock      integer not null default 0,
  price      numeric not null default 0,
  buy_price  numeric not null default 0,
  company    text not null default '',
  created_at timestamptz default now()
);

create table if not exists customers (
  id         bigserial primary key,
  name       text not null,
  phone      text default '',
  address    text default '',
  notes      text default '',
  created_at timestamptz default now()
);

create table if not exists sales (
  id          bigserial primary key,
  item_id     bigint references inventory(id) on delete set null,
  item_name   text not null,
  qty         integer not null,
  amount      numeric not null,
  buy_price   numeric not null default 0,
  payment     text not null check(payment in ('cash','online','udhaar')),
  customer    text default 'Walk-in',
  phone       text default '',
  notes       text default '',
  date        timestamptz default now(),
  udhaar_paid boolean default false
);

create table if not exists returns (
  id        bigserial primary key,
  sale_id   bigint references sales(id) on delete set null,
  item_id   bigint references inventory(id) on delete set null,
  item_name text not null,
  qty       integer not null,
  amount    numeric not null,
  reason    text default '',
  date      timestamptz default now()
);

create table if not exists bills (
  id           bigserial primary key,
  bill_no      text not null unique,
  customer     text default 'Walk-in',
  phone        text default '',
  payment      text not null default 'cash',
  subtotal     numeric not null default 0,
  discount     numeric not null default 0,
  total        numeric not null default 0,
  partial_paid numeric not null default 0,
  balance      numeric not null default 0,
  operator     text default '',
  notes        text default '',
  date         timestamptz default now()
);

create table if not exists bill_items (
  id        bigserial primary key,
  bill_id   bigint not null references bills(id) on delete cascade,
  item_id   bigint references inventory(id) on delete set null,
  item_name text not null,
  qty       integer not null,
  price     numeric not null,
  buy_price numeric not null default 0,
  amount    numeric not null
);

create table if not exists expenses (
  id       bigserial primary key,
  title    text not null,
  amount   numeric not null,
  category text default 'Other',
  note     text default '',
  date     timestamptz default now()
);

create table if not exists suppliers (
  id         bigserial primary key,
  name       text not null,
  phone      text default '',
  address    text default '',
  company    text default '',
  note       text default '',
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_sales_date    on sales(date desc);
create index if not exists idx_sales_payment on sales(payment);
create index if not exists idx_inv_name      on inventory(name);
create index if not exists idx_inv_stock     on inventory(stock);
create index if not exists idx_bills_date    on bills(date desc);

-- Disable RLS (for internal app — enable if needed)
alter table inventory  disable row level security;
alter table customers  disable row level security;
alter table sales      disable row level security;
alter table returns    disable row level security;
alter table bills      disable row level security;
alter table bill_items disable row level security;
alter table expenses   disable row level security;
alter table suppliers  disable row level security;
