ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN selected_board_theme TEXT DEFAULT 'default';
ALTER TABLE users ADD COLUMN selected_pawn_theme TEXT DEFAULT 'default';