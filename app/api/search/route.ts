import { NextResponse } from 'next/server';
import { AppError, parseInput } from '@/lib/domain';
import { demoSearch } from '@/lib/demo';
import { GoogleProvider } from '@/lib/google';
import { search } from '@/lib/search';
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
    if (input.source === 'demo') return json(demoSearch(input));
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) throw new AppError('実APIのキーが未設定です。デモモードをご利用ください。',503);
    if (Date.now()-started > 3600000) { started=Date.now(); count=0; }
    if (active || Date.now()-last < 10000 || count>=30) throw new AppError('検索回数を制限しています。10秒以上あけて再試行してください（1時間30回まで）。',429);
    active=true; locked=true; last=Date.now(); count++;
    return json(await search(input,new GoogleProvider(key)));
  } catch (error) {
    return json({error:error instanceof AppError?error.message:'検索に失敗しました。時間をおいてお試しください。'},error instanceof AppError?error.status:500);
  } finally { if (locked) active=false; }
}
