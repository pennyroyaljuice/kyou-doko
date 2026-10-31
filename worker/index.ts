import handler from 'vinext/server/fetch-handler';
import { sanitizedHeaders, validateAccessToken, type AccessEnvironment } from '../lib/cloudflare-auth';
export default {
  async fetch(request:Request,env:Cloudflare.Env&AccessEnvironment,ctx:ExecutionContext) {
    const pathname=new URL(request.url).pathname;
    if(pathname==='/admin')return new Response(null,{status:302,headers:{Location:'/admin/','Cache-Control':'no-store'}});
    if(pathname==='/admin/logout')return new Response(null,{status:302,headers:{Location:'/cdn-cgi/access/logout','Cache-Control':'no-store'}});
    const headers=sanitizedHeaders(request);
    if(pathname==='/admin'||pathname.startsWith('/admin/')) {
      const identity=await validateAccessToken(request.headers.get('Cf-Access-Jwt-Assertion')??undefined,env);
      if(!identity)return new Response('管理者ページにはCloudflare Accessの本人認証が必要です。公開デモは / から利用できます。',{status:403,headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}});
      headers.set('oai-authenticated-user-id',identity.id);headers.set('oai-authenticated-user-email',identity.email);
    }
    const response=await handler.fetch(new Request(request,{headers}),env,ctx);
    if(!pathname.startsWith('/_next/')){const guarded=new Response(response.body,response);guarded.headers.set('Cache-Control','private, no-store');guarded.headers.append('Vary','Cookie');return guarded;}
    return response;
  }
};
