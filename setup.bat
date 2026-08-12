@echo off
REM Script para inicializar la aplicación

echo.
echo ====================================
echo Control de Gastos - Inicialización
echo ====================================
echo.

cd /d "%~dp0"

REM Instalar dependencias
echo [1/3] Instalando dependencias...
call npm install

REM Crear base de datos
echo [2/3] Configurando base de datos...
call npm run db:push

REM Inicializar categorías
echo [3/3] Inicializando categorías...
call node scripts/init-db.js

echo.
echo ====================================
echo ¡Inicialización completada!
echo ====================================
echo.
echo Para iniciar el servidor de desarrollo, ejecuta:
echo   npm run dev
echo.
pause
