import {useEffect,useState} from 'react'
import {Link} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {Clapperboard} from 'lucide-react'
import {getVibzFeed,getVibzProfile} from '@/lib/vibz.functions'
import {Button} from '@/components/ui/button'

const compact=(n:number)=>Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n)
export default function VibzProfileSummary({userId}:{userId:string}){
 const getProfile=useServerFn(getVibzProfile);const getPosts=useServerFn(getVibzFeed);const [profile,setProfile]=useState<any>(null);const [posts,setPosts]=useState<any[]>([])
 useEffect(()=>{Promise.all([getProfile({data:{id:userId}}),getPosts({data:{creatorId:userId}})]).then(([p,v])=>{setProfile(p);setPosts(v)}).catch(()=>{})},[userId,getProfile,getPosts])
 return <section className="mt-4 border-t border-border pt-4" aria-label="Your VibZ overview"><div className="flex items-center justify-between gap-2 mb-3"><h3 className="font-semibold flex items-center gap-2"><Clapperboard size={17} className="text-primary"/>VibZ overview</h3><Button asChild variant="outline" size="sm"><Link to="/vibz/$creatorId" params={{creatorId:userId}}>View VibZ</Link></Button></div><div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">{[['VibeMates',profile?.vibemates],['VibeIn',profile?.vibein_count],['VibZ',posts.length],['Likes',profile?.total_likes],['Comments',profile?.total_comments],['Shares',profile?.total_shares]].map(([label,value])=><div key={String(label)} className="bg-muted/60 rounded-lg p-2 min-w-0"><strong className="block text-sm">{compact(Number(value||0))}</strong><span className="text-[10px] text-muted-foreground break-words">{label}</span></div>)}</div></section>
}
