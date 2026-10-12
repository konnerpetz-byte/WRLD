-- =====================================================================
-- 16 · Tags and compass lean on official attractions, so the Travel type
-- page can recommend sights that fit each traveler.
-- =====================================================================
alter table public.attractions
  add column tags   text[] not null default '{}',
  add column lean_x smallint not null default 0 check (lean_x between -2 and 2),  -- culture (−) ↔ nature (+)
  add column lean_y smallint not null default 0 check (lean_y between -2 and 2);  -- relaxing (−) ↔ active (+)

update public.attractions set tags = array['architecture','landmarks','history','viewpoints','hiking'], lean_x = 0,  lean_y = 1 where slug = 'pena-palace';
update public.attractions set tags = array['architecture','history','art','picnics'],                    lean_x = -1, lean_y = 0 where slug = 'quinta-da-regaleira';
update public.attractions set tags = array['landmarks','architecture','history','viewpoints','hiking'],  lean_x = 0,  lean_y = 1 where slug = 'neuschwanstein';
update public.attractions set tags = array['history','architecture','landmarks','art'],                  lean_x = -2, lean_y = 1 where slug = 'alhambra';
update public.attractions set tags = array['museums','art','landmarks'],                                 lean_x = -2, lean_y = 0 where slug = 'louvre';
update public.attractions set tags = array['landmarks','viewpoints','architecture'],                     lean_x = -2, lean_y = 1 where slug = 'eiffel-tower';
update public.attractions set tags = array['museums','history'],                                         lean_x = -2, lean_y = -1 where slug = 'anne-frank-house';
update public.attractions set tags = array['history','landmarks','walking_tours'],                       lean_x = -2, lean_y = 1 where slug = 'colosseum';
