// scripts/migrar-materializacion.js
//
// Corre UNA SOLA VEZ, justo después de aplicar el nuevo schema (`npm run db:push`),
// y ANTES de que la app empiece a materializar domiciliados automáticamente.
//
// Qué hace: pone `ultimaOcurrenciaMaterializada = hoy` en todos los gastos
// domiciliados en efectivo y en todos los ahorros domiciliados existentes. Así,
// la primera vez que el dashboard corre `materializarDomiciliados()`, arranca
// desde HOY hacia adelante -- no reprocesa meses o años de historial de golpe,
// lo que inflaría de golpe tus gastos/ahorros ya "cerrados" y distorsionaría
// tu dinero disponible retroactivamente. No toca ningún otro dato.
//
// Uso: node scripts/migrar-materializacion.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const hoy = new Date();

  const gastos = await prisma.gastoDomiciliado.updateMany({
    where: { tarjetaId: null },
    data: { ultimaOcurrenciaMaterializada: hoy },
  });
  console.log(`✅ ${gastos.count} gasto(s) domiciliado(s) en efectivo listos para materializar desde hoy.`);

  const ahorros = await prisma.ahorroDomiciliado.updateMany({
    data: { ultimaOcurrenciaMaterializada: hoy },
  });
  console.log(`✅ ${ahorros.count} ahorro(s) domiciliado(s) listos para materializar desde hoy.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
