@echo off
REM Hotel PMS Electron tətbiqini başlatmaq üçün Windows batch faylı
REM Daha ətraflı məlumat üçün README-Electron.md faylına baxın.

echo RB Hotel PMS işə salınır...
echo ==============================

REM Node.js və NPM-in quraşdırıldığını yoxlayın
where node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo [XƏTA] Node.js tapılmadı. Öncə Node.js quraşdırın: https://nodejs.org/
    pause
    exit /b
)

where npm >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo [XƏTA] NPM tapılmadı. Öncə Node.js quraşdırın: https://nodejs.org/
    pause
    exit /b
)

REM Layihə qovluğunda olduğumuzu yoxlayırıq
IF NOT EXIST package.json (
    echo [XƏTA] package.json tapılmadı. Zəhmət olmasa bu faylı layihə qovluğundan işlədin.
    pause
    exit /b
)

REM NPM modullarını quraşdır (əgər mövcud deyilsə)
IF NOT EXIST node_modules (
    echo NPM modulları quraşdırılır...
    npm install
)

REM Electron ilə layihəni başlat
echo Electron tətbiqi başlayır...
npm start

pause

