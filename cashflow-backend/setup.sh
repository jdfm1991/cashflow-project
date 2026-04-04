#!/bin/bash

echo "🚀 Iniciando instalación del sistema CashFlow Backend..."

# Verificar PHP
if ! command -v php &> /dev/null; then
    echo "❌ PHP no está instalado. Por favor instala PHP 7.4 o superior."
    exit 1
fi

# Verificar Composer
if ! command -v composer &> /dev/null; then
    echo "❌ Composer no está instalado. Por favor instala Composer."
    exit 1
fi

# Crear estructura de carpetas
echo "📁 Creando estructura de carpetas..."
mkdir -p public app/{Config,Controllers,Models,Services,Middleware,Helpers,Exceptions}
mkdir -p database/{migrations,seeds}
mkdir -p storage/{logs,uploads,exports}
mkdir -p tests/{Controllers,Models,Services}

# Instalar dependencias
echo "📦 Instalando dependencias..."
composer install

# Crear archivo .env
if [ ! -f .env ]; then
    echo "🔧 Creando archivo .env..."
    cat > .env << EOL
APP_NAME="CashFlow System"
APP_ENV=development
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=cashflow_db
DB_USER=root
DB_PASS=
DB_CHARSET=utf8mb4

ALLOWED_ORIGIN=http://localhost:3000

JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRATION=3600

LOG_LEVEL=debug
LOG_PATH=storage/logs/app.log
EOL
fi

# Configurar permisos
echo "🔐 Configurando permisos..."
chmod -R 755 storage
chmod -R 755 public

echo "✅ Instalación completada!"
echo ""
echo "📝 Próximos pasos:"
echo "1. Configura tu base de datos en el archivo .env"
echo "2. Ejecuta las migraciones: php database/migrate.php"
echo "3. Inicia el servidor: cd public && php -S localhost:8000"