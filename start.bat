@echo off
title BPS Chatbot Admin - Starting...

echo.
echo  ================================================
echo   BPS Chatbot Admin Dashboard
echo  ================================================
echo.

:: Jalankan Python API di background
echo  [1/2] Menjalankan PDF Processor API...
start "PDF Processor API" /min cmd /c "cd /d "%~dp0program1_pdf_processor" && python api.py"

:: Tunggu sebentar
timeout /t 3 /nobreak >nul

:: Jalankan frontend
echo  [2/2] Menjalankan Frontend Dashboard...
start "BPS Admin Frontend" /min cmd /c "cd /d "%~dp0frontend" && npm run dev"

:: Tunggu frontend ready
timeout /t 4 /nobreak >nul

:: Buka browser
echo.
echo  Membuka browser...
start http://localhost:5000

echo.
echo  ================================================
echo   Dashboard berjalan di: http://localhost:5000
echo   Tekan CTRL+C di window API/Frontend untuk stop
echo  ================================================
echo.
pause
