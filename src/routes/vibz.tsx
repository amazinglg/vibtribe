import {createFileRoute} from '@tanstack/react-router'
import AppLayout from '@/components/AppLayout'
import VibzExperience from '@/components/VibzExperience'
export const Route=createFileRoute('/vibz')({component:()=> <AppLayout><VibzExperience/></AppLayout>,head:()=>({meta:[{title:'VibZ — VibTribe'},{name:'description',content:'Watch and share short videos with the VibTribe community.'},{name:'robots',content:'noindex, nofollow'},{property:'og:title',content:'VibZ — VibTribe'},{property:'og:description',content:'Watch and share short videos with the VibTribe community.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]})})
