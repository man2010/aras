/*
# Seed ARAS testimonials and featured profiles

1. Data inserts
- 3 testimonials (success stories) for the homepage
- 8 featured member profiles for discovery (with Pexels placeholder photos)
- Guarded by NOT EXISTS checks for idempotency
*/

INSERT INTO public.aras_testimonials (author_name, author_photo, couple_photo, story, city, relationship_duration)
SELECT * FROM (VALUES
  ('Aminata & Moussa', 'https://images.pexels.com/photos/39093548/pexels-photo-39093548.jpeg?auto=compress&cs=tinysrgb&w=300', 'https://images.pexels.com/photos/30320673/pexels-photo-30320673.jpeg?auto=compress&cs=tinysrgb&w=800', 'On s''est rencontrés lors d''un dîner ARAS. Trois mois plus tard, on parlait déjà d''avenir. Aujourd''hui, on construit ensemble.', 'Dakar', '1 an et 4 mois'),
  ('Fatou & Ibrahima', 'https://images.pexels.com/photos/7016799/pexels-photo-7016799.jpeg?auto=compress&cs=tinysrgb&w=300', 'https://images.pexels.com/photos/12243433/pexels-photo-12243433.jpeg?auto=compress&cs=tinysrgb&w=800', 'Je n''imaginais pas trouver quelqu''un d''aussi aligné avec mes valeurs. ARAS a rendu ça possible, tout en douceur.', 'Thiès', '8 mois'),
  ('Khadija & Ousmane', 'https://images.pexels.com/photos/39134437/pexels-photo-39134437.jpeg?auto=compress&cs=tinysrgb&w=300', 'https://images.pexels.com/photos/4364785/pexels-photo-4364785.jpeg?auto=compress&cs=tinysrgb&w=800', 'Le premier message, le premier café, et tout le reste. Merci ARAS d''avoir créé un espace aussi sincère.', 'Saint-Louis', '11 mois')
) AS seed(author_name, author_photo, couple_photo, story, city, relationship_duration)
WHERE NOT EXISTS (SELECT 1 FROM public.aras_testimonials);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.aras_profiles) THEN
    INSERT INTO public.aras_profiles (display_name, age, city, bio, photo_url, interests, profession, is_verified, is_featured) VALUES
    ('Aminata', 29, 'Dakar', 'Gastronomie, voyages et longues conversations. Je cherche une relation sincère et durable.', 'https://images.pexels.com/photos/39093548/pexels-photo-39093548.jpeg?auto=compress&cs=tinysrgb&w=600', ARRAY['Voyage','Cuisine','Lecture','Musique'], 'Architecte', true, true),
    ('Moussa', 33, 'Dakar', 'Passionné de basket et de cinéma. J''aime les moments simples et vrais.', 'https://images.pexels.com/photos/6150694/pexels-photo-6150694.jpeg?auto=compress&cs=tinysrgb&w=600', ARRAY['Sport','Cinéma','Voyage'], 'Entrepreneur', true, true),
    ('Fatou', 27, 'Thiès', 'Créative qui aime l''art, la nature et les rires spontanés.', 'https://images.pexels.com/photos/7016799/pexels-photo-7016799.jpeg?auto=compress&cs=tinysrgb&w=600', ARRAY['Art','Nature','Photographie'], 'Designer', false, true),
    ('Ibrahima', 31, 'Dakar', 'Économe de mots, généreux d''actions. Je crois aux relations qui prennent le temps.', 'https://images.pexels.com/photos/7257963/pexels-photo-7257963.jpeg?auto=compress&cs=tinysrgb&w=600', ARRAY['Lecture','Finance','Voyage'], 'Consultant', false, true),
    ('Khadija', 30, 'Saint-Louis', 'Prof de lettres, amoureuse des mots et des rencontres qui font grandir.', 'https://images.pexels.com/photos/39134437/pexels-photo-39134437.jpeg?auto=compress&cs=tinysrgb&w=600', ARRAY['Lecture','Theatre','Voyage'], 'Enseignante', true, true),
    ('Ousmane', 34, 'Dakar', 'Ingénieur qui cuisine le dimanche. Je cherche ma personne, pas mon miroir.', 'https://images.pexels.com/photos/34138651/pexels-photo-34138651.jpeg?auto=compress&cs=tinysrgb&w=600', ARRAY['Cuisine','Tech','Sport'], 'Ingénieur', false, true),
    ('Awa', 26, 'Dakar', 'Musicienne le soir, marketeuse le jour. Je veux rire et construire.', 'https://images.pexels.com/photos/3225502/pexels-photo-3225502.jpeg?auto=compress&cs=tinysrgb&w=600', ARRAY['Musique','Marketing','Sorties'], 'Marketeuse', false, true),
    ('Cheikh', 35, 'Dakar', 'Photographe de mariage, je connais les belles histoires avant tout le monde.', 'https://images.pexels.com/photos/5447324/pexels-photo-5447324.jpeg?auto=compress&cs=tinysrgb&w=600', ARRAY['Photo','Voyage','Cinema'], 'Photographe', false, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
