@echo off
echo ============================================
echo   SmartTech - Seed Supabase PostgreSQL
echo ============================================
echo.
echo This script seeds the Supabase PostgreSQL database.
echo IMPORTANT: Seeds use port 5432 (direct), not 6543 (pooler)
echo.

:: Extract connection details from .env.production but use port 5432
for /f "tokens=*" %%a in ('findstr /b "DATABASE_URL" .env.production 2^>nul') do set "RAW_URL=%%a"
if "%RAW_URL%"=="" (
    echo ERROR: .env.production not found or missing DATABASE_URL
    exit /b 1
)

:: Replace port 6543 with 5432
set "SEED_URL=%RAW_URL:DATABASE_URL==%"
set "SEED_URL=%SEED_URL:6543=5432%"
echo Using direct connection (port 5432)...

set "DATABASE_URL=%SEED_URL%"

echo.
echo Step 1: Seeding institution types, modules, features, roles, dashboards...
echo --------------------------------------------
call npx tsx prisma/seed.ts
if %errorlevel% neq 0 (
    echo ERROR: Seed failed.
    exit /b 1
)

echo.
echo Step 2: Seeding grading systems...
echo --------------------------------------------
call npx tsx prisma/seed-grading.ts

echo.
echo Step 3: Seeding ECZ Grade 7 rules...
echo --------------------------------------------
call npx tsx prisma/seed-g7-rules.ts

echo.
echo ============================================
echo   Seeding Complete!
echo ============================================
echo.
echo Run verification: node check-supabase.js
echo.
