import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata = {title:'今日どこいく？ | 気ままに、出かけよう。',description:'目的地は決まっていない。でも、どこかへ行きたい。時間や距離から次のお出かけを見つけよう。'};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="ja"><body>{children}</body></html>; }
