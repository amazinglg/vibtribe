import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'VibTribe'
const SITE_URL = 'https://www.vibtribe.in'

interface NotificationProps {
  title?: string
  body?: string
  link?: string
}

const NotificationEmail = ({ title, body, link }: NotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{title || `New notification from ${SITE_NAME}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{title || `New notification`}</Heading>
        {body && <Text style={text}>{body}</Text>}
        <Button style={button} href={link ? `${SITE_URL}${link}` : SITE_URL}>
          Open in {SITE_NAME}
        </Button>
        <Text style={footer}>You're receiving this because you have notifications enabled in {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NotificationEmail,
  subject: (data: Record<string, any>) => data?.title || `New notification from ${SITE_NAME}`,
  displayName: 'In-app notification',
  previewData: { title: 'New message from Riya', body: 'Tap to read', link: '/' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 14px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.55', margin: '0 0 18px' }
const button = {
  backgroundColor: '#7C3AED', color: '#ffffff', fontSize: '14px',
  borderRadius: '10px', padding: '12px 20px', textDecoration: 'none',
  display: 'inline-block', fontWeight: 'bold' as const,
}
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }