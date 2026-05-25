import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'VibTribe'
const SITE_URL = 'https://www.vibtribe.in'

interface WelcomeProps { name?: string }

const WelcomeEmail = ({ name }: WelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — let's get you started</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to {SITE_NAME}{name ? `, ${name}` : ''}! 🎉</Heading>
        <Text style={text}>
          You're all set. {SITE_NAME} is built around real-time chat, secure private
          vaults, and 24-hour status updates with your circle.
        </Text>
        <Text style={text}>A few things to try next:</Text>
        <Text style={list}>• Complete your profile and add a photo</Text>
        <Text style={list}>• Invite a friend by their mobile number</Text>
        <Text style={list}>• Post your first 24-hour status</Text>
        <Button style={button} href={SITE_URL}>Open {SITE_NAME}</Button>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: `Welcome to ${SITE_NAME}`,
  displayName: 'Welcome email',
  previewData: { name: 'Sam' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.55', margin: '0 0 14px' }
const list = { fontSize: '14px', color: '#55575d', lineHeight: '1.7', margin: '0 0 6px' }
const button = {
  backgroundColor: '#7C3AED', color: '#ffffff', fontSize: '14px',
  borderRadius: '10px', padding: '12px 20px', textDecoration: 'none',
  display: 'inline-block', marginTop: '16px', fontWeight: 'bold' as const,
}
const footer = { fontSize: '12px', color: '#999', margin: '28px 0 0' }