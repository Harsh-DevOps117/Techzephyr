"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
const links=[['/','Dashboard'],['/datasets','Datasets'],['/schedule','Generate'],['/repair','Repair'],['/bookings','Bookings'],['/approve','Approve'],['/jobs','Jobs']];
export function AppShell({children}:{children:React.ReactNode}){const path=usePathname(),router=useRouter();useEffect(()=>{if(process.env.NODE_ENV==='production')navigator.serviceWorker?.register('/sw.js');else navigator.serviceWorker?.getRegistrations().then(items=>items.forEach(item=>item.unregister()));if(path!=='/login'&&!localStorage.getItem('tz_access_token'))router.replace('/login')},[path,router]);if(path==='/login')return <>{children}</>;return <><div className="appbar"><Link className="brand" href="/"><span className="mark">T</span><span>TechZephyr <b>4</b></span></Link><nav>{links.map(([href,label])=><Link className={path===href?'active':''} href={href} key={href}>{label}</Link>)}</nav><button className="profile" onClick={()=>{localStorage.clear();router.push('/login')}}>Sign out</button></div>{children}</>}
