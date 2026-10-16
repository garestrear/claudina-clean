export function destinoMaster(url){try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='login.master2000.net'||/^s\d+\.master2000\.net$/.test(u.hostname))}catch{return false}}
export function recursoVerificacion(url){try{const u=new URL(url);return u.protocol==='https:'&&['www.google.com','www.gstatic.com'].includes(u.hostname)&&u.pathname.startsWith('/recaptcha/')}catch{return false}}
export function permitirSolicitud(req){
 const u=new URL(req.url());
 // The login page loads this client before initializing its form controls.
 if(u.protocol==='https:'&&u.hostname==='accounts.google.com'&&u.pathname==='/gsi/client'&&req.resourceType()==='script')return true;
 if(u.protocol==='https:'&&['www.claudinamunera.edu.co','claudinamunera.edu.co'].includes(u.hostname))return ['document','script','stylesheet'].includes(req.resourceType())&&req.method()==='GET';
 if(destinoMaster(req.url()))return !['image','media','font'].includes(req.resourceType());
 // Load the verification service supplied by Master. No automatic solving,
 // injected verification tokens, fingerprint changes or alternate login routes.
 return recursoVerificacion(req.url())&&['script','stylesheet','document','xhr','fetch','image'].includes(req.resourceType());
}
