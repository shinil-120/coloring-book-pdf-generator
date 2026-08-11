@echo off
REM ===================================================================
REM Windows run script - double-click this file to generate books.
REM It activates the virtual environment and shows a menu.
REM ===================================================================

REM Activate the virtual environment
call .venv\Scripts\activate.bat

:menu
cls
echo.
echo ============================================================
echo   Coloring Book Generator
echo ============================================================
echo.
echo   What would you like to do?
echo.
echo   1. List all available books (FREE - no cost)
echo   2. Test with 3 images (~$0.13 at medium quality)
echo   3. Generate a full 30-page book (~$1.26 at medium quality)
echo   4. Generate using LOW quality (cheapest - ~$0.33 per book)
echo   5. Generate using HIGH quality (best - ~$5.00 per book)
echo   6. Estimate cost without spending anything (DRY RUN)
echo   7. Rebuild PDF from existing images (FREE - no API calls)
echo   8. Exit
echo.
set /p choice="Enter your choice (1-8): "

if "%choice%"=="1" goto list_books
if "%choice%"=="2" goto test_3
if "%choice%"=="3" goto full_book
if "%choice%"=="4" goto low_quality
if "%choice%"=="5" goto high_quality
if "%choice%"=="6" goto dry_run
if "%choice%"=="7" goto no_generate
if "%choice%"=="8" goto end
echo Invalid choice.
pause
goto menu

:list_books
echo.
python main.py --list
echo.
pause
goto menu

:test_3
echo.
set /p bookslug="Enter book slug (e.g. Dinosaurs, Pets, Dragons): "
python main.py --book %bookslug% --limit 3
echo.
pause
goto menu

:full_book
echo.
set /p bookslug="Enter book slug (e.g. Dinosaurs, Pets, Dragons): "
python main.py --book %bookslug%
echo.
pause
goto menu

:low_quality
echo.
set /p bookslug="Enter book slug (e.g. Dinosaurs, Pets, Dragons): "
python main.py --book %bookslug% --quality low
echo.
pause
goto menu

:high_quality
echo.
set /p bookslug="Enter book slug (e.g. Dinosaurs, Pets, Dragons): "
python main.py --book %bookslug% --quality high
echo.
pause
goto menu

:dry_run
echo.
set /p bookslug="Enter book slug (e.g. Dinosaurs, Pets, Dragons): "
set /p itemlimit="How many images? (e.g. 5, 10, 30): "
python main.py --book %bookslug% --limit %itemlimit% --dry-run
echo.
pause
goto menu

:no_generate
echo.
set /p bookslug="Enter book slug (e.g. Dinosaurs): "
python main.py --book %bookslug% --no-generate
echo.
pause
goto menu

:end
exit /b 0
