# 💵 Control de Gastos - Aplicación Personal

Una aplicación web moderna y sencilla para gestionar tus ingresos, gastos y ahorros personales.

## 🎯 Características

- 📊 **Dashboard** - Resumen visual de tu situación financiera
- 📈 **Ingresos** - Registra ingresos mensuales, quincenales o únicos
- 💸 **Gastos** - Controla gastos fijos y variables
- 🏦 **Ahorros** - Administra múltiples cuentas de ahorro
- ⏰ **Movimientos Programados** - Gastos y ahorros automáticos
- 📊 **Historial** - Consulta todas tus transacciones
- 🏷️ **Categorías** - Organiza gastos por categoría

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: SQLite + Prisma ORM
- **Backend**: Next.js API Routes

## 📥 Instalación

### Requisitos
- Node.js 20+ (se recomienda 22+)
- npm 10+

### Pasos

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Configurar base de datos**
   ```bash
   npm run db:push
   ```

3. **Inicializar datos (categorías predeterminadas)**
   ```bash
   node scripts/init-db.js
   ```

4. **Iniciar en desarrollo**
   ```bash
   npm run dev
   ```

5. Abre [http://localhost:3000](http://localhost:3000) en tu navegador

## 📚 Scripts Disponibles

```bash
npm run dev          # Inicia servidor de desarrollo
npm run build        # Construye para producción
npm run start        # Inicia servidor de producción
npm run lint         # Ejecuta linter
npm run db:push      # Sincroniza schema con BD
npm run db:generate  # Genera cliente Prisma
npm run db:studio    # Abre Prisma Studio para inspeccionar datos
```

## 📊 Estructura de Carpetas

```
src/
├── app/
│   ├── api/          # Rutas API
│   ├── layout.tsx    # Layout principal
│   └── page.tsx      # Página principal (Dashboard)
├── components/       # Componentes React reutilizables
├── lib/             # Utilidades (Prisma, etc)
├── types/           # Tipos TypeScript
└── utils/           # Funciones auxiliares

prisma/
├── schema.prisma    # Definición de BD
└── migrations/      # Histórico de migraciones
```

## 🗄️ Estructura de Base de Datos

### Modelos principales
- **Categoria** - Categorías de gastos
- **Ingreso** - Ingresos personales
- **AhorroLugar** - Cuentas de ahorro
- **MovimientoAhorro** - Depósitos, retiros, transferencias
- **GastoDomiciliado** - Gastos automáticos
- **AhorroDomiciliado** - Ahorros automáticos
- **GastoFijo** - Gastos fijos mensuales
- **GastoVariable** - Gastos registrados manualmente
- **Transaccion** - Historial unificado de movimientos

## 💡 Cálculos principales

### Dinero Disponible
```
Dinero Disponible = 
  Ingresos 
  - Gastos Domiciliados 
  - Gastos Fijos 
  - Gastos Variables 
  - Ahorros Programados
```

### Ahorros
- **Ahorros Domiciliados** NO son gastos
- Se descuentan del dinero disponible
- Se suman al saldo de la cuenta de ahorro

## 🚀 Próximas Funcionalidades

- [ ] Gráficos y visualizaciones
- [ ] Reportes mensuales
- [ ] Proyecciones futuras
- [ ] Autenticación de usuarios
- [ ] Sincronización con bancos
- [ ] Aplicación móvil

## 📝 Licencia

MIT

## 👨‍💻 Autor

Creado con ❤️ para gestionar tus finanzas personales

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
