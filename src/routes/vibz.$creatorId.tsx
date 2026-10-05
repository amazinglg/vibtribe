import {createFileRoute} from '@tanstack/react-router'
import AppLayout from '@/components/AppLayout'
import VibzExperience from '@/components/VibzExperience'
export const Route=createFileRoute('/vibz/$creatorId')({component:()=>{const {creatorId}=Route.useParams();return <AppLayout><VibzExperience profileId={creatorId}/></AppLayout>},head:()=>({meta:[{title:'Creator VibZ — VibTribe'},{name:'description',content:'Explore this VibTribe creator’s short videos.'},{name:'robots',content:'noindex, nofollow'},{property:'og:title',content:'Creator VibZ — VibTribe'},{property:'og:description',content:'Explore this VibTribe creator’s short videos.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]})})
