-- Tablas base
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text check (role in ('admin','cashier','user')) default 'user',
  created_at timestamp with time zone default now()
);

create table if not exists wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0,
  updated_at timestamp with time zone default now()
);

create table if not exists transactions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null, -- positivo o negativo
  reason text,
  created_at timestamp with time zone default now()
);

create table if not exists winners (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  amount bigint not null,
  created_at timestamp with time zone default now()
);

-- RPC: mintear saldo
create or replace function mint_to_wallet(p_user_id uuid, p_amount bigint)
returns void language plpgsql security definer as $$
begin
  if p_amount <= 0 then
    raise exception 'amount debe ser > 0';
  end if;
  insert into wallets(user_id, balance) values (p_user_id, 0)
  on conflict (user_id) do nothing;
  update wallets set balance = balance + p_amount, updated_at = now() where user_id = p_user_id;
  insert into transactions(user_id, amount, reason) values (p_user_id, p_amount, 'mint');
end;
$$;

-- Políticas RLS
alter table profiles enable row level security;
alter table wallets enable row level security;
alter table transactions enable row level security;
alter table winners enable row level security;

create policy "own profile" on profiles for select using (auth.uid() = id);
create policy "own wallet" on wallets for select using (auth.uid() = user_id);
create policy "own txs" on transactions for select using (auth.uid() = user_id);
create policy "winners readable" on winners for select using (true);
