import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.json':'application/json','.webmanifest':'application/manifest+json','.pdf':'application/pdf','.zip':'application/zip','.md':'text/plain; charset=utf-8'};

export async function previewServer(port=0){
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      let pathname=decodeURIComponent(url.pathname);
      const redirect=config.redirects.find(x=>x.source===pathname);
      if(redirect){res.writeHead(redirect.permanent?308:307,{location:redirect.destination});res.end();return;}
      const route=config.rewrites.find(x=>x.source===pathname&&!x.has&&!x.destination.startsWith('http'));
      pathname=(route?.destination||pathname).split('?')[0];
      if(!(/^\/[\w-]+\.html$/.test(pathname)||pathname.startsWith('/assets/')||pathname==='/site.webmanifest'))throw Error('not public');
      const filename=path.resolve(root,pathname.replace(/^\//,''));
      if(!filename.startsWith(root+path.sep)||pathname.split('/').some(x=>x.startsWith('.')))throw Error('not public');
      const info=await stat(filename);if(!info.isFile())throw Error('missing');
      res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream','content-length':info.size});
      if(req.method==='HEAD')res.end();else createReadStream(filename).pipe(res);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  return {server,url:`http://127.0.0.1:${server.address().port}`};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {url}=await previewServer(Number(process.env.TEL_PREVIEW_PORT||4178));
  console.log(`TEL preview: ${url}/journal/preprint/tomita-energy-logic-riemann`);
}
