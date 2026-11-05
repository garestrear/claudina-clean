export const franjasFeria=[
 {id:'primera',nombre:'Primera franja · 8:00–10:00 a. m.',inicio:'08:00',fin:'10:00'},
 {id:'segunda',nombre:'Segunda franja · 10:15–11:40 a. m.',inicio:'10:15',fin:'11:40'}
];
export const coincideFranja=(r,f)=>!f||(String(r.inicio).slice(0,5)<f.fin&&String(r.fin).slice(0,5)>f.inicio);
