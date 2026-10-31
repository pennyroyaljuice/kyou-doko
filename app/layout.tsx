import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata = {title:'今日どこいく？ | 目的地・経路検索',description:'出発地点・移動手段・時間や距離を指定して、目的地と経路を検索します。'};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="ja"><body>{children}</body></html>; }
