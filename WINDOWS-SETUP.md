# TeamUP - Windows / TeamUpDB

## Current connection

- SQL Server: tontooshko
- Database: TeamUpDB
- Authentication: Windows (the Windows account running Node)
- TCP port: 1433
- Driver: ODBC Driver 18 for SQL Server + msnodesqlv8
- Demo seeding and login bypass: disabled

Connection settings are in .env. No SQL password is required.

## First required server step

TCP/IP was disabled for MSSQLSERVER when checked on this machine.
Open SQL Server Configuration Manager, expand SQL Server Network Configuration,
open Protocols for MSSQLSERVER, enable TCP/IP, then restart SQL Server (MSSQLSERVER).
TCP port 1433 is already configured under TCP/IP > IP Addresses > IPAll.

## Launch

Double-click start-teamup.cmd in this directory. Keep the console open.
The launcher builds the frontend, checks the database connection, then starts the API/site.
Open http://localhost:3001. Press Ctrl+C in the console to stop.

With Node/npm on PATH, you can also use:

    npm install
    npm run db:check
    npm run build
    npm start

For development, set APP_URL=http://localhost:5173 in .env, then run npm run dev.

## Existing database

The read-only connection check prints the connected database, Windows login,
and existing tables. Application startup creates missing application tables/indexes.
Existing tables must match server/db/schema.js. Demo data is not inserted.
Do not enable SEED_DEMO against the existing database without reviewing its contents.

## Verified

Frontend production build and all 25 automated SQLite workflow tests passed.
The Windows SQL native driver loads successfully.
A live TeamUpDB connection still requires TCP/IP to be enabled and SQL Server restarted.

## Test logins

Double-click create-test-users.cmd once under your normal Windows account.
It adds missing student@teamup.mn, owner@teamup.mn, admin@teamup.mn accounts
with password Teamup123! and verified email status. Existing users, passwords,
permissions, and project data remain unchanged. Existing accounts can use the
Forgot password flow; without SMTP the reset link appears in the server console.

## Original TeamUpDB schema mapping

The original dbo.[User], Profile, UserSkill, Skill, Project, ProjectRole,
RoleSkill, Application and Membership tables are now read through
teamup_api_* SQL views. The source remains the original normalized tables;
the plural tables retain passwords, sessions and UI fields absent in that schema.
No shared password is assigned to original database users.
Stable sql-user-* and sql-project-* identifiers preserve API relationships.
An existing app account with the same email retains its ID, password and role.

The original project schema has no category, start date, duration or weekly hours.
Those values stay empty/unknown until entered in the app. Work mode is exposed as
project type. recruiting maps to open; role requirements and active memberships
supply capacity, skills and members. Owner access is included separately when the
source membership table does not include the owner.

Run verify-db-api.cmd to compare all source project titles, owners, details,
member links and skill reference entries with the actual Express API.
It saves work/db-api-verification.json for review. Restart start-teamup.cmd
once the verification passes. GET /api/health now executes a database query
and reports sourceSchema=normalized when the mapping is active.

Mapped scalar edits (project title/description/work mode and profile name/bio/
portfolio) write back to the original tables. Fields missing from the original
schema remain app metadata. New app-only records remain in the plural tables;
this is not a wholesale migration of all app writes into the normalized schema.
