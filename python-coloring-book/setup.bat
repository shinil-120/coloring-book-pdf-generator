@echo off
REM ===================================================================
REM Windows setup script - just double-click this file (setup.bat)
REM It installs Python packages and prepares everything for you.
REM ===================================================================

echo.
echo ============================================================
echo   Coloring Book Generator - Windows Setup
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo.
    echo Please install Python 3.10 or newer from:
    echo   https://www.python.org/downloads/
    echo.
    echo IMPORTANT: During installation, check the box that says
    echo            "Add Python to PATH" at the bottom of the installer.
    echo.
    echo After installing Python, run this setup.bat file again.
    echo.
    pause
    exit /b 1
)

echo [OK] Python found:
python --version
echo.

REM Create virtual environment
echo [1/4] Creating virtual environment...
python -m venv .venv
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
)
echo [OK] Virtual environment created.
echo.

REM Activate it and install packages
echo [2/4] Activating virtual environment...
call .venv\Scripts\activate.bat
echo [OK] Activated.
echo.

echo [3/4] Installing packages (this takes 1-2 minutes)...
pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Package installation failed.
    echo Check your internet connection and try again.
    pause
    exit /b 1
)
echo [OK] Packages installed.
echo.

REM Create .env file from template
echo [4/4] Preparing .env file...
if not exist .env (
    copy .env.example .env >nul
    echo [OK] Created .env file from template.
) else (
    echo [OK] .env file already exists - keeping your current settings.
)
echo.

echo ============================================================
echo   SETUP COMPLETE!
echo ============================================================
echo.
echo NEXT STEPS:
echo.
echo 1. Open the .env file in Notepad (or any text editor)
echo 2. Replace "sk-proj-your-key-here" with your actual OpenAI API key
echo    Get your key from: https://platform.openai.com/api-keys
echo 3. Save the .env file
echo 4. Double-click run.bat to generate coloring books!
echo.
echo (See README.md for full instructions)
echo.
pause
