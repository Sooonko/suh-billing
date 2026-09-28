  -- =============================================================================
  --  СӨХ Төлбөр тооцоо & Тулгалтын систем — Supabase (PostgreSQL) schema
  --  Supabase Dashboard → SQL Editor дээр бүхэлд нь хуулж тавиад RUN дарна.
  -- =============================================================================

  create extension if not exists pgcrypto;

  -- -----------------------------------------------------------------------------
  -- 1. Enum төрлүүд
  -- -----------------------------------------------------------------------------
  do $$ begin
    create type bill_category as enum ('WATER_HEAT', 'SOH', 'ELECTRICITY');
  exception when duplicate_object then null; end $$;

  do $$ begin
    -- MATCHED  = бүрэн хуваарилсан
    -- PARTIAL  = хэсэгчлэн хуваарилсан (үлдэгдэлтэй)
    -- UNMATCHED= огт хуваарилаагүй → админы шалгах жагсаалтад
    -- IGNORED  = хамааралгүй гүйлгээ (шимтгэл, буцаалт г.м) гэж админ тэмдэглэсэн
    create type txn_status as enum ('MATCHED', 'PARTIAL', 'UNMATCHED', 'IGNORED');
  exception when duplicate_object then null; end $$;

  -- -----------------------------------------------------------------------------
  -- 2. flats — айлын бүртгэл
  --    Тоот нь байр даяар давхардахгүй тул flat_number нь unique.
  -- -----------------------------------------------------------------------------
  create table if not exists flats (
    id           uuid primary key default gen_random_uuid(),
    flat_number  integer not null unique,
    entrance     smallint,                 -- зөвхөн мэдээлэл болгон (тулгалтад хэрэглэхгүй)
    owner_name   text,
    phone        text,
    -- Excel дээр ЯМАР НЭРЭЭР бичигддэг вэ (жишээ: «amo sport», «дэлгүүр»).
    -- Арилжааны хэсгүүд нэхэмжлэлийн хүснэгтэд тоогоор биш нэрээрээ бичигддэг
    -- тул импортод тоот таних түлхүүр болно. owner_name нь оршин суугчид
    -- харагддаг нэр — хоёрыг хольж болохгүй.
    excel_label  text,
    is_active    boolean not null default true,
    created_at   timestamptz not null default now()
  );

  -- Аль хэдийн үүссэн датабазад нэмнэ
  alter table flats add column if not exists excel_label text;
  create index if not exists idx_flats_excel_label on flats (excel_label);

  -- -----------------------------------------------------------------------------
  -- 3. bank_accounts — 3 данс, категори тус бүрт нэг
  --    Хуулга оруулахдаа аль данснаас нь гэдгээ сонгоно → категори аяндаа тодорхой.
  -- -----------------------------------------------------------------------------
  create table if not exists bank_accounts (
    id             uuid primary key default gen_random_uuid(),
    account_number text not null unique,
    category       bill_category not null unique,   -- нэг категорид яг нэг данс
    display_name   text not null,
    created_at     timestamptz not null default now()
  );

  -- -----------------------------------------------------------------------------
  -- 4. invoices — сарын нэхэмжлэл
  --    bill_amount нь ЗӨВХӨН тухайн сарын тооцоо. Өмнөх үлдэгдлийг ЭНД НЭМЭХГҮЙ —
  --    нийт төлөх дүнг v_flat_balances view бодно (доороос харна уу).
  -- -----------------------------------------------------------------------------
  create table if not exists invoices (
    id              uuid primary key default gen_random_uuid(),
    flat_id         uuid not null references flats(id) on delete cascade,
    category        bill_category not null,
    billing_month   char(7) not null,               -- 'YYYY-MM'
    prev_reading    numeric(12,2),                  -- СӨХ-д NULL байж болно
    current_reading numeric(12,2),
    usage_amount    numeric(12,2),                  -- ус дулаанд халуун+хүйтний НИЙЛБЭР (м³)
    bill_amount     numeric(14,2) not null check (bill_amount >= 0),
    note            text,
    -- Ус дулаанд ХОЁР тоолуур: prev_reading/current_reading нь нэг тоолуурт
    -- зориулагдсан тул халуун, хүйтнийг тусад нь хадгална.
    hot_prev        numeric(12,2),
    hot_current     numeric(12,2),
    cold_prev       numeric(12,2),
    cold_current    numeric(12,2),
    -- Задаргаа: мөр бүр {code, label, unit, rate, qty, amount}.
    -- Тухайн үеийн тарифыг ХАДГАЛСАН тул тариф хожим өөрчлөгдсөн ч хуучин
    -- нэхэмжлэлийн тайлбар зөв хэвээр байна.
    breakdown       jsonb,
    created_at      timestamptz not null default now(),
    -- нэг айл / нэг категори / нэг сард яг нэг нэхэмжлэл
    unique (flat_id, category, billing_month),
    check (billing_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
  );

  create index if not exists idx_invoices_month on invoices (billing_month, category);
  create index if not exists idx_invoices_flat  on invoices (flat_id, category);

  -- Аль хэдийн үүссэн датабазад дээрх шинэ багануудыг нэмнэ.
  -- ⚠️ Эдгээр нь v_flat_category_state view-ээс ӨМНӨ байх ЁСТОЙ — view нь
  -- эдгээр баганыг хэрэглэдэг тул дараалал буурвал "column does not exist".
  alter table invoices add column if not exists hot_prev     numeric(12,2);
  alter table invoices add column if not exists hot_current  numeric(12,2);
  alter table invoices add column if not exists cold_prev    numeric(12,2);
  alter table invoices add column if not exists cold_current numeric(12,2);
  alter table invoices add column if not exists breakdown    jsonb;

  -- -----------------------------------------------------------------------------
  -- 5. transactions — банкны хуулгын ТҮҮХИЙ мөр
  --    Энэ хүснэгт бол баримт. Оруулсны дараа ХЭЗЭЭ Ч засварлахгүй.
  --    Зөвхөн ОРЛОГО-ын мөрийг оруулна (Зарлага мөрийг импорт огт авахгүй).
  -- -----------------------------------------------------------------------------
  create table if not exists transactions (
    id                   uuid primary key default gen_random_uuid(),
    bank_account_id      uuid not null references bank_accounts(id),
    source_category      bill_category not null,    -- данснаас автоматаар
    txn_date             timestamptz not null,
    amount               numeric(14,2) not null check (amount > 0),
    description          text not null,             -- Гүйлгээний утга (түүхийгээр)
    counterparty_account text,                      -- Харьцсан данс
    closing_balance      numeric(16,2),             -- Эцсийн үлдэгдэл

    -- Давхардлын хамгаалалт: нэг хуулгыг 100 удаа оруулсан ч давхардахгүй.
    -- hash = sha256(огноо | дүн | утга | эцсийн үлдэгдэл)
    dedupe_hash          text not null unique,

    status               txn_status not null default 'UNMATCHED',
    parsed_flat_number   integer,                   -- regex-ээр олсон тоот (лог болгон)
    match_confidence     text,                      -- 'HIGH' | 'MEDIUM' | 'NONE'
    review_reason        text,                      -- яагаад гар шалгалт руу орсон бэ
    import_batch_id      uuid,
    imported_at          timestamptz not null default now()
  );

  create index if not exists idx_txn_status on transactions (status, txn_date desc);
  create index if not exists idx_txn_batch  on transactions (import_batch_id);

  -- -----------------------------------------------------------------------------
  -- 6. allocations — мөнгө ХААШАА явсан бэ
  --    Нэг гүйлгээг олон айл / олон категори руу хувааж болно.
  --    Жишээ: ус дулааны данс руу 80,000₮ орж ирсэн ч 50,000 нь ус, 30,000 нь
  --           цахилгааных байсан → админ 2 мөр үүсгэнэ.
  --    Буруу оноосныг ЗАСАХ = энэ мөрийг устгах. Үлдэгдэл өөрөө залруулагдана.
  -- -----------------------------------------------------------------------------
  create table if not exists allocations (
    id             uuid primary key default gen_random_uuid(),
    transaction_id uuid not null references transactions(id) on delete cascade,
    flat_id        uuid not null references flats(id),
    category       bill_category not null,
    amount         numeric(14,2) not null check (amount > 0),
    is_auto        boolean not null default false,  -- систем автоматаар хийсэн үү
    created_by     uuid references auth.users(id),
    created_at     timestamptz not null default now()
  );

  create index if not exists idx_alloc_flat on allocations (flat_id, category);
  create index if not exists idx_alloc_txn  on allocations (transaction_id);

  -- -----------------------------------------------------------------------------
  -- 7. Хамгаалалт: хуваарилалтын нийлбэр гүйлгээний дүнгээс хэтэрч БОЛОХГҮЙ
  -- -----------------------------------------------------------------------------
  create or replace function guard_allocation_total() returns trigger as $$
  declare
    txn_amount numeric(14,2);
    already    numeric(14,2);
  begin
    select amount into txn_amount from transactions where id = new.transaction_id for update;

    select coalesce(sum(amount), 0) into already
    from allocations
    where transaction_id = new.transaction_id
      and id is distinct from new.id;

    if already + new.amount > txn_amount + 0.005 then
      raise exception
        'Хуваарилалт хэтэрлээ: гүйлгээ %₮, аль хэдийн %₮ хуваарилсан, нэмэх гэж буй %₮',
        txn_amount, already, new.amount
        using errcode = 'check_violation';
    end if;

    return new;
  end $$ language plpgsql;

  drop trigger if exists trg_guard_allocation_total on allocations;
  create trigger trg_guard_allocation_total
    before insert or update on allocations
    for each row execute function guard_allocation_total();

  -- -----------------------------------------------------------------------------
  -- 8. Гүйлгээний status-ыг хуваарилалтаас нь автоматаар шинэчлэх
  -- -----------------------------------------------------------------------------
  create or replace function sync_transaction_status() returns trigger as $$
  declare
    txn_id     uuid := coalesce(new.transaction_id, old.transaction_id);
    txn_amount numeric(14,2);
    allocated  numeric(14,2);
  begin
    select amount into txn_amount from transactions where id = txn_id;
    select coalesce(sum(amount), 0) into allocated from allocations where transaction_id = txn_id;

    -- ⚠️ ::txn_status хөрвүүлэлт ЗААВАЛ хэрэгтэй.
    -- case-ийн салбарууд бүгд текст литерал тул илэрхийлэл нь text төрөлтэй
    -- болж, enum баганад шууд онооход "column status is of type txn_status but
    -- expression is of type text" гэсэн алдаа өгдөг.
    update transactions set status =
      (case
        when status = 'IGNORED'                  then 'IGNORED'
        when allocated = 0                       then 'UNMATCHED'
        when allocated >= txn_amount - 0.005     then 'MATCHED'
        else 'PARTIAL'
      end)::txn_status
    where id = txn_id;

    return null;
  end $$ language plpgsql;

  drop trigger if exists trg_sync_txn_status on allocations;
  create trigger trg_sync_txn_status
    after insert or update or delete on allocations
    for each row execute function sync_transaction_status();

  -- =============================================================================
  --  VIEW-үүд — Үлдэгдлийг БАГАНА болгож хадгалахгүй, ҮРГЭЛЖ бодно.
  --  Ингэснээр үлдэгдэл "зөрөх" техникийн боломжгүй болно.
  --    үлдэгдэл = Σ(нэхэмжлэл) − Σ(хуваарилалт)
  --    эерэг = өртэй, сөрөг = илүү төлсөн
  -- =============================================================================
  create or replace view v_flat_balances as
  select
    f.id                                 as flat_id,
    f.flat_number,
    c.category,
    coalesce(i.billed, 0)                as total_billed,
    coalesce(p.paid,   0)                as total_paid,
    coalesce(i.billed, 0) - coalesce(p.paid, 0) as balance
  from flats f
  cross join (select unnest(enum_range(null::bill_category)) as category) c
  left join lateral (
    select sum(bill_amount) as billed from invoices i
    where i.flat_id = f.id and i.category = c.category
  ) i on true
  left join lateral (
    select sum(amount) as paid from allocations a
    where a.flat_id = f.id and a.category = c.category
  ) p on true;

  -- Оршин суугчийн дэлгэцэд хэрэгтэй бүх зүйл нэг мөрөнд.
  -- last_invoice_month параметргүй тул хамгийн сүүлийн нэхэмжлэлийг харуулна.
  --
  -- ⚠️ create or replace БИШ, drop + create хийж байгаа шалтгаан: PostgreSQL-ийн
  -- "create or replace view" нь баганыг ЗӨВХӨН СҮҮЛД нэмэхийг зөвшөөрдөг.
  -- Ус дулааны багануудыг дунд оруулсан тул хуучин view-тэй датабаз дээр
  -- "cannot change name of view column" гэж унана.
  drop view if exists v_flat_category_state;
  create view v_flat_category_state as
  select
    b.flat_id,
    b.flat_number,
    b.category,
    b.balance,
    -- Задаргаанд хэрэгтэй: нэхэмжилсэн ба төлсөн нийлбэр.
    -- Үүнгүйгээр дэлгэц «үлдэгдэл − энэ сарын нэхэмжлэл» гэж бодож,
    -- энэ сар төлсөн мөнгийг «өмнөх илүү төлөлт» гэж БУРУУ нэрлэдэг байв.
    b.total_billed,
    b.total_paid,
    li.billing_month,
    li.prev_reading,
    li.current_reading,
    li.usage_amount,
    li.bill_amount,
    -- Ус дулаанд хоёр тоолуур + тухайн үеийн тарифаар бодсон задаргаа
    li.hot_prev,
    li.hot_current,
    li.cold_prev,
    li.cold_current,
    li.breakdown,
    -- Төлөв: үлдэгдлээс шууд урган гарна.
    --
    -- ⚠️ 50 ТӨГРӨГИЙН ХҮЛЦЭЛ. Нэхэмжлэл 2 аравтын оронтой бодогддог атлаа
    -- банкаар мөнгө бүхэл төгрөгөөр хөдөлдөг тул айл бүтэн төлсөн ч
    -- хэдэн мөнгө үлддэг (115 тоот: үлдэгдэл 0.02₮). Яг тэгийг шаардвал
    -- дэлгэц дээр «0₮» гэж харуулаад «дутуу төлсөн» гэж бичдэг зөрчил
    -- үүснэ.
    --
    -- Хил нь 50₮: эргэлтэд байгаа хамгийн бага нэгж тэр тул түүнээс бага
    -- үлдэгдлийг оршин суугч ТӨЛӨХ БОЛОМЖГҮЙ. Кодын талд lib/money.ts
    -- дээрх SETTLED_EPSILON-той ИЖИЛ байх ёстой.
    case
      when abs(b.balance) < 50                        then 'PAID'       -- ТӨЛСӨН
      when b.balance < 0                              then 'OVERPAID'   -- ИЛҮҮ ТӨЛӨЛТТЭЙ
      when li.bill_amount is not null
          and b.balance < li.bill_amount             then 'PARTIAL'    -- ХЭСЭГЧЛЭН
      else 'UNPAID'                                                     -- ТӨЛӨӨГҮЙ
    end as status
  from v_flat_balances b
  left join lateral (
    select * from invoices i
    where i.flat_id = b.flat_id and i.category = b.category
    order by i.billing_month desc
    limit 1
  ) li on true;

  -- Гүйлгээ бүрийн хуваарилагдаагүй үлдэгдэл (админы дэлгэцэд)
  create or replace view v_transactions_remaining as
  select
    t.*,
    t.amount - coalesce(a.allocated, 0) as remaining
  from transactions t
  left join lateral (
    select sum(amount) as allocated from allocations a where a.transaction_id = t.id
  ) a on true;

  -- -----------------------------------------------------------------------------
  -- 9. announcements — СӨХ-ийн мэдээ, зарлал
  --    Оршин суугчийн эхний дэлгэц дээр харагдана. Админ Supabase Table Editor
  --    эсвэл хожим админы дэлгэцээс бичнэ.
  -- -----------------------------------------------------------------------------
  do $$ begin
    -- INFO        = ерөнхий мэдээлэл
    -- URGENT      = яаралтай (тасалдал, аваар)
    -- MAINTENANCE = хуваарьт ажил, засвар
    create type announcement_kind as enum ('INFO', 'URGENT', 'MAINTENANCE');
  exception when duplicate_object then null; end $$;

  create table if not exists announcements (
    id           uuid primary key default gen_random_uuid(),
    kind         announcement_kind not null default 'INFO',
    title        text not null,
    body         text not null,
    -- Дээр нь тогтмол харагдах эсэх (жишээ: "Дансны дугаар солигдлоо")
    is_pinned    boolean not null default false,
    published_at timestamptz not null default now(),
    -- Хугацаа дуусвал аяндаа нуугдана. NULL = хугацаагүй.
    expires_at   timestamptz,
    is_active    boolean not null default true,
    created_by   uuid references auth.users(id),
    created_at   timestamptz not null default now()
  );

  create index if not exists idx_ann_feed
    on announcements (is_active, is_pinned desc, published_at desc);

  -- -----------------------------------------------------------------------------
  -- 10. tariffs — тарифын ТҮҮХ
  --     Ус дулааны төлбөрийг систем өөрөө бодно. Тогтмол утгууд энд байна.
  --
  --     ⚠️ Тариф өөрчлөгдөхөд ХУУЧИН МӨРИЙГ ЗАСАХГҮЙ — effective_to тавьж
  --     хааж, шинэ мөр нэмнэ. Ингэснээр 9 сарын нэхэмжлэл 9 сарын тарифаараа
  --     хэвээр үлдэнэ (invoices.bill_amount нь хадгалагдсан тоо тул буцаж
  --     өөрчлөгдөхгүй, харин задаргааг нь тайлбарлах боломжтой хэвээр байна).
  -- -----------------------------------------------------------------------------
  -- unit нь enum БИШ, text + check.
  --
  -- ⚠️ Яагаад enum биш вэ: PostgreSQL-д «alter type … add value» хийсэн шинэ
  -- утгыг ТЭР ЛЭ ГҮЙЛГЭЭНД ашиглаж болдоггүй (алдаа 55P04). Supabase SQL
  -- Editor бүх скриптийг нэг гүйлгээгээр ажиллуулдаг тул шинэ ангилал нэмэх
  -- бүрт скрипт хоёр хуваагдах байсан. text + check нь тэр асуудлыг бүрмөсөн
  -- арилгана — шинэ нэгж нэмэхэд зөвхөн check-ийг өөрчилнө.
  --
  --   PER_M3   = м³ тутамд         (ус: нийт хэрэглээгээр үржүүлнэ)
  --   PER_KWH  = кВт·ц тутамд      (цахилгаан: эрчим хүчний тариф)
  --   CAPACITY = ₮/кВт             (цахилгаан: чадлын тариф)
  --   FIXED    = сарын тогтмол дүн  (хэрэглээнээс хамаарахгүй)
  --   NUMBER   = цэвэр тоо         (коэффициент, хоног, цаг — МӨНГӨ БИШ)
  --   PERCENT  = хувь              (өмнөх мөрүүдийн нийлбэрээс)
  create table if not exists tariffs (
    id             uuid primary key default gen_random_uuid(),
    category       bill_category not null,
    code           text not null,            -- CLEAN_WATER · ENERGY_RATE · VAT г.м
    label          text not null,            -- дэлгэц дээр харагдах нэр
    unit           text not null,
    rate           numeric(14,4) not null check (rate >= 0),
    sort_order     smallint not null default 0,
    /**
    * Аль ОРЦОД хамаарах вэ. NULL = бүх орцод.
    *
    * Орц бүр өөр журамтай байж болно — жишээ нь 1 орц ус халаалтын
    * төлбөр авдаггүй байсан. Тухайн орцод зориулсан мөр байвал ерөнхий
    * мөрийг ДАРНА.
    */
    entrance       smallint,
    effective_from date not null default current_date,
    effective_to   date,                     -- NULL = ОДОО хүчинтэй
    created_by     uuid references auth.users(id),
    created_at     timestamptz not null default now(),
    check (effective_to is null or effective_to >= effective_from)
  );

  -- Хуучин датабаз: unit нь enum байсан бол text болгоно
  do $$ begin
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tariffs'
        and column_name = 'unit' and udt_name = 'tariff_unit'
    ) then
      alter table tariffs alter column unit type text using unit::text;
    end if;
  end $$;

  -- Хэрэглэгдэхээ больсон enum-ийг цэвэрлэнэ
  drop type if exists tariff_unit;

  -- Зөвшөөрөгдөх утгууд. Шинэ нэгж нэмэхэд ЗӨВХӨН энэ жагсаалтыг өөрчилнө.
  alter table tariffs drop constraint if exists tariffs_unit_check;
  alter table tariffs add constraint tariffs_unit_check
    check (unit in ('PER_M3', 'PER_KWH', 'CAPACITY', 'FIXED', 'NUMBER', 'PERCENT'));

  -- Хуучин датабазад entrance багана нэмнэ
  alter table tariffs add column if not exists entrance smallint;

  -- Нэг код + нэг орц дээр ОДОО хүчинтэй мөр яг нэг л байна.
  --
  -- ⚠️ ХОЁР индекс болгосон шалтгаан: NULL-ыг нэг утга мэт барихын тулд
  -- coalesce(entrance, -1) гэсэн ИЛЭРХИЙЛЭЛТЭЙ индекс хэрэглэж болох ч
  -- «on conflict» тийм индексийг таних нь эмзэг (алдаа 42P10). Энгийн
  -- баганатай хоёр хэсэгчилсэн индекс нь эргэлзээгүй ажиллана.
  drop index if exists idx_tariff_current;
  create unique index if not exists idx_tariff_current_general
    on tariffs (category, code) where effective_to is null and entrance is null;
  create unique index if not exists idx_tariff_current_entrance
    on tariffs (category, code, entrance) where effective_to is null and entrance is not null;
  create index if not exists idx_tariff_lookup on tariffs (category, code, effective_from desc);

  -- =============================================================================
  --  RLS — Row Level Security
  --  Бүх хүснэгт хаалттай. Зөвхөн нэвтэрсэн админ хандана.
  --  Оршин суугчийн дэлгэц Supabase-руу ШУУД хандахгүй — Next.js API route-оор
  --  service_role key-ээр дамжина (лог 3-р хэсэг, README-г үзнэ үү).
  -- =============================================================================
  alter table flats         enable row level security;
  alter table bank_accounts enable row level security;
  alter table invoices      enable row level security;
  alter table transactions  enable row level security;
  alter table allocations   enable row level security;
  alter table announcements enable row level security;
  alter table tariffs       enable row level security;

  do $$
  declare t text;
  begin
    foreach t in array array['flats','bank_accounts','invoices','transactions','allocations','announcements','tariffs'] loop
      execute format('drop policy if exists admin_all on %I', t);
      execute format(
        'create policy admin_all on %I for all to authenticated using (true) with check (true)', t
      );
    end loop;
  end $$;

  -- =============================================================================
  --  Эхлэлийн дата — 3 данс
  --  ⚠️ Дансны дугаарыг өөрсдийн жинхэнэ дугаараар солино уу.
  -- =============================================================================
  insert into bank_accounts (account_number, category, display_name) values
    ('0000000001', 'WATER_HEAT',  'Ус, дулаан'),
    ('0000000002', 'SOH',         'СӨХ'),
    ('0000000003', 'ELECTRICITY', 'Цахилгаан')
  on conflict (category) do nothing;

  -- =============================================================================
  --  Эхлэлийн тариф — Ус, дулаан
  --  Жинхэнэ утгууд. Өөрчлөх бол /admin/tariffs цэсээс — гараар ЗАСАХГҮЙ,
  --  шинэ мөр үүсгэж хуучныг хаана (түүх хадгалагдана).
  -- =============================================================================
  insert into tariffs (category, code, label, unit, rate, sort_order, effective_from) values
    ('WATER_HEAT', 'CLEAN_WATER', 'Цэвэр ус тариф',      'PER_M3',  3500, 1, '2026-01-01'),
    ('WATER_HEAT', 'WASTE_WATER', 'Бохир ус тариф',      'PER_M3',  3200, 2, '2026-01-01'),
    ('WATER_HEAT', 'BASE_FEE',    'Усны суурь хураамж',  'FIXED',   3000, 3, '2026-01-01'),
    ('WATER_HEAT', 'HEATING',     'Ус халаалсны төлбөр', 'FIXED',   2637, 4, '2026-01-01'),
    ('WATER_HEAT', 'VAT',         'НӨАТ',                'PERCENT',   10, 5, '2026-01-01')
  on conflict (category, code) where effective_to is null and entrance is null do nothing;

  -- =============================================================================
  --  Эхлэлийн тариф — Цахилгаан
  --
  --  Томьёо (СӨХ-ийн Excel-тэй тулгаж баталгаажуулсан, 207/207 мөр таарсан):
  --    квт·ц         = (заалтын зөрүү) × LOSS_COEF
  --    эрчим хүч     = квт·ц × ENERGY_RATE
  --    чадлын төлбөр = квт·ц ÷ DAYS ÷ HOURS × CAPACITY_RATE
  --    нийт          = (эрчим хүч + чадлын төлбөр) × (1 + VAT)
  --
  --  DAYS, HOURS нь МӨНГӨ БИШ — чадлын томьёоны хуваарь.
  -- =============================================================================
  insert into tariffs (category, code, label, unit, rate, sort_order, effective_from) values
    ('ELECTRICITY', 'LOSS_COEF',     'Алдагдлын коэффициент', 'NUMBER',    1.025, 1, '2026-01-01'),
    ('ELECTRICITY', 'ENERGY_RATE',   'Эрчим хүчний тариф',    'PER_KWH',     265, 2, '2026-01-01'),
    ('ELECTRICITY', 'DAYS',          'Хоног',                 'NUMBER',       31, 3, '2026-01-01'),
    ('ELECTRICITY', 'HOURS',         'Цаг',                   'NUMBER',       12, 4, '2026-01-01'),
    ('ELECTRICITY', 'CAPACITY_RATE', 'Чадлын тариф',          'CAPACITY',  15500, 5, '2026-01-01'),
    ('ELECTRICITY', 'VAT',           'НӨАТ',                  'PERCENT',      10, 6, '2026-01-01')
  on conflict (category, code) where effective_to is null and entrance is null do nothing;

  -- =============================================================================
  --  Эхлэлийн тариф — СӨХ
  --  Тоолуургүй, бүх айлд ижил сарын хураамж. НӨАТ нэмэхгүй.
  --  Нэхэмжлэлийг Excel-ээс биш, /admin/invoices дээрх «СӨХ төлбөр үүсгэх»
  --  товчоор бүх айлд нэг дор үүсгэнэ.
  -- =============================================================================
  insert into tariffs (category, code, label, unit, rate, sort_order, effective_from) values
    ('SOH', 'MONTHLY_FEE', 'СӨХ-ийн сарын хураамж', 'FIXED', 35000, 1, '2026-01-01')
  on conflict (category, code) where effective_to is null and entrance is null do nothing;

  -- =============================================================================
  --  Орц тусгайлсан тариф — 1 орц 9 сар хүртэл ус халаалтын төлбөр аваагүй
  --
  --  Ерөнхий HEATING (2,637₮) нь бүх орцод хамаарна. Доорх мөр нь 1 орцод
  --  9 сарын эцэс хүртэл 0₮ гэж ДАРНА. 10 сараас эхлэн хугацаа нь дуусч,
  --  ерөнхий тариф автоматаар үйлчилнэ.
  -- =============================================================================
  insert into tariffs (category, code, label, unit, rate, sort_order, entrance, effective_from, effective_to)
  select 'WATER_HEAT', 'HEATING', 'Ус халаалсны төлбөр (1 орц)', 'FIXED', 0, 4, 1, '2026-01-01', '2026-09-30'
  where not exists (
    select 1 from tariffs
    where category = 'WATER_HEAT' and code = 'HEATING' and entrance = 1
  );
