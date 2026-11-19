export function resumirNotasAseo(filas, limite) {
  const notas = filas.filter(fila => fila.notaEfectiva != null);
  const ordenadas = [...notas].sort((a, b) =>
    Number(b.notaEfectiva) - Number(a.notaEfectiva) ||
    String(a.id).localeCompare(String(b.id))
  );
  const elegidas = limite == null ? ordenadas : ordenadas.slice(0, limite);
  const cantidad = limite ?? elegidas.length;
  const faltantes = cantidad - elegidas.length;
  const promedio = cantidad
    ? elegidas.reduce((suma, fila) => suma + Number(fila.notaEfectiva), 0) / cantidad
    : null;
  return { total: notas.length, usadas: elegidas.length, faltantes, promedio, elegidas: new Set(elegidas) };
}

export function formatoPromedioAseo(promedio) {
  return promedio == null ? '—' : promedio.toFixed(2);
}
