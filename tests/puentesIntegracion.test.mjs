import {crearEvaluacionDb} from './fixtures/evaluacionDb.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {db,actor,rpc}=await crearEvaluacionDb();
await db.exec(await readFile('supabase/feria-puentes.sql','utf8'));
await actor(1);await db.exec('set role authenticated');
let c=await rpc('feria_puentes_contexto');assert.equal(c.proyectos.length,6);
for(const origen of ['claudina','invitados']){const p=c.proyectos.find(p=>p.origen===origen);c=await rpc('feria_puentes_accion',['inscribir',{origen,proyecto_id:p.id,categoria:'puentes_infantil',masa_g:15,largo_cm:20,ancho_cm:5},c.mesa.version,crypto.randomUUID()],['text','jsonb','integer','uuid']);assert(c.puentes.some(x=>x.proyecto_id===p.id&&x.titulo===p.titulo))}
await db.close();console.log('PASS integración con proyectos aprobados internos y externos de Feria STEAM');
