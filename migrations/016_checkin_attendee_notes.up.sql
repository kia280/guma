ALTER TABLE checkin_attendees
    ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500);
