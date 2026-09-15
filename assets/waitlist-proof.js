self.onmessage=async({data:token})=>{
 const encoder=new TextEncoder();
 for(let proof=0;proof<1000000;proof++){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token+':'+proof)));
  if(bytes[0]===0&&bytes[1]<4){self.postMessage(proof);return;}
 }
 self.postMessage(null);
};
