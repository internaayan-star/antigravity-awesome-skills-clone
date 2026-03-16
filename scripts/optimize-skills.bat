@echo off
setlocal EnableDelayedExpansion

:: --- CONFIGURATION ---
set "BASE_DIR=%USERPROFILE%\.gemini\antigravity"
set "SKILLS_DIR=%BASE_DIR%\skills"
set "LIBRARY_DIR=%BASE_DIR%\skills_library"
set "ARCHIVE_DIR=%BASE_DIR%\skills_archive"

echo Optimizing Antigravity skills...

:: --- LIBRARY INITIALIZATION ---
:: If no library exists, create one from current skills or archives.
if not exist "%LIBRARY_DIR%" (
    echo Initializing skills library...
    mkdir "%LIBRARY_DIR%" 2>nul
    
    :: 1. Migrate from current skills folder
    if exist "%SKILLS_DIR%" (
        echo   + Moving current skills to library...
        robocopy "%SKILLS_DIR%" "%LIBRARY_DIR%" /E /MOVE /NFL /NDL /NJH /NJS >nul 2>&1
    )
    
    :: 2. Merge from all archives
    for /f "delims=" %%i in ('dir /b /ad "%BASE_DIR%\skills_archive*" 2^>nul') do (
        echo   + Merging skills from %%i...
        robocopy "%BASE_DIR%\%%i" "%LIBRARY_DIR%" /E /NFL /NDL /NJH /NJS >nul 2>&1
    )
)

:: --- PREPARE ACTIVE FOLDER ---
echo Creating fresh skills folder...
if exist "%SKILLS_DIR%" (
    :: Archive the current (probably bloated) folder before wiping
    set "ts=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
    set "ts=!ts: =0!"
    robocopy "%SKILLS_DIR%" "%ARCHIVE_DIR%_!ts!" /E /MOVE /NFL /NDL /NJH /NJS >nul 2>&1
)
mkdir "%SKILLS_DIR%" 2>nul

:: --- BUNDLE EXPANSION ---
set "ESSENTIALS="
:: Important: Don't echo %* or !QUERIES! directly if they might contain &
echo Expanding bundles...

python --version >nul 2>&1
if not errorlevel 1 (
    :: Safely pass all arguments to Python
    python "%~dp0..\tools\scripts\get-bundle-skills.py" %* > "%TEMP%\skills_list.txt" 2>nul
    
    :: If no arguments, expand Essentials
    if "%~1"=="" python "%~dp0..\tools\scripts\get-bundle-skills.py" Essentials > "%TEMP%\skills_list.txt" 2>nul
    
    if exist "%TEMP%\skills_list.txt" (
        set /p ESSENTIALS=<"%TEMP%\skills_list.txt"
        del "%TEMP%\skills_list.txt"
    )
)

:: Fallback if Python fails or returned empty
if "!ESSENTIALS!"=="" (
    if "%~1"=="" (
        echo Using default essentials...
        set "ESSENTIALS=api-security-best-practices auth-implementation-patterns backend-security-coder frontend-security-coder cc-skill-security-review pci-compliance frontend-design react-best-practices react-patterns nextjs-best-practices tailwind-patterns form-cro seo-audit ui-ux-pro-max 3d-web-experience canvas-design mobile-design scroll-experience senior-fullstack frontend-developer backend-dev-guidelines api-patterns database-design stripe-integration agent-evaluation langgraph mcp-builder prompt-engineering ai-agents-architect rag-engineer llm-app-patterns rag-implementation prompt-caching context-window-management langfuse"
    ) else (
        :: Just use the literal arguments
        set "ESSENTIALS=%*"
    )
)

:: --- RESTORATION ---
echo Restoring selected skills...
for %%s in (!ESSENTIALS!) do (
    if exist "%LIBRARY_DIR%\%%s" (
        echo   + %%s
        robocopy "%LIBRARY_DIR%\%%s" "%SKILLS_DIR%\%%s" /E /NFL /NDL /NJH /NJS >nul 2>&1
    ) else (
        echo   - %%s (not found in library)
    )
)

echo.
echo Done! Antigravity is now optimized.
pause
