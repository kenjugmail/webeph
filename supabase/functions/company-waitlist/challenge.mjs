const encoder=new TextEncoder();
export const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
export const hash=async text=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
const key=secret=>crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export async function issueChallenge(secret,submissionHash,now=Date.now()){
 if(!/^[a-f0-9]{64}$/.test(submissionHash))throw Error('Invalid submission digest');
 const body=btoa(JSON.stringify({id:crypto.randomUUID(),hash:submissionHash,expires:now+600000,difficulty:14}));
 return body+'.'+hex(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(body)));
}
export async function verifyChallenge(secret,token,proof,submission,now=Date.now()){
 try{
  if(typeof token!=='string'||token.length>1000||!Number.isSafeInteger(proof)||proof<0||proof>1e9)return null;
  const [body,signature,...extra]=token.split('.');if(extra.length||!/^[a-f0-9]{64}$/.test(signature))return null;
  const signatureBytes=Uint8Array.from(signature.match(/../g),x=>parseInt(x,16));
  if(!await crypto.subtle.verify('HMAC',await key(secret),signatureBytes,encoder.encode(body)))return null;
  const challenge=JSON.parse(atob(body));if(challenge.expires<now||challenge.expires>now+600000||challenge.difficulty!==14||challenge.hash!==await hash(JSON.stringify(submission)))return null;
  const work=await crypto.subtle.digest('SHA-256',encoder.encode(token+':'+proof));const bytes=new Uint8Array(work);
  return bytes[0]===0&&bytes[1]<4?challenge:null;
 }catch{return null;}
}
