import { NextResponse } from 'next/server';
import { AppError, parseInput } from '@/lib/domain';
import { demoSearch } from '@/lib/demo';
import { GoogleProvider } from '@/lib/google';
import { search } from '@/lib/search';
import { googleConfig } from '@/lib/runtime-config';
import { requestAccess, liveEnabled } from '@/lib/access';
export const runtime = 'nodejs';
let active = false, last = 0, started = Date.now(), count = 0;
const json = (value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request) {
  let locked = false;
  try {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== request.headers.get('host')) throw new AppError('このサイトの画面から検索してください。',403);
    if (Number(request.headers.get('content-length')??0)>4096) throw new AppError('入力が長すぎます。',413);
    const raw = await request.text();
    if (raw.length > 4096) throw new AppError('入力が長すぎます。',413);
    let body:unknown;
    try { body=JSON.parse(raw); } catch { throw new AppError('入力形式が正しくありません。'); }
    const input = parseInput(body);
    if (input.source !== 'google') return json({error:'デモ検索は終了しました。Googleログイン後に検索してください。'},410);
    const access = requestAccess(request.headers);
    if (!access.signedIn) throw new AppError('実検索にはGoogleログインが必要です。',401);
    if (!access.canSearch) throw new AppError('実検索は管理者のみ利用できます。',403);
    if (!liveEnabled()) throw new AppError('実検索は現在停止中です。',503);
    if (request.headers.get('x-kyou-budget-approved')!=='true') throw new AppError('利用回数を確認できません。時間をおいてお試しください。',503);
    const { serverKey: key, browserKey } = googleConfig();
    if (!key || !browserKey) throw new AppError('現在地・任意地点からの検索は準備中です。Google MapsのAPI設定後に利用できます。',503);
    if (Date.now()-started > 3600000) { started=Date.now(); count=0; }
    if (!access.isOwner && (active || Date.now()-last < 10000 || count>=30)) throw new AppError('検索回数を制限しています。10秒以上あけて再試行してください（1時間30回まで）。',429);
    if(!access.isOwner){active=true; locked=true; last=Date.now(); count++;}
    const ratingsAvailable=request.headers.get('x-kyou-ratings-approved')==='true';
    return json({...await search({...input,sort:'budget'},new GoogleProvider(key,ratingsAvailable),new Set<string>(JSON.parse(request.headers.get('x-kyou-excluded-places')??'[]'))),ratingsAvailable});
  } catch (error) {
    return json({error:error instanceof AppError?error.message:'検索に失敗しました。時間をおいてお試しください。'},error instanceof AppError?error.status:500);
  } finally { if (locked) active=false; }
}
