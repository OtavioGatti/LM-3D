insert into public.categories (slug, name, description, sort_order, is_active)
values
  ('decoracao', 'Decoracao', 'Pecas para deixar ambientes mais criativos.', 1, true),
  ('chaveiros', 'Chaveiros', 'Presentes simples, uteis e personalizaveis.', 2, true),
  ('geek', 'Geek', 'Itens tematicos para colecionar e presentear.', 3, true),
  ('escritorio', 'Escritorio', 'Organizadores e suportes para a rotina.', 4, true),
  ('presentes', 'Presentes', 'Ideias com nome, cor ou detalhe especial.', 5, true),
  ('pecas-funcionais', 'Pecas funcionais', 'Solucoes sob medida para pequenos problemas.', 6, true)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

with upserted_products as (
  insert into public.products (
    slug,
    name,
    short_description,
    description,
    price_cents,
    status,
    material,
    weight_grams,
    dimensions,
    production_time_days_min,
    production_time_days_max,
    stock_quantity,
    accepts_customization,
    customization_prompt
  )
  values
    (
      'dragao-articulado',
      'Dragao articulado',
      'Peca flexivel para presente, mesa ou colecao.',
      'Um dragao articulado impresso com acabamento limpo, movimento suave e possibilidade de escolher cores conforme disponibilidade.',
      8990,
      'active',
      'PLA',
      120,
      'Aprox. 28 cm de comprimento',
      2,
      4,
      5,
      true,
      'Informe cor preferida e qualquer detalhe de acabamento.'
    ),
    (
      'chaveiro-nome',
      'Chaveiro com nome',
      'Personalize nome, cor e pequeno simbolo.',
      'Chaveiro leve e resistente para lembrancas, eventos, presentes e identificacao de chaves ou mochilas.',
      2490,
      'made_to_order',
      'PLA',
      24,
      'Aprox. 7 cm',
      1,
      3,
      0,
      true,
      'Informe o nome, cor e simbolo desejado.'
    ),
    (
      'organizador-mesa',
      'Organizador de mesa',
      'Espaco para canetas, clips e itens pequenos.',
      'Organizador de mesa para escritorio, setup gamer ou area de estudos, com visual limpo e boa estabilidade.',
      6490,
      'active',
      'PLA reforcado',
      180,
      '16 x 9 x 8 cm',
      2,
      5,
      3,
      false,
      null
    ),
    (
      'suporte-controle',
      'Suporte para controle',
      'Base para controle, headset ou celular.',
      'Suporte funcional para organizar mesa, rack ou setup sem ocupar muito espaco.',
      5490,
      'active',
      'PLA',
      95,
      '11 x 9 x 10 cm',
      2,
      4,
      4,
      true,
      'Informe o modelo do controle ou medida aproximada.'
    )
  on conflict (slug) do update
  set
    name = excluded.name,
    short_description = excluded.short_description,
    description = excluded.description,
    price_cents = excluded.price_cents,
    status = excluded.status,
    material = excluded.material,
    weight_grams = excluded.weight_grams,
    dimensions = excluded.dimensions,
    production_time_days_min = excluded.production_time_days_min,
    production_time_days_max = excluded.production_time_days_max,
    stock_quantity = excluded.stock_quantity,
    accepts_customization = excluded.accepts_customization,
    customization_prompt = excluded.customization_prompt,
    updated_at = now()
  returning id, slug
),
all_products as (
  select id, slug from upserted_products
  union
  select id, slug from public.products
  where slug in ('dragao-articulado', 'chaveiro-nome', 'organizador-mesa', 'suporte-controle')
),
category_links as (
  select 'dragao-articulado' as product_slug, 'geek' as category_slug
  union all select 'chaveiro-nome', 'chaveiros'
  union all select 'organizador-mesa', 'escritorio'
  union all select 'suporte-controle', 'pecas-funcionais'
)
insert into public.product_categories (product_id, category_id)
select p.id, c.id
from category_links l
join all_products p on p.slug = l.product_slug
join public.categories c on c.slug = l.category_slug
on conflict (product_id, category_id) do nothing;

with image_rows as (
  select 'dragao-articulado' as product_slug, '/images/product-dragon.svg' as public_url, 'Dragao articulado impresso em 3D' as alt, 1 as sort_order, true as is_primary
  union all select 'dragao-articulado', '/images/product-detail.svg', 'Detalhe de acabamento de impressao 3D', 2, false
  union all select 'chaveiro-nome', '/images/product-keychain.svg', 'Chaveiro personalizado impresso em 3D', 1, true
  union all select 'organizador-mesa', '/images/product-desk.svg', 'Organizador de mesa impresso em 3D', 1, true
  union all select 'suporte-controle', '/images/product-stand.svg', 'Suporte para controle impresso em 3D', 1, true
)
insert into public.product_images (product_id, public_url, alt, sort_order, is_primary)
select p.id, i.public_url, i.alt, i.sort_order, i.is_primary
from image_rows i
join public.products p on p.slug = i.product_slug
where not exists (
  select 1
  from public.product_images existing
  where existing.product_id = p.id
    and existing.public_url = i.public_url
);

insert into public.site_content (key, type, title, content, is_published, published_at)
values
  (
    'home.hero',
    'hero',
    'Impressoes 3D sob medida e produtos criativos feitos com qualidade.',
    '{"cta_primary":"Ver catalogo","cta_secondary":"Pedir orcamento","body":"A LM-3D transforma ideias em pecas prontas para presentear, organizar, decorar ou resolver pequenas necessidades do dia a dia."}'::jsonb,
    true,
    now()
  )
on conflict (key) do update
set
  type = excluded.type,
  title = excluded.title,
  content = excluded.content,
  is_published = excluded.is_published,
  published_at = excluded.published_at,
  updated_at = now();
