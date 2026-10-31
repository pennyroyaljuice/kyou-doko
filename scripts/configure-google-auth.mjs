import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const filename=process.argv[2];
if(!filename)throw Error('OAuthクライアント設定JSONのローカルパスを指定してください。');
const data=JSON.parse(readFileSync(filename,'utf8')).web;
const redirect='https://kyou-doko.pennyroyal-juice.workers.dev/admin/google/callback';
if(!data?.client_id?.endsWith('.apps.googleusercontent.com')||typeof data.client_secret!=='string'||!data.client_secret||!data.redirect_uris?.includes(redirect))throw Error('ウェブ用クライアントと正しいリダイレクトURIを確認してください。');
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk','--config','wrangler.jsonc'],{input:JSON.stringify({GOOGLE_OAUTH_CLIENT_ID:data.client_id,GOOGLE_OAUTH_CLIENT_SECRET:data.client_secret}),encoding:'utf8'});
if(result.status!==0){console.error('登録できませんでした。Cloudflareの認証・権限を確認してください。');process.exit(1);}
console.log('Google OAuthの秘密設定を登録しました。認証方式はまだ変更していません。');
