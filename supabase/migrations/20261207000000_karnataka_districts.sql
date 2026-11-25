BEGIN;

CREATE OR REPLACE FUNCTION public.seed_karnataka_districts(target_organization_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.districts (organization_id, name, code)
  SELECT target_organization_id, district.name, 'KA-' || district.code
  FROM (VALUES
    ('Bagalkote', 'BGK'),
    ('Ballari', 'BAL'),
    ('Belagavi', 'BEL'),
    ('Bengaluru Rural', 'BRU'),
    ('Bengaluru South', 'BSO'),
    ('Bengaluru Urban', 'BUR'),
    ('Bidar', 'BID'),
    ('Chamarajanagar', 'CHA'),
    ('Chikkaballapura', 'CHI'),
    ('Chikkamagaluru', 'CHM'),
    ('Chitradurga', 'CHT'),
    ('Dakshina Kannada', 'DKA'),
    ('Davanagere', 'DAV'),
    ('Dharwad', 'DHA'),
    ('Gadag', 'GAD'),
    ('Hassan', 'HAS'),
    ('Haveri', 'HAV'),
    ('Kalaburagi', 'KAL'),
    ('Kodagu', 'KOD'),
    ('Kolar', 'KOL'),
    ('Koppal', 'KOP'),
    ('Mandya', 'MAN'),
    ('Mysuru', 'MYS'),
    ('Raichur', 'RAI'),
    ('Shivamogga', 'SHI'),
    ('Tumakuru', 'TUM'),
    ('Udupi', 'UDP'),
    ('Uttara Kannada', 'UKA'),
    ('Vijayapura', 'VIJ'),
    ('Vijayanagara', 'VNA'),
    ('Yadgir', 'YAD')
  ) AS district(name, code)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.districts AS existing
    WHERE existing.organization_id = target_organization_id
      AND (
        existing.code = 'KA-' || district.code
        OR lower(btrim(existing.name)) = lower(district.name)
      )
  )
  ON CONFLICT (organization_id, code) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.seed_karnataka_districts_after_organization_insert()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.seed_karnataka_districts(NEW.id);
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.seed_karnataka_districts(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_karnataka_districts_after_organization_insert() FROM PUBLIC, anon, authenticated;

-- Normalize common legacy spellings while retaining district IDs and all existing relations.
UPDATE public.districts AS existing
SET name = alias.canonical_name,
    code = alias.canonical_code
FROM (VALUES
  ('Bagalkot', 'Bagalkote', 'KA-BGK'),
  ('Bellary', 'Ballari', 'KA-BAL'),
  ('Belgaum', 'Belagavi', 'KA-BEL'),
  ('Bangalore Rural', 'Bengaluru Rural', 'KA-BRU'),
  ('Ramanagara', 'Bengaluru South', 'KA-BSO'),
  ('Bangalore Urban', 'Bengaluru Urban', 'KA-BUR'),
  ('Chickballapur', 'Chikkaballapura', 'KA-CHI'),
  ('Chikmagalur', 'Chikkamagaluru', 'KA-CHM'),
  ('Davangere', 'Davanagere', 'KA-DAV'),
  ('Gulbarga', 'Kalaburagi', 'KA-KAL'),
  ('Mysore', 'Mysuru', 'KA-MYS'),
  ('Shimoga', 'Shivamogga', 'KA-SHI'),
  ('Tumkur', 'Tumakuru', 'KA-TUM'),
  ('Bijapur', 'Vijayapura', 'KA-VIJ'),
  ('Vijapura', 'Vijayapura', 'KA-VIJ')
) AS alias(legacy_name, canonical_name, canonical_code)
WHERE lower(btrim(existing.name)) = lower(alias.legacy_name)
  AND NOT EXISTS (
    SELECT 1 FROM public.districts AS canonical
    WHERE canonical.organization_id = existing.organization_id
      AND canonical.id <> existing.id
      AND lower(btrim(canonical.name)) = lower(alias.canonical_name)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.districts AS code_owner
    WHERE code_owner.organization_id = existing.organization_id
      AND code_owner.id <> existing.id
      AND code_owner.code = alias.canonical_code
  );

SELECT public.seed_karnataka_districts(organization.id)
FROM public.organizations AS organization;

DROP TRIGGER IF EXISTS organizations_seed_karnataka_districts ON public.organizations;
CREATE TRIGGER organizations_seed_karnataka_districts
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.seed_karnataka_districts_after_organization_insert();

COMMIT;
