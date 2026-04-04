# FlowControl - Sistema de Flujo de Caja Frontend

Sistema web para la gestión de ingresos, egresos y reportes financieros, construido completamente con tecnologías frontend (HTML, CSS, JavaScript, Bootstrap 5).

## Tecnologías Utilizadas
- **HTML5 / CSS3 / JavaScript (ES6)**
- **Bootstrap 5** (Layout y componentes)
- **Chart.js** (Gráficas dinámicas)
- **SheetJS (XLSX)** (Carga y exportación de Excel)
- **jsPDF** (Generación de reportes PDF)
- **LocalStorage** (Persistencia de datos)

## Estructura del Proyecto
La arquitectura sigue el principio de separación de responsabilidades:
- **/modules**: Lógica específica de cada vista.
- **/services**: Capa de datos y comunicación con LocalStorage.
- **/utils**: Helpers reutilizables (formato, exportaciones).
- **/components**: Fragmentos HTML (sidebar, navbar).

## Instrucciones de Uso
1. Clona o descarga el proyecto.
2. Sirve los archivos con un servidor local (ej. Live Server de VSCode).
3. Navega por las secciones usando el menú lateral.
4. Los datos de prueba se cargan automáticamente la primera vez.

## Características Implementadas
- **Dashboard** con indicadores clave y gráfica de tendencias.
- **CRUD de Cuentas** (ingresos/egresos por categorías).
- **Registro de Ingresos/Egresos** con validaciones.
- **Carga Masiva desde Excel** (SheetJS) con preview.
- **Exportación a Excel** de cualquier listado.
- **Generación de Reportes PDF** (jsPDF).
- **Filtros por fecha** en múltiples secciones.

## Dependencias (CDNs)
Las librerías se cargan desde CDN en el `index.html`:
- Bootstrap 5
- Chart.js
- SheetJS
- jsPDF

## Decisiones Técnicas
- **Modularidad**: Uso de ES6 Modules para mantener el código organizado y escalable.
- **Simulación de Backend**: `dataService` abstrae `localStorage`, permitiendo migrar fácilmente a una API real.
- **Event Delegation**: Se utiliza para manejar eventos en elementos dinámicos (listas, modales).
- **State Management**: El estado principal reside en `localStorage`, sincronizado a través del servicio central.

## Capturas (Placeholders)
![Dashboard](./assets/images/dashboard-mock.png)
*(Las imágenes son ilustrativas, el sistema cuenta con la funcionalidad descrita)*