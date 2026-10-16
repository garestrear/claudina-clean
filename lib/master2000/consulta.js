import {destinoMaster,permitirSolicitud} from './red.js';
import {leerPlanillasDOM,descripcionActividad,nombreComparable,respuestaPublica} from './planillas.js';
export class ErrorMaster extends Error{constructor(codigo,mensaje,status=502){super(mensaje);this.codigo=codigo;this.status=status}}
const fallo=(codigo,mensaje,status)=>new ErrorMaster(codigo,mensaje,status);
const entrada='https://login.master2000.net/ingreso/?A=205129000156';
let ejecutable;
export async function lanzarNavegador(){
 const[{default:chromium},{chromium:playwright}]=await Promise.all([import('@sparticuz/chromium'),import('playwright-core')]);
 return playwright.launch({args:chromium.args.filter(a=>!['--disable-web-security','--ignore-certificate-errors','--allow-running-insecure-content'].includes(a)),executablePath:await (ejecutable??=chromium.executablePath()),headless:true});
}
export async function consultarMaster({documento,password,nombre,periodo,materia},launch=lanzarNavegador){
 let browser,context,etapa='ARRANQUE';const limite=Date.now()+52000;const cierre=setTimeout(()=>{browser?.close().catch(()=>{})},54000);
 try{
  browser=await launch();context=await browser.newContext({acceptDownloads:false});
  // Each request gets an isolated, ephemeral browser context. Only Master receives credentials.
  await context.route('**/*',route=>permitirSolicitud(route.request())?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(18000);
  let aviso='';page.on('dialog',async d=>{aviso=d.message();await d.dismiss()});
  etapa='CONEXION';
  await page.goto(entrada,{waitUntil:'load'});
  etapa='SELECTOR';
  await page.locator('#asunto1').selectOption({label:'Estudiante'});
  etapa='CAMPOS';
  await page.locator('input[name="Usuario"]').waitFor({state:'visible'});
  await page.locator('input[name="Passwd"]').waitFor({state:'visible'});
  await page.locator('input[name="Usuario"]').fill(documento);
  await page.locator('input[name="Passwd"]').fill(password);
  etapa='ACCESO';
  await page.getByRole('button',{name:'Acceder',exact:true}).click();
  await page.waitForFunction(()=>location.pathname.includes('/academicoestudiante/')||document.querySelector('#Popup')?.innerText.trim(),{},{timeout:18000}).catch(()=>{});
  if(!page.url().includes('/academicoestudiante/')){
   const popup=await page.locator('#Popup').innerText({timeout:1000}).catch(()=>'');
   if(/captcha|robot|verifica.{0,20}human/i.test(popup))throw fallo('VERIFICACION','Master solicita una verificación humana. Abre Master 2000 para realizar la consulta directamente.',409);
   if(/términos|tratamiento de datos/i.test(popup))throw fallo('TERMINOS','Master solicita aceptar sus términos. Ingresa directamente en Master para revisarlos y aceptarlos.',409);
   if(/Registra tu correo personal/i.test(popup)){
    await page.getByText('Confirmar más tarde',{exact:true}).click();
    await page.waitForURL(/\/academicoestudiante\/panel\.php/,{timeout:15000});
   }else if(aviso||/contraseña|incorrect|no existe|inválid/i.test(popup))throw fallo('CREDENCIALES','Master no aceptó el acceso. Revisa tu contraseña de Master 2000.',401);
   else throw fallo('INGRESO','Master no completó el ingreso. Inténtalo más tarde o consulta directamente en Master.',502);
  }
  if(!destinoMaster(page.url()))throw fallo('DESTINO','No se pudo validar el servidor de Master.');
  etapa='IDENTIDAD';
  const identidad=await page.locator('#InfoEstudiante').innerText();
  const nombreMaster=identidad.match(/Estudiante:\s*([\s\S]*?)(?:Matr[ií]cula:|$)/i)?.[1]?.trim();
  if(!nombreMaster||nombreComparable(nombreMaster)!==nombreComparable(nombre))throw fallo('IDENTIDAD','El nombre de Master no coincide con tu ficha de Claudina. Solicita revisión al docente.',409);
  const origen=new URL(page.url()).origin;
  etapa='PERIODO';
  await page.goto(origen+'/academicoestudiante/seguimiento/index.php',{waitUntil:'domcontentloaded'});
  await page.locator('#txt_periodo_opciones').selectOption({label:String(periodo)});
  await page.getByRole('button',{name:'Aceptar',exact:true}).click();
  await page.waitForURL(/\/seguimiento\/seguimiento\.php/);
  etapa='NOTAS';
  await page.waitForFunction(()=>document.querySelectorAll('#planilla_numerica table').length>0||/ha establecido que el seguimiento/.test(document.body.innerText),{},{timeout:15000});
  await page.locator('#over_loader').waitFor({state:'hidden',timeout:12000});
  const texto=await page.locator('body').innerText();
  if(/ha establecido que el seguimiento/.test(texto))throw fallo('PERIODO_CERRADO','La institución no tiene habilitada la consulta de este período en Master.',409);
  etapa='LECTURA';
  const datos=await page.evaluate(leerPlanillasDOM);
  if(!datos.materias.length)throw fallo('FORMATO','Master cambió el formato de las notas. Solicita revisión al docente.');
  if(materia){
   etapa='ACTIVIDADES';
   const elegida=datos.materias.find(m=>m.codigo===materia);
   if(!elegida)throw fallo('MATERIA','La materia no pertenece a tu seguimiento.',400);
   datos.materias=[elegida];
   for(const a of elegida.actividades.filter(a=>a.nota!==null)){
    if(Date.now()>limite)throw fallo('TIEMPO','La consulta tardó demasiado. Vuelve a abrir las actividades de esta materia.',504);
    if(!a.celda)throw fallo('FORMATO','No se pudo identificar una actividad en Master.');
    await page.locator('[id="'+a.celda.replace(/["\\]/g,'')+'"]').click();
    const detalle=page.locator('[id="'+elegida.detalle+'"]');
    await page.waitForFunction(({id,ordinal,categoria})=>{const texto=document.getElementById(id)?.innerText.replace(/\s/g,'').toUpperCase()||'';return texto.includes('NOTA:'+ordinal+'ACTIVIDAD:')&&texto.includes(categoria.replace(/\s/g,'').toUpperCase())},{id:elegida.detalle,ordinal:String(Number(a.codigo.split('.')[1])),categoria:a.categoria.replace(/\d+(?:[.,]\d+)?\s*%/g,'').trim()},{timeout:6000});
    a.descripcion=descripcionActividad(await detalle.innerText());
   }
  }
  return respuestaPublica({...datos,periodo,ano:Number(texto.match(/MÚNERA\s*-\s*(\d{4})/i)?.[1])||new Date().getFullYear(),consultado_en:new Date().toISOString()});
 }catch(e){
  if(e instanceof ErrorMaster)throw e;
  const mensajes={ARRANQUE:'El servidor no pudo iniciar el servicio de consulta. Solicita revisión al docente.',CONEXION:'El servidor no pudo conectar con Master 2000. Inténtalo más tarde.',SELECTOR:'Master no pudo abrir el acceso de estudiante. Solicita revisión al docente.',CAMPOS:'Master no mostró los campos de documento y contraseña. Solicita revisión al docente.',ACCESO:'Master no completó el acceso automático. Puedes consultar directamente en Master.',IDENTIDAD:'No se pudo leer la identidad del panel de Master. Solicita revisión al docente.',PERIODO:'No fue posible abrir las opciones del período en Master.',NOTAS:'Master no terminó de cargar las notas del período. Inténtalo más tarde.',LECTURA:'No se pudo interpretar la planilla de notas de Master. Solicita revisión al docente.',ACTIVIDADES:'Master no terminó de cargar la descripción de una actividad. Inténtalo de nuevo.'};
  // Log only non-personal classifications. Never log exceptions, requests,
  // documents, names, passwords, URLs, cookies or returned grades.
  const tipo=['TimeoutError','TypeError','ReferenceError'].includes(e?.name)?e.name:'Error';
  console.warn('master2000_consulta',{etapa,tipo});
  throw fallo('MASTER_'+etapa,mensajes[etapa]||'No fue posible consultar Master 2000.');
 }finally{clearTimeout(cierre);await context?.close().catch(()=>{});await browser?.close().catch(()=>{})}
}
