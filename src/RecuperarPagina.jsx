import React from 'react';
export default class RecuperarPagina extends React.Component{
 state={error:false};
 static getDerivedStateFromError(){return{error:true}}
 render(){return this.state.error?<main style={{maxWidth:560,margin:'48px auto',padding:24}}><h1>No se pudo mostrar esta sección</h1><p>Vuelve al inicio para continuar en Claudina App o recarga la página.</p><button onClick={()=>{window.location.hash='';window.location.assign(window.location.pathname)}}>Volver al inicio</button> <button onClick={()=>window.location.reload()}>Recargar página</button></main>:this.props.children}
}
