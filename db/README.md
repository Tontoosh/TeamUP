# TeamUp database laboratory files

SQL scripts and PDF materials copied from the local `db` folder. The application
source is in the repository root; its exported application schema remains in
`database/`.

Run SQL scripts section by section against the intended SQL Server database.
Backup, restore, audit, and high availability scripts require the paths,
permissions, and server configuration documented in the scripts. These files
have not been executed as part of this GitHub upload.

## SQL login passwords

The GitHub copy of `Lab04_05_TeamUp.sql` uses SQLCMD variables rather than the
passwords in the local source file:

- `TEAMUP_ADMIN_PASSWORD`
- `TEAMUP_READER_PASSWORD`
- `TEAMUP_WRITER_PASSWORD`

Enable **Query > SQLCMD Mode** in SSMS and define these variables locally before
running the login creation section, or supply them using `sqlcmd -v`. Keep their
values out of Git. The original Desktop SQL file was not changed.

Local editor state, environment files, database data, and backup files are excluded.
