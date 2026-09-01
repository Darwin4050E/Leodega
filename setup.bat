@echo off
echo ========================================
echo Iniciando entorno de desarrollo Leodega
echo ========================================

REM --- Backend (Laravel) ---
cd backend
if not exist vendor (
    echo Instalando dependencias de Laravel...
    composer install
)
if not exist ".env" (
    echo Creando archivo .env...
    copy .env.example .env
    php artisan key:generate
)
echo  Migrando base de datos...
php artisan migrate
start php artisan serve

REM --- Frontend (React/Vite) ---
cd ../frontend
if not exist node_modules (
    echo Instalando dependencias de React...
    npm install
)
echo Levantando servidor de desarrollo...
start npm run dev

cd ..
echo Laravel en http://127.0.0.1:8000 y Vite en http://localhost:5173
pause

 