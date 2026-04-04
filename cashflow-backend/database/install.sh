#!/bin/bash
# ============================================
# SCRIPT DE INSTALACIÓN DE BASE DE DATOS
# ============================================

echo "🚀 Iniciando instalación de base de datos..."

# Configuración
DB_HOST="localhost"
DB_USER="root"
DB_PASS=""
DB_NAME="cashflow_db"

# Crear base de datos
echo "📁 Creando base de datos $DB_NAME..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Ejecutar esquema
echo "📊 Creando tablas..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < database/schema.sql

# Ejecutar datos iniciales
echo "📝 Insertando datos iniciales..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < database/seeds/initial_data.sql

# Ejecutar vistas
echo "👁️ Creando vistas..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < database/views/useful_views.sql

# Ejecutar procedimientos
echo "⚙️ Creando procedimientos almacenados..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < database/procedures/stored_procedures.sql

# Ejecutar triggers
echo "🔔 Creando triggers..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < database/triggers/triggers.sql

echo "✅ Instalación completada exitosamente!"
echo ""
echo "📋 Credenciales por defecto:"
echo "   Usuario admin: admin@cashflow.com / admin123"
echo "   Usuario demo: demo@cashflow.com / demo123"