export function resumirNotasAseo(filas, limite) {
  const notas = filas.filter(fila => fila.notaEfectiva != null);
  const ordenadas = [...notas].sort((a, b) =>
    Number(b.notaEfectiva) - Number(a.notaEfectiva) ||
    String(a.id).localeCompare(String(b.id))
  );
  const elegidas = limite == null ? ordenadas : ordenadas.slice(0, limite);
  const promedio = elegidas.length
    ? elegidas.reduce((suma, fila) => suma + Number(fila.notaEfectiva), 0) / elegidas.length
    : null;
  return { total: notas.length, usadas: elegidas.length, promedio, elegidas: new Set(elegidas) };
}

export function formatoPromedioAseo(promedio) {
  return promedio == null ? '—' : promedio.toFixed(2);
}
