import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'VibTribe'
const SITE_URL = 'https://www.vibtribe.in'

interface TicketReplyProps {
  name?: string
  ticketTitle?: string
  ticketDescription?: string
  reply?: string
}

const TicketReplyEmail = ({ name, ticketTitle, ticketDescription, reply }: TicketReplyProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reply to your {SITE_NAME} support ticket</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>We've replied to your support ticket</Heading>
        <Text style={text}>Hi{name ? ` ${name}` : ''},</Text>
        <Text style={text}>
          Our team replied to your ticket{ticketTitle ? `: ` : '.'}
          {ticketTitle && <strong>"{ticketTitle}"</strong>}
        </Text>
        {ticketDescription && (
          <>
            <Text style={label}>Your message</Text>
            <Text style={quote}>{ticketDescription}</Text>
          </>
        )}
        <Text style={label}>Our reply</Text>
        <Text style={replyBox}>{reply || ''}</Text>
        <Hr style={hr} />
        <Button style={button} href={SITE_URL}>Open {SITE_NAME}</Button>
        <Text style={footer}>— {SITE_NAME} Support</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TicketReplyEmail,
  subject: (data: Record<string, any>) =>
    data?.ticketTitle ? `Re: ${data.ticketTitle}` : `Reply to your ${SITE_NAME} ticket`,
  displayName: 'Support ticket reply',
  previewData: {
    name: 'Sam',
    ticketTitle: 'Cannot upload status',
    ticketDescription: 'Hello, I cannot upload a video status today.',
    reply: "Hi Sam — please try clearing app cache and try again. Let us know if it persists.",
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.55', margin: '0 0 14px' }
const label = { fontSize: '11px', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '18px 0 4px' }
const quote = { fontSize: '13px', color: '#666', borderLeft: '3px solid #e6e6ea', padding: '6px 12px', margin: '0 0 8px', whiteSpace: 'pre-wrap' as const }
const replyBox = { fontSize: '14px', color: '#0a0a0f', backgroundColor: '#f4f4f7', borderRadius: '10px', padding: '14px 16px', margin: '0 0 18px', whiteSpace: 'pre-wrap' as const }
const hr = { border: 'none', borderTop: '1px solid #e6e6ea', margin: '20px 0' }
const button = {
  backgroundColor: '#7C3AED', color: '#ffffff', fontSize: '14px',
  borderRadius: '10px', padding: '12px 20px', textDecoration: 'none',
  display: 'inline-block', fontWeight: 'bold' as const,
}
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }