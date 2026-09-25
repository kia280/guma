UPDATE guilds g SET icon_url = NULL
WHERE EXISTS (SELECT 1 FROM guild_logos l WHERE l.guild_id = g.id);
DROP TABLE IF EXISTS guild_logos;
