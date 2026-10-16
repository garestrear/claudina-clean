import assert from 'node:assert/strict';
import {destinoMaster,permitirSolicitud} from '../lib/master2000/red.js';
import {consultarMaster} from '../lib/master2000/consulta.js';
const req=(url,tipo='script')=>({url:()=>url,resourceType:()=>tipo,method:()=>'GET'});
assert(permitirSolicitud(req('https://login.master2000.net/ingreso/js/login/login-init.js')));
assert(permitirSolicitud(req('https://accounts.google.com/gsi/client')));
assert(!permitirSolicitud(req('https://accounts.google.com/gsi/client','document')));
assert(!permitirSolicitud(req('https://accounts.google.com/signin','document')));
assert(permitirSolicitud(req('https://s67.master2000.net/academicoestudiante/panel.php','document')));
assert(permitirSolicitud(req('https://www.google.com/recaptcha/api.js?hl=es&render=explicit')));
assert(permitirSolicitud(req('https://www.gstatic.com/recaptcha/releases/fixture/recaptcha__es.js')));
assert(permitirSolicitud(req('https://www.google.com/recaptcha/api2/anchor','document')));
for(const url of ['https://connect.facebook.net/sdk.js','https://evil.invalid/recaptcha/x','https://www.google.com/other','http://login.master2000.net/ingreso/','https://login.master2000.net.evil.invalid/ingreso/'])assert(!permitirSolicitud(req(url)));
assert(!destinoMaster('https://www.google.com/recaptcha/api.js'));
assert(!permitirSolicitud(req('https://s67.master2000.net/video.mp4','media')));
const warn=console.warn;const logs=[];console.warn=(...args)=>logs.push(args);
try{await assert.rejects(consultarMaster({documento:'1234567',password:'fixture-secret'},async()=>{throw new Error('Sensitive fixture-secret')}),e=>e.codigo==='MASTER_ARRANQUE'&&!e.message.includes('fixture-secret'))}finally{console.warn=warn}
assert(!JSON.stringify(logs).includes('fixture-secret'));assert.deepEqual(logs,[['master2000_consulta',{etapa:'ARRANQUE',tipo:'Error'}]]);
console.log('PASS Master: recursos oficiales de verificación permitidos, destinos ajenos bloqueados y diagnóstico por etapa sin secretos.');

assert(permitirSolicitud(req('https://www.claudinamunera.edu.co/','document')));assert(!permitirSolicitud({...req('https://www.claudinamunera.edu.co/','document'),method:()=>'POST'}));assert(!destinoMaster('https://www.claudinamunera.edu.co/'));
