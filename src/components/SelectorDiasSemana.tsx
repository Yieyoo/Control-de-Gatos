// src/components/SelectorDiasSemana.tsx
'use client';

const OPCIONES_DIAS_SEMANA = [
  { valor: 1, etiqueta: 'Lun' },
  { valor: 2, etiqueta: 'Mar' },
  { valor: 3, etiqueta: 'Mié' },
  { valor: 4, etiqueta: 'Jue' },
  { valor: 5, etiqueta: 'Vie' },
  { valor: 6, etiqueta: 'Sáb' },
  { valor: 0, etiqueta: 'Dom' },
];

export function SelectorDiasSemana({
  seleccionados,
  onChange,
}: {
  seleccionados: number[];
  onChange: (dias: number[]) => void;
}) {
  const alternar = (dia: number) => {
    onChange(seleccionados.includes(dia) ? seleccionados.filter((d) => d !== dia) : [...seleccionados, dia]);
  };

  return (
    <div>
      <p className="text-sm text-gray-600 mb-1">¿Qué días de la semana?</p>
      <div className="flex flex-wrap gap-1.5">
        {OPCIONES_DIAS_SEMANA.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => alternar(opcion.valor)}
            className={`px-2.5 py-1.5 rounded text-sm font-medium border ${
              seleccionados.includes(opcion.valor)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300'
            }`}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}
