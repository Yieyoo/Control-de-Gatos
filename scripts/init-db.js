// scripts/init-db.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Inicializando categorías predeterminadas...');
  
  // Colores tomados de la paleta categórica validada (accesible / daltonismo) del proyecto.
  const categorias = [
    { nombre: 'Comida', color: '#2a78d6' },
    { nombre: 'Transporte', color: '#eb6834' },
    { nombre: 'Entretenimiento', color: '#1baf7a' },
    { nombre: 'Compras', color: '#eda100' },
    { nombre: 'Servicios', color: '#e87ba4' },
    { nombre: 'Salud', color: '#008300' },
    { nombre: 'Educación', color: '#4a3aa7' },
    { nombre: 'Viajes', color: '#e34948' },
    { nombre: 'Otros', color: '#898781' },
  ];

  for (const cat of categorias) {
    await prisma.categoria.upsert({
      where: { nombre: cat.nombre },
      update: { color: cat.color },
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
