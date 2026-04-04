@echo off
echo ========================================
echo Iniciando servidor backend CashFlow...
echo ========================================
echo.
echo Ruta: C:\Apache24\htdocs\cashflow-project\cashflow-backend\public
echo.
cd public
php -S localhost:8000
pause