CREATE TEMP TABLE email_named_users ON COMMIT DROP AS
SELECT id,
       lower(email)                                     AS email,
       lower(username)                                  AS old_username,
       CASE WHEN username LIKE '%@%'
            THEN 'user-' || left(replace(id::text, '-', ''), 8)
            ELSE username
       END                                              AS new_username,
       CASE WHEN display_name LIKE '%@%'
             AND lower(display_name) IN (lower(email), lower(username))
            THEN NULL
            ELSE NULLIF(display_name, '')
       END                                              AS new_display_name
FROM users
WHERE username LIKE '%@%'
   OR (display_name LIKE '%@%' AND lower(display_name) IN (lower(email), lower(username)));

CREATE TEMP TABLE email_name_replacements ON COMMIT DROP AS
SELECT DISTINCT e.id, leaked.value AS leaked_name, COALESCE(e.new_display_name, e.new_username) AS new_name
FROM email_named_users e
CROSS JOIN LATERAL (VALUES (e.email), (e.old_username)) AS leaked(value)
WHERE leaked.value LIKE '%@%';

UPDATE users u
SET username     = e.new_username,
    display_name = e.new_display_name,
    updated_at   = NOW()
FROM email_named_users e
WHERE u.id = e.id;

UPDATE members m
SET display_name = NULL
FROM email_name_replacements r
WHERE m.user_id = r.id AND lower(m.display_name) = r.leaked_name;

UPDATE checkin_attendees c
SET display_name = r.new_name
FROM email_name_replacements r
WHERE c.user_id = r.id AND lower(c.display_name) = r.leaked_name;

UPDATE bank_contributions b
SET username = r.new_name
FROM email_name_replacements r
WHERE b.user_id = r.id AND lower(b.username) = r.leaked_name;

UPDATE fund_requests f
SET requester_name = r.new_name
FROM email_name_replacements r
WHERE f.requester_id = r.id AND lower(f.requester_name) = r.leaked_name;

UPDATE item_requests i
SET requester_name = r.new_name
FROM email_name_replacements r
WHERE i.requester_id = r.id AND lower(i.requester_name) = r.leaked_name;

UPDATE bank_items b
SET donor_name = r.new_name
FROM email_name_replacements r
WHERE b.donor_id = r.id AND lower(b.donor_name) = r.leaked_name;

UPDATE activity a
SET actor_name = r.new_name
FROM email_name_replacements r
WHERE a.actor_id = r.id AND lower(a.actor_name) = r.leaked_name;

UPDATE notifications n
SET params = (
    SELECT jsonb_object_agg(
               p.key,
               COALESCE(
                   (SELECT to_jsonb(r.new_name)
                    FROM email_name_replacements r
                    WHERE jsonb_typeof(p.value) = 'string' AND lower(p.value #>> '{}') = r.leaked_name
                    LIMIT 1),
                   p.value))
    FROM jsonb_each(n.params) p)
WHERE EXISTS (
    SELECT 1
    FROM jsonb_each_text(n.params) p
    JOIN email_name_replacements r ON lower(p.value) = r.leaked_name
);

DO $$
DECLARE
    r       RECORD;
    pattern TEXT;
BEGIN
    FOR r IN SELECT leaked_name, new_name FROM email_name_replacements LOOP
        pattern := regexp_replace(r.leaked_name, '([.+*?^$(){}|\[\]\\])', '\\\1', 'g');
        UPDATE notifications
        SET title   = regexp_replace(title, pattern, r.new_name, 'gi'),
            message = regexp_replace(message, pattern, r.new_name, 'gi')
        WHERE title ILIKE '%' || r.leaked_name || '%'
           OR message ILIKE '%' || r.leaked_name || '%';
    END LOOP;
END $$;
