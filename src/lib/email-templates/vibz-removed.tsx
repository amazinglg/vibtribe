import * as React from 'react'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { SITE_NAME, SITE_URL, LOGO_URL, main, container, card, logo, h1, text, footer } from './_shared'

function VibzRemoved({name,postedAt,reason}:{name:string;postedAt:string;reason:string}) {
  return <Html lang="en"><Head/><Preview>Your VibZ has been removed from VibTribe</Preview><Body style={main}><Container style={container}><Section style={card}>
    <Img src={LOGO_URL} width="52" height="52" alt={SITE_NAME} style={logo}/>
    <Heading style={h1}>Your VibZ has been removed from VibTribe</Heading>
    <Text style={text}>Hello {name},</Text>
    <Text style={text}>We're writing to let you know that your VibZ posted on {postedAt} has been removed from VibTribe because it was found to violate our content policies.</Text>
    <Text style={text}><strong>Reason: {reason}</strong></Text>
    <Text style={text}>We encourage you to review VibTribe's <a href={`${SITE_URL}/terms`}>Terms &amp; Conditions and Community Guidelines</a> before posting additional content.</Text>
    <Text style={text}>Please note that repeated violations of our content policies may result in further account restrictions or suspension. We appreciate your understanding and cooperation in helping us keep VibTribe a safe and respectful community.</Text>
    <Text style={footer}>Regards,<br/>VibTribe Team</Text>
  </Section></Container></Body></Html>
}
export const template = { component:VibzRemoved, subject:'Your VibZ has been removed from VibTribe', displayName:'VibZ removal', previewData:{name:'Sam',postedAt:'4 October 2026, 12:00 PM IST',reason:'Unfit Content'} } satisfies TemplateEntry
