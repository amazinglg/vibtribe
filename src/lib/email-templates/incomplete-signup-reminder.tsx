import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  SITE_NAME, SITE_URL, LOGO_URL,
  main, container, card, logo, eyebrow, h1, text, muted, button, footer,
} from './_shared'

interface Props {
  name?: string
  reminderNumber?: 1 | 2 | 3
}

const HEADLINES = {
  1: (n: string) => `${n}, your tribe is waiting`,
  2: (n: string) => `${n}, just one step left`,
  3: (n: string) => `${n}, a final nudge from us`,
}

const SUBS = {
  1: 'You verified your email but didn’t finish setting up. It takes less than a minute — pick a username, add a photo, and you’re in.',
  2: 'Your account is still waiting for its first taste of VibTribe. Finish onboarding and start connecting with your circle.',
  3: 'This is our last reminder. If you don’t complete your profile, your account may be removed to keep the community clean.',
}

const IncompleteSignupReminder = ({ name, reminderNumber = 1 }: Props) => {
  const first = (name || 'there').split(' ')[0]
  const idx = (Math.min(3, Math.max(1, reminderNumber)) as 1 | 2 | 3)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Finish setting up your {SITE_NAME} account — it only takes a minute.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Img src={LOGO_URL} width="52" height="52" alt={SITE_NAME} style={logo} />
            <Text style={eyebrow}>Complete your sign-up</Text>
            <Heading style={h1}>{HEADLINES[idx](first)}</Heading>
            <Text style={text}>{SUBS[idx]}</Text>
            <Text style={text}>
              Set a username, add a bio, and choose your 6-digit encryption
              passcode. Once you’re done, you can chat, post statuses, and
              build your private circle.
            </Text>
            <Button style={button} href={`${SITE_URL}/complete-profile`}>
              Finish setup
            </Button>
            <Text style={muted}>
              Or open the app directly: <a href={SITE_URL} style={{ color: '#6366f1' }}>{SITE_URL.replace('https://', '')}</a>
            </Text>
            <Text style={footer}>
              You’re receiving this because you created a {SITE_NAME} account but
              didn’t finish onboarding. This is reminder {idx} of 3.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: IncompleteSignupReminder,
  subject: (data: Record<string, any>) => {
    const n = Number(data?.reminderNumber) || 1
    if (n >= 3) return `Final reminder — finish setting up your ${SITE_NAME} account`
    if (n === 2) return `Still there? Finish your ${SITE_NAME} sign-up`
    return `Finish setting up your ${SITE_NAME} account`
  },
  displayName: 'Incomplete signup reminder',
  previewData: { name: 'Sam', reminderNumber: 1 },
} satisfies TemplateEntry