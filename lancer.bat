@echo off
title Aide Build PoE2
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js est introuvable : installez-le depuis https://nodejs.org puis relancez.
  start "" https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\.package-lock.json" (
  echo Installation des composants, une seule fois. Patientez...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

node scripts\lancer.mjs
if errorlevel 1 pause
