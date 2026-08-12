// scripts/init-db.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Inicializando categorías predeterminadas...');
  
  const categorias = [
    { nombre: 'Comida', color: '#f59e0b' },
    { nombre: 'Transporte', color: '#ef4444' },
    { nombre: 'Entretenimiento', color: '#8b5cf6' },
    { nombre: 'Compras', color: '#ec4899' },
    { nombre: 'Servicios', color: '#06b6d4' },
    { nombre: 'Salud', color: '#10b981' },
    { nombre: 'Educación', color: '#3b82f6' },
    { nombre: 'Viajes', color: '#f97316' },
    { nombre: 'Otros', color: '#6b7280' },
  ];

  for (const cat of categorias) {
    await prisma.categoria.upsert({
      where: { nombre: cat.nombre },
      update: {},
      create: {
        ...cat,
        esDelSistema: true,
      },
    });
  }

  console.log('✅ Base de datos inicializada correctamente');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
