-- =====================================================================
-- 01 · Reference data: currencies and countries
--
-- Used to pick sensible default currencies:
--   * a new user's home currency comes from the country they sign up in
--   * a new trip's currency comes from the destination country
-- This seed covers common destinations; extend it any time (the
-- exchange-rate sync can also insert currencies it sees for the first time).
-- =====================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

create table public.currencies (
  code         text primary key check (code ~ '^[A-Z]{3}$'),   -- ISO 4217
  name         text not null,
  symbol       text,
  minor_units  smallint not null default 2 check (minor_units between 0 and 4)  -- JPY = 0
);

create table public.countries (
  code           text primary key check (code ~ '^[A-Z]{2}$'),  -- ISO 3166-1 alpha-2
  name           text not null,
  currency_code  text not null references public.currencies (code)
);
-- Reference rows are never deleted, so the FK above needs no index.

alter table public.currencies enable row level security;
alter table public.countries  enable row level security;
create policy "currencies: anyone reads" on public.currencies for select to anon, authenticated using (true);
create policy "countries: anyone reads"  on public.countries  for select to anon, authenticated using (true);
-- No write policies: only the service role (server jobs) can change these.

insert into public.currencies (code, name, symbol, minor_units) values
  ('USD', 'US Dollar', '$', 2),            ('EUR', 'Euro', '€', 2),
  ('GBP', 'British Pound', '£', 2),        ('JPY', 'Japanese Yen', '¥', 0),
  ('CAD', 'Canadian Dollar', 'CA$', 2),    ('MXN', 'Mexican Peso', 'MX$', 2),
  ('AUD', 'Australian Dollar', 'A$', 2),   ('NZD', 'New Zealand Dollar', 'NZ$', 2),
  ('CHF', 'Swiss Franc', 'CHF', 2),        ('SEK', 'Swedish Krona', 'kr', 2),
  ('NOK', 'Norwegian Krone', 'kr', 2),     ('DKK', 'Danish Krone', 'kr', 2),
  ('ISK', 'Icelandic Króna', 'kr', 0),     ('CZK', 'Czech Koruna', 'Kč', 2),
  ('PLN', 'Polish Złoty', 'zł', 2),        ('HUF', 'Hungarian Forint', 'Ft', 2),
  ('TRY', 'Turkish Lira', '₺', 2),         ('AED', 'UAE Dirham', 'AED', 2),
  ('ILS', 'Israeli New Shekel', '₪', 2),   ('EGP', 'Egyptian Pound', 'E£', 2),
  ('MAD', 'Moroccan Dirham', 'MAD', 2),    ('ZAR', 'South African Rand', 'R', 2),
  ('KES', 'Kenyan Shilling', 'KSh', 2),    ('INR', 'Indian Rupee', '₹', 2),
  ('THB', 'Thai Baht', '฿', 2),            ('VND', 'Vietnamese Dong', '₫', 0),
  ('IDR', 'Indonesian Rupiah', 'Rp', 2),   ('MYR', 'Malaysian Ringgit', 'RM', 2),
  ('SGD', 'Singapore Dollar', 'S$', 2),    ('PHP', 'Philippine Peso', '₱', 2),
  ('KRW', 'South Korean Won', '₩', 0),     ('CNY', 'Chinese Yuan', '¥', 2),
  ('HKD', 'Hong Kong Dollar', 'HK$', 2),   ('TWD', 'New Taiwan Dollar', 'NT$', 2),
  ('BRL', 'Brazilian Real', 'R$', 2),      ('ARS', 'Argentine Peso', 'AR$', 2),
  ('CLP', 'Chilean Peso', 'CL$', 0),       ('COP', 'Colombian Peso', 'COL$', 2),
  ('PEN', 'Peruvian Sol', 'S/', 2),        ('CRC', 'Costa Rican Colón', '₡', 2),
  ('DOP', 'Dominican Peso', 'RD$', 2);

insert into public.countries (code, name, currency_code) values
  ('US', 'United States', 'USD'),   ('PR', 'Puerto Rico', 'USD'),
  ('CA', 'Canada', 'CAD'),          ('MX', 'Mexico', 'MXN'),
  ('GB', 'United Kingdom', 'GBP'),  ('IE', 'Ireland', 'EUR'),
  ('FR', 'France', 'EUR'),          ('DE', 'Germany', 'EUR'),
  ('ES', 'Spain', 'EUR'),           ('PT', 'Portugal', 'EUR'),
  ('IT', 'Italy', 'EUR'),           ('NL', 'Netherlands', 'EUR'),
  ('BE', 'Belgium', 'EUR'),         ('AT', 'Austria', 'EUR'),
  ('GR', 'Greece', 'EUR'),          ('HR', 'Croatia', 'EUR'),
  ('FI', 'Finland', 'EUR'),         ('MT', 'Malta', 'EUR'),
  ('CH', 'Switzerland', 'CHF'),     ('SE', 'Sweden', 'SEK'),
  ('NO', 'Norway', 'NOK'),          ('DK', 'Denmark', 'DKK'),
  ('IS', 'Iceland', 'ISK'),         ('CZ', 'Czechia', 'CZK'),
  ('PL', 'Poland', 'PLN'),          ('HU', 'Hungary', 'HUF'),
  ('TR', 'Türkiye', 'TRY'),         ('AE', 'United Arab Emirates', 'AED'),
  ('IL', 'Israel', 'ILS'),          ('EG', 'Egypt', 'EGP'),
  ('MA', 'Morocco', 'MAD'),         ('ZA', 'South Africa', 'ZAR'),
  ('KE', 'Kenya', 'KES'),           ('IN', 'India', 'INR'),
  ('TH', 'Thailand', 'THB'),        ('VN', 'Vietnam', 'VND'),
  ('ID', 'Indonesia', 'IDR'),       ('MY', 'Malaysia', 'MYR'),
  ('SG', 'Singapore', 'SGD'),       ('PH', 'Philippines', 'PHP'),
  ('KR', 'South Korea', 'KRW'),     ('JP', 'Japan', 'JPY'),
  ('CN', 'China', 'CNY'),           ('HK', 'Hong Kong', 'HKD'),
  ('TW', 'Taiwan', 'TWD'),          ('AU', 'Australia', 'AUD'),
  ('NZ', 'New Zealand', 'NZD'),     ('BR', 'Brazil', 'BRL'),
  ('AR', 'Argentina', 'ARS'),       ('CL', 'Chile', 'CLP'),
  ('CO', 'Colombia', 'COP'),        ('PE', 'Peru', 'PEN'),
  ('CR', 'Costa Rica', 'CRC'),      ('DO', 'Dominican Republic', 'DOP');
