# 🚀 GUÍA RÁPIDA DE INICIO

## Paso 1: Configurar la Base de Datos

Desde PowerShell, en la carpeta del proyecto:

```powershell
# Opción A: Ejecutar todo automáticamente
.\setup.bat

# Opción B: Ejecutar paso a paso
npm run db:push
node scripts/init-db.js
```

**¿Qué hace esto?**
- Crea el archivo SQLite en `prisma/dev.db`
- Crea todas las tablas de la base de datos
- Inicializa las 9 categorías predeterminadas

## Paso 2: Iniciar el Servidor

```powershell
npm run dev
```

Abre en tu navegador: **http://localhost:3000**

## Paso 3: Primeras Pruebas

### Test 1: Dashboard (debe estar vacío)
- Todos los valores en 0
- Botones de acceso rápido funcionales

### Test 2: Agregar Ingresos
1. Haz clic en **"Ingresos"**
2. Haz clic en **"+ Agregar Ingreso"**
3. Rellena:
   - Nombre: "Sueldo"
   - Cantidad: 20000
   - Frecuencia: "Mensual"
4. Haz clic en **"Guardar"**
5. ¡Verás el ingreso en la lista!

### Test 3: Agregar Gastos
1. Haz clic en **"Gastos"**
2. Haz clic en **"+ Agregar Gasto"**
3. Rellena:
   - Concepto: "Comida"
   - Cantidad: 500
   - Categoría: "Comida"
4. Haz clic en **"Guardar"**
5. ¡Verás el gasto en la lista!

### Test 4: Ver Dashboard Actualizado
1. Vuelve al **Dashboard** (Inicio)
2. Verás:
   - Ingresos: $20,000
   - Gastos Variables: $500
   - Dinero Disponible: $19,500

### Test 5: Agregar Ahorros
1. Haz clic en **"Ahorros"**
2. Haz clic en **"+ Agregar Lugar de Ahorro"**
3. Rellena:
   - Nombre: "Fondo Emergencias"
   - Tipo: "Cuenta de Ahorro"
   - Saldo Actual: 5000
4. Haz clic en **"Guardar"**
5. ¡Verás tu cuenta de ahorro!

## Funcionalidades Principales

### 📊 Dashboard
- Resumen de tu situación financiera
- Dinero disponible = Ingresos - Gastos - Ahorros
- Muestra próximos movimientos programados

### 📈 Ingresos
- Registra ingresos mensuales, quincenales o únicos
- El sistema calcula automáticamente los ingresos del mes

### 💸 Gastos Variables
- Registra gastos conforme ocurren
- Asigna categoría a cada gasto
- El total se descuenta del dinero disponible

### 🏦 Ahorros
- Crea múltiples cuentas de ahorro
- Visualiza el total de ahorros
- (Próximamente) Registra depósitos, retiros, transferencias

### 🏷️ Categorías
- Ve categorías predeterminadas
- Crea tus propias categorías personalizadas
- Asigna color e icono a cada una

## ⚙️ Scripts Útiles

```bash
npm run dev              # Iniciar servidor de desarrollo
npm run build            # Compilar para producción
npm run start            # Iniciar servidor de producción
npm run lint             # Verificar código
npm run db:push          # Sincronizar schema con BD
npm run db:generate      # Regenerar cliente Prisma
npm run db:studio        # Abrir Prisma Studio (inspector visual)
```

## 🔧 Solucionar Problemas

### La aplicación no carga
```bash
# Asegúrate de que esté en desarrollo
npm run dev

# Si hay error, instala dependencias
npm install

# Y sincroniza la base de datos
npm run db:push
```

### Errores de base de datos
```bash
# Regenera el cliente Prisma
npm run db:generate

# Abre Prisma Studio para inspeccionar datos
npm run db:studio
```

### Puerto 3000 ya está en uso
```bash
# Usa otro puerto
npm run dev -- -p 3001
```

## 📝 Notas Importantes

- **La base de datos es local** (SQLite en `prisma/dev.db`)
- **No hay autenticación** (es una app personal)
- **Todos los datos se guardan** en tu computadora
- **Los cálculos son en tiempo real**
- **Puedes eliminar datos** con el botón 🗑️

## 🎯 Próxima Etapa

Después de familiarizarte con lo básico, podrás:
1. Crear gastos fijos (Netflix, renta, etc)
2. Configurar movimientos programados
3. Ver gráficos de gastos
4. Crear reportes mensuales

---

**¿Necesitas ayuda?** Revisa el archivo `README.md` o `IMPLEMENTACION.md`

¡Que disfrutes organizando tus finanzas! 💰
